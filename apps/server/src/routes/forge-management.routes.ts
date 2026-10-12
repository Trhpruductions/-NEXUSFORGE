import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { createNotification } from "../lib/notifications.js";
import { evictUserFromChannels, evictUserFromForge, getIo } from "../lib/realtime.js";
import { logForgeAction } from "../lib/forge-audit.js";
import { clearAutoModCache } from "../lib/automod-runtime.js";
import { isOwnUploadUrl } from "../lib/storage.js";
import { generateInviteCode, inviteIsUsable } from "../lib/forge-invites.js";
import { canViewChannel, loadMemberContext, privateChannelViewerIds } from "../lib/channel-access.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import {
  canManageRolePosition,
  canModerateMember,
  forgePermissionKeys,
  hasForgePermission,
  isProtectedOwnerRole,
  maxAssignableRolePosition,
  ownerRolePosition,
  normalizePermissions,
  resolveForgeAccess,
  type ForgePermissionKey,
  type ResolvedForgeAccess,
} from "../lib/forge-permissions.js";

/**
 * Forge management: settings, channels, roles, members, bans, leave/delete.
 * Mounted at /api/forges alongside forgesRouter; every route here is scoped to /:id/...
 */

/** Removing someone from a forge also removes them from its live rooms. */
async function evictFromRealtime(forgeId: string, userId: string) {
  const channels = await prisma.channel.findMany({ where: { forgeId }, select: { id: true } });
  await evictUserFromForge(forgeId, userId, channels.map((channel) => channel.id));
}

export const forgeManagementRouter = Router();

forgeManagementRouter.use(requireAuth);
forgeManagementRouter.use(requireCsrf);

const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i, "Color must be a hex value like #22d3ee.");

const channelNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .transform((value) => value.replace(/\s+/g, " "));

const updateForgeSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(300).nullable().optional(),
    icon: z.string().url().nullable().optional(),
    banner: z.string().url().nullable().optional(),
    isPublic: z.boolean().optional(),
    category: z.enum(["gaming", "creators", "esports", "social"]).optional(),
    tags: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied." });

/** Discord's slowmode choices, in seconds (0 = off, up to 6 hours). */
const slowmodeSchema = z.number().int().min(0).max(21600);
const idListSchema = z.array(z.string().uuid()).max(100);

const createChannelSchema = z.object({
  name: channelNameSchema,
  type: z.enum(["TEXT", "VOICE", "ANNOUNCEMENT", "STAGE", "CATEGORY"]).default("TEXT"),
  topic: z.string().trim().max(240).optional(),
  parentId: z.string().uuid().nullable().optional(),
  slowmodeSeconds: slowmodeSchema.optional(),
  isPrivate: z.boolean().optional(),
  allowedRoleIds: idListSchema.optional(),
  allowedUserIds: idListSchema.optional(),
});

const updateChannelSchema = z
  .object({
    name: channelNameSchema.optional(),
    topic: z.string().trim().max(240).nullable().optional(),
    position: z.number().int().min(0).max(500).optional(),
    parentId: z.string().uuid().nullable().optional(),
    slowmodeSeconds: slowmodeSchema.optional(),
    isPrivate: z.boolean().optional(),
    allowedRoleIds: idListSchema.optional(),
    allowedUserIds: idListSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied." });

const timeoutSchema = z.object({
  /** null clears the timeout. Discord caps timeouts at 28 days. */
  minutes: z.number().int().min(1).max(40320).nullable(),
  reason: z.string().trim().max(300).optional(),
});

const createInviteSchema = z.object({
  /** 0 = never expires. */
  maxAgeSeconds: z.union([z.literal(0), z.literal(1800), z.literal(3600), z.literal(21600), z.literal(43200), z.literal(86400), z.literal(604800)]).default(604800),
  /** 0 = unlimited. */
  maxUses: z.union([z.literal(0), z.literal(1), z.literal(5), z.literal(10), z.literal(25), z.literal(50), z.literal(100)]).default(0),
});

const transferSchema = z.object({
  userId: z.string().uuid(),
  confirmName: z.string().trim().min(1).max(80),
});

const permissionsSchema = z
  .object(Object.fromEntries(forgePermissionKeys.map((key) => [key, z.boolean().optional()])) as Record<ForgePermissionKey, z.ZodOptional<z.ZodBoolean>>)
  .strict();

const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: hexColorSchema.default("#94a3b8"),
  permissions: permissionsSchema.default({}),
  position: z.number().int().min(0).max(maxAssignableRolePosition).optional(),
});

const updateRoleSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    color: hexColorSchema.optional(),
    permissions: permissionsSchema.optional(),
    position: z.number().int().min(0).max(maxAssignableRolePosition).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied." });

const setMemberRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).max(50),
});

const updateMemberSchema = z.object({
  nickname: z.string().trim().max(32).nullable(),
});

const createBanSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().trim().max(300).optional(),
});

type LoadedContext = {
  forge: { id: string; ownerId: string; name: string };
  access: ResolvedForgeAccess;
};

async function loadContext(forgeId: string, userId: string): Promise<LoadedContext | null> {
  const forge = await prisma.forge.findUnique({
    where: { id: forgeId },
    select: { id: true, ownerId: true, name: true },
  });
  if (!forge) return null;

  const membership = await prisma.forgeMember.findUnique({
    where: { userId_forgeId: { userId, forgeId } },
    include: { roleLinks: { include: { role: { select: { id: true, position: true, permissions: true } } } } },
  });
  if (!membership) return null;

  const access = resolveForgeAccess(
    forge.ownerId === userId,
    membership.roleLinks.map((link) => link.role),
  );

  return { forge, access };
}

async function loadTargetAccess(forgeId: string, ownerId: string, userId: string): Promise<ResolvedForgeAccess | null> {
  const membership = await prisma.forgeMember.findUnique({
    where: { userId_forgeId: { userId, forgeId } },
    include: { roleLinks: { include: { role: { select: { id: true, position: true, permissions: true } } } } },
  });
  if (!membership) return null;
  return resolveForgeAccess(ownerId === userId, membership.roleLinks.map((link) => link.role));
}

function forgeRoom(forgeId: string) {
  return `forge:${forgeId}`;
}

function emitForgeEvent(forgeId: string, event: string, payload: Record<string, unknown> = {}) {
  try {
    getIo().to(forgeRoom(forgeId)).emit(event, { forgeId, ...payload });
  } catch {
    // realtime not initialised (tests) - ignore
  }
}

function emitUserEvent(userId: string, event: string, payload: Record<string, unknown>) {
  try {
    getIo().to(`user:${userId}`).emit(event, payload);
  } catch {
    // ignore
  }
}

/** Shared guard: loads context, 404s on missing forge, 403s on non-membership or missing permission. */
async function guard(
  req: { params: Record<string, string>; user?: { id: string } },
  res: { status: (code: number) => { json: (body: unknown) => void } },
  permission?: ForgePermissionKey,
): Promise<LoadedContext | null> {
  const forgeId = req.params.id;
  const context = await loadContext(forgeId, req.user!.id);
  if (!context) {
    const exists = await prisma.forge.findUnique({ where: { id: forgeId }, select: { id: true } });
    res.status(exists ? 403 : 404).json({ error: exists ? "You are not a member of this Forge" : "Forge not found" });
    return null;
  }
  if (permission && !hasForgePermission(context.access, permission)) {
    res.status(403).json({ error: `Missing permission: ${permission}` });
    return null;
  }
  return context;
}

/**
 * Checks the category / private-access fields of a channel create or update. Returns an
 * error message, or null when everything points at things inside this forge.
 */
async function validateChannelLinks(
  forgeId: string,
  type: string,
  data: { parentId?: string | null; allowedRoleIds?: string[]; allowedUserIds?: string[] },
  selfId?: string,
): Promise<string | null> {
  if (data.parentId) {
    if (type === "CATEGORY") return "A category can't sit inside another category";
    if (data.parentId === selfId) return "A channel can't be its own category";
    const parent = await prisma.channel.findFirst({ where: { id: data.parentId, forgeId }, select: { type: true } });
    if (!parent || parent.type !== "CATEGORY") return "That category doesn't exist";
  }
  if (data.allowedRoleIds?.length) {
    const count = await prisma.role.count({ where: { forgeId, id: { in: data.allowedRoleIds } } });
    if (count !== new Set(data.allowedRoleIds).size) return "One of those roles isn't in this forge";
  }
  if (data.allowedUserIds?.length) {
    const count = await prisma.forgeMember.count({ where: { forgeId, userId: { in: data.allowedUserIds } } });
    if (count !== new Set(data.allowedUserIds).size) return "One of those people isn't a member of this forge";
  }
  return null;
}

/** After a private channel's access list changes, kick anyone who can no longer see it out of its rooms. */
async function evictLostViewers(channel: { id: string; forgeId: string; isPrivate: boolean; allowedRoleIds: string[]; allowedUserIds: string[] }) {
  if (!channel.isPrivate) return;
  try {
    const sockets = await getIo().in([`channel:${channel.id}`, `voice:${channel.id}`]).fetchSockets();
    const userIds = [...new Set(sockets.map((socket) => socket.data?.user?.id as string | undefined).filter(Boolean))] as string[];
    for (const userId of userIds) {
      const member = await loadMemberContext(userId, channel.forgeId);
      if (!canViewChannel(member, channel)) evictUserFromChannels(userId, [channel.id], { reason: "private" });
    }
  } catch {
    // realtime not initialised (tests) - ignore
  }
}

/** Audit-log label for a member: their username. */
async function usernameOf(userId: string) {
  return (await prisma.user.findUnique({ where: { id: userId }, select: { username: true } }))?.username ?? userId;
}

// ---------------------------------------------------------------------------
// Caller access snapshot
// ---------------------------------------------------------------------------

forgeManagementRouter.get("/:id/permissions", async (req, res) => {
  const context = await guard(req, res);
  if (!context) return;
  res.json({
    forgeId: context.forge.id,
    isOwner: context.access.isOwner,
    topPosition: context.access.topPosition,
    permissions: context.access.permissions,
  });
});

// ---------------------------------------------------------------------------
// Forge settings / lifecycle
// ---------------------------------------------------------------------------

forgeManagementRouter.patch("/:id", async (req, res) => {
  const parsed = updateForgeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const context = await guard(req, res, "manageForge");
  if (!context) return;

  const forge = await prisma.forge.update({
    where: { id: context.forge.id },
    data: { ...parsed.data, tags: parsed.data.tags?.map((tag) => tag.replace(/^#/, "").toLowerCase()) },
    select: { id: true, name: true, description: true, icon: true, banner: true, inviteCode: true, ownerId: true, isPublic: true, category: true, tags: true, updatedAt: true },
  });

  emitForgeEvent(forge.id, "forge:updated", { forge });
  void logForgeAction(forge.id, req.user!.id, "forge.update", { type: "forge", id: forge.id, label: forge.name }, { changed: Object.keys(parsed.data) });
  res.json({ forge });
});

// ---------------------------------------------------------------------------
// Your own notification settings for this forge (any member)
// ---------------------------------------------------------------------------

const notificationSettingsSchema = z
  .object({
    notifyLevel: z.enum(["ALL", "MENTIONS", "NONE"]).optional(),
    /** Minutes to mute for; 0 unmutes; -1 mutes until turned back on. */
    muteMinutes: z.union([z.literal(-1), z.literal(0), z.literal(15), z.literal(60), z.literal(180), z.literal(480), z.literal(1440)]).optional(),
    suppressEveryone: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied." });

/** "Until I turn it back on" is stored as a date far in the future. */
const FOREVER = new Date("9999-12-31T00:00:00Z");

forgeManagementRouter.get("/:id/notification-settings", async (req, res) => {
  const context = await guard(req, res);
  if (!context) return;
  const member = await prisma.forgeMember.findUnique({
    where: { userId_forgeId: { userId: req.user!.id, forgeId: context.forge.id } },
    select: { notifyLevel: true, mutedUntil: true, suppressEveryone: true },
  });
  const muted = Boolean(member?.mutedUntil && member.mutedUntil > new Date());
  res.json({
    notifyLevel: member?.notifyLevel ?? "MENTIONS",
    suppressEveryone: member?.suppressEveryone ?? false,
    muted,
    mutedUntil: muted ? (member!.mutedUntil!.getTime() >= FOREVER.getTime() ? null : member!.mutedUntil) : null,
    mutedForever: muted && member!.mutedUntil!.getTime() >= FOREVER.getTime(),
  });
});

forgeManagementRouter.put("/:id/notification-settings", async (req, res) => {
  const parsed = notificationSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const context = await guard(req, res);
  if (!context) return;
  const { muteMinutes } = parsed.data;
  const member = await prisma.forgeMember.update({
    where: { userId_forgeId: { userId: req.user!.id, forgeId: context.forge.id } },
    data: {
      notifyLevel: parsed.data.notifyLevel,
      suppressEveryone: parsed.data.suppressEveryone,
      mutedUntil: muteMinutes === undefined ? undefined : muteMinutes === 0 ? null : muteMinutes === -1 ? FOREVER : new Date(Date.now() + muteMinutes * 60_000),
    },
    select: { notifyLevel: true, mutedUntil: true, suppressEveryone: true },
  });
  emitUserEvent(req.user!.id, "forge:notification-settings", { forgeId: context.forge.id });
  const muted = Boolean(member.mutedUntil && member.mutedUntil > new Date());
  res.json({
    notifyLevel: member.notifyLevel,
    suppressEveryone: member.suppressEveryone,
    muted,
    mutedUntil: muted && member.mutedUntil!.getTime() < FOREVER.getTime() ? member.mutedUntil : null,
    mutedForever: muted && member.mutedUntil!.getTime() >= FOREVER.getTime(),
  });
});

// ---------------------------------------------------------------------------
// Custom emoji
// ---------------------------------------------------------------------------

const MAX_EMOJI = 50;
const emojiSchema = z.object({
  name: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{2,30}$/, "Emoji names are 2-30 letters, numbers or underscores"),
  imageUrl: z.string().url().max(2048),
});

forgeManagementRouter.get("/:id/emojis", async (req, res) => {
  const context = await guard(req, res);
  if (!context) return;
  const emojis = await prisma.forgeEmoji.findMany({ where: { forgeId: context.forge.id }, orderBy: { name: "asc" }, select: { id: true, name: true, imageUrl: true, creatorId: true, createdAt: true } });
  res.json({ emojis, max: MAX_EMOJI });
});

forgeManagementRouter.post("/:id/emojis", async (req, res) => {
  const parsed = emojiSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid emoji" });
    return;
  }
  const context = await guard(req, res, "manageForge");
  if (!context) return;
  // Only images uploaded to our own storage: an outside URL would let the uploader see
  // everyone who views a message with the emoji.
  if (!isOwnUploadUrl(parsed.data.imageUrl) || !/\.(png|gif|webp|jpe?g)(\?|$)/i.test(parsed.data.imageUrl)) {
    res.status(400).json({ error: "Upload a PNG, GIF, WebP or JPEG image" });
    return;
  }
  if ((await prisma.forgeEmoji.count({ where: { forgeId: context.forge.id } })) >= MAX_EMOJI) {
    res.status(400).json({ error: `A forge can have up to ${MAX_EMOJI} emoji` });
    return;
  }
  const taken = await prisma.forgeEmoji.findUnique({ where: { forgeId_name: { forgeId: context.forge.id, name: parsed.data.name } }, select: { id: true } });
  if (taken) {
    res.status(409).json({ error: `:${parsed.data.name}: already exists` });
    return;
  }
  const emoji = await prisma.forgeEmoji.create({ data: { forgeId: context.forge.id, name: parsed.data.name, imageUrl: parsed.data.imageUrl, creatorId: req.user!.id }, select: { id: true, name: true, imageUrl: true, creatorId: true, createdAt: true } });
  emitForgeEvent(context.forge.id, "forge:emojis", { action: "created", emoji });
  res.status(201).json({ emoji });
});

forgeManagementRouter.delete("/:id/emojis/:emojiId", async (req, res) => {
  const context = await guard(req, res, "manageForge");
  if (!context) return;
  const existing = await prisma.forgeEmoji.findFirst({ where: { id: req.params.emojiId, forgeId: context.forge.id }, select: { id: true } });
  if (!existing) {
    res.status(404).json({ error: "Emoji not found" });
    return;
  }
  await prisma.forgeEmoji.delete({ where: { id: existing.id } });
  emitForgeEvent(context.forge.id, "forge:emojis", { action: "deleted", emojiId: existing.id });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// AutoMod rules (manageForge)
// ---------------------------------------------------------------------------

const wordList = z.array(z.string().trim().min(1).max(60)).max(200);
// No .default() here: a partial update must only change the fields it sends.
const automodFields = {
  name: z.string().trim().min(1).max(60),
  enabled: z.boolean(),
  type: z.enum(["KEYWORDS", "LINKS", "INVITES", "MENTION_SPAM"]),
  keywords: wordList,
  allowList: wordList,
  mentionLimit: z.number().int().min(1).max(50).nullable(),
  blockMessage: z.boolean(),
  alertModerators: z.boolean(),
  timeoutMinutes: z.union([z.literal(1), z.literal(5), z.literal(10), z.literal(60), z.literal(1440), z.literal(10080)]).nullable(),
  customMessage: z.string().trim().max(150).nullable(),
  exemptRoleIds: z.array(z.string().uuid()).max(50),
  exemptChannelIds: z.array(z.string().uuid()).max(100),
};
const automodUpdateSchema = z.object(automodFields).partial();
const automodCreateSchema = automodUpdateSchema.required({ name: true, type: true }).transform((value) => ({
  enabled: true,
  keywords: [] as string[],
  allowList: [] as string[],
  mentionLimit: null as number | null,
  blockMessage: true,
  alertModerators: true,
  timeoutMinutes: null as number | null,
  customMessage: null as string | null,
  exemptRoleIds: [] as string[],
  exemptChannelIds: [] as string[],
  ...Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)),
  name: value.name,
  type: value.type,
}));

function automodProblem(rule: { type: string; keywords: string[]; mentionLimit: number | null; blockMessage: boolean; alertModerators: boolean; timeoutMinutes: number | null }) {
  if (rule.type === "KEYWORDS" && !rule.keywords.length) return "Add at least one word or phrase";
  if (rule.type === "MENTION_SPAM" && !rule.mentionLimit) return "Set how many mentions are allowed";
  if (!rule.blockMessage && !rule.alertModerators && !rule.timeoutMinutes) return "Pick at least one action";
  return null;
}

forgeManagementRouter.get("/:id/automod", async (req, res) => {
  const context = await guard(req, res, "manageForge");
  if (!context) return;
  const rules = await prisma.forgeAutoModRule.findMany({ where: { forgeId: context.forge.id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  res.json({ rules });
});

forgeManagementRouter.post("/:id/automod", async (req, res) => {
  const parsed = automodCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid rule", details: parsed.error.flatten() });
    return;
  }
  const context = await guard(req, res, "manageForge");
  if (!context) return;
  const problem = automodProblem(parsed.data);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }
  const count = await prisma.forgeAutoModRule.count({ where: { forgeId: context.forge.id } });
  if (count >= 20) {
    res.status(400).json({ error: "A forge can have up to 20 AutoMod rules" });
    return;
  }
  const rule = await prisma.forgeAutoModRule.create({ data: { ...parsed.data, forgeId: context.forge.id, position: count, createdById: req.user!.id } });
  clearAutoModCache(context.forge.id);
  void logForgeAction(context.forge.id, req.user!.id, "automod.rule.create", { type: "forge", id: rule.id, label: rule.name }, { type: rule.type });
  res.status(201).json({ rule });
});

forgeManagementRouter.patch("/:id/automod/:ruleId", async (req, res) => {
  const parsed = automodUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid rule", details: parsed.error.flatten() });
    return;
  }
  const context = await guard(req, res, "manageForge");
  if (!context) return;
  const existing = await prisma.forgeAutoModRule.findFirst({ where: { id: req.params.ruleId, forgeId: context.forge.id } });
  if (!existing) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }
  const merged = { ...existing, ...parsed.data };
  const problem = automodProblem(merged);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }
  const rule = await prisma.forgeAutoModRule.update({ where: { id: existing.id }, data: parsed.data });
  clearAutoModCache(context.forge.id);
  void logForgeAction(context.forge.id, req.user!.id, "automod.rule.update", { type: "forge", id: rule.id, label: rule.name }, { changed: Object.keys(parsed.data) });
  res.json({ rule });
});

forgeManagementRouter.delete("/:id/automod/:ruleId", async (req, res) => {
  const context = await guard(req, res, "manageForge");
  if (!context) return;
  const existing = await prisma.forgeAutoModRule.findFirst({ where: { id: req.params.ruleId, forgeId: context.forge.id } });
  if (!existing) {
    res.status(404).json({ error: "Rule not found" });
    return;
  }
  await prisma.forgeAutoModRule.delete({ where: { id: existing.id } });
  clearAutoModCache(context.forge.id);
  void logForgeAction(context.forge.id, req.user!.id, "automod.rule.delete", { type: "forge", id: existing.id, label: existing.name });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

forgeManagementRouter.get("/:id/audit-log", async (req, res) => {
  const context = await guard(req, res, "manageForge");
  if (!context) return;

  const limit = Math.min(Math.max(Number(req.query.limit ?? 50) || 50, 1), 100);
  const before = typeof req.query.before === "string" && !Number.isNaN(Date.parse(req.query.before)) ? new Date(req.query.before) : undefined;
  const action = typeof req.query.action === "string" && /^[a-z]+(\.[a-z]+)?$/.test(req.query.action) ? req.query.action : undefined;
  const actorId = typeof req.query.actorId === "string" && /^[0-9a-f-]{36}$/i.test(req.query.actorId) ? req.query.actorId : undefined;

  const entries = await prisma.forgeAuditEntry.findMany({
    where: {
      forgeId: context.forge.id,
      ...(before ? { createdAt: { lt: before } } : {}),
      ...(action ? (action.includes(".") ? { action } : { action: { startsWith: `${action}.` } }) : {}),
      ...(actorId ? { actorId } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  const actorIds = [...new Set(entries.map((entry) => entry.actorId))];
  const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, username: true, avatar: true } });
  const actorById = new Map(actors.map((actor) => [actor.id, actor] as const));

  res.json({
    entries: entries.map((entry) => ({ ...entry, actor: actorById.get(entry.actorId) ?? { id: entry.actorId, username: "Deleted user", avatar: null } })),
    nextBefore: entries.length === limit ? entries[entries.length - 1].createdAt.toISOString() : null,
  });
});

// ---------------------------------------------------------------------------
// Ownership transfer
// ---------------------------------------------------------------------------

forgeManagementRouter.post("/:id/transfer", async (req, res) => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const context = await guard(req, res);
  if (!context) return;
  if (!context.access.isOwner) {
    res.status(403).json({ error: "Only the owner can transfer ownership" });
    return;
  }
  if (parsed.data.userId === req.user!.id) {
    res.status(400).json({ error: "You already own this forge" });
    return;
  }
  // Typing the forge name is the "are you sure" for something this hard to undo.
  if (parsed.data.confirmName.toLowerCase() !== context.forge.name.trim().toLowerCase()) {
    res.status(400).json({ error: "Type the forge's name exactly to confirm" });
    return;
  }

  const [oldMember, newMember] = await Promise.all([
    prisma.forgeMember.findUnique({ where: { userId_forgeId: { userId: req.user!.id, forgeId: context.forge.id } }, include: { roleLinks: { include: { role: true } } } }),
    prisma.forgeMember.findUnique({ where: { userId_forgeId: { userId: parsed.data.userId, forgeId: context.forge.id } }, select: { id: true, userId: true } }),
  ]);
  if (!oldMember || !newMember) {
    res.status(404).json({ error: "That person isn't a member of this forge" });
    return;
  }

  // The Owner role moves with ownership; the previous owner keeps their other roles.
  const ownerRoleIds = oldMember.roleLinks.filter((link) => link.role.position >= ownerRolePosition).map((link) => link.roleId);
  await prisma.$transaction([
    prisma.forge.update({ where: { id: context.forge.id }, data: { ownerId: newMember.userId } }),
    ...(ownerRoleIds.length
      ? [
          prisma.memberRole.deleteMany({ where: { forgeMemberId: oldMember.id, roleId: { in: ownerRoleIds } } }),
          prisma.memberRole.deleteMany({ where: { forgeMemberId: newMember.id, roleId: { in: ownerRoleIds } } }),
          prisma.memberRole.createMany({ data: ownerRoleIds.map((roleId) => ({ forgeMemberId: newMember.id, roleId })) }),
        ]
      : []),
  ]);

  const newOwnerName = await usernameOf(newMember.userId);
  void logForgeAction(context.forge.id, req.user!.id, "forge.transfer", { type: "member", id: newMember.userId, label: newOwnerName });
  emitForgeEvent(context.forge.id, "forge:updated", { forge: { id: context.forge.id, ownerId: newMember.userId } });
  emitForgeEvent(context.forge.id, "forge:members", { action: "roles-changed" });
  void createNotification({
    userId: newMember.userId,
    type: "SYSTEM",
    title: "You own a forge now",
    body: `${req.user!.username} made you the owner of ${context.forge.name}.`,
    data: { forgeId: context.forge.id },
  }).catch(() => undefined);
  res.json({ ok: true, forgeId: context.forge.id, ownerId: newMember.userId });
});

// ---------------------------------------------------------------------------
// Invites (extra links with an expiry and/or a use limit)
// ---------------------------------------------------------------------------

forgeManagementRouter.get("/:id/invites", async (req, res) => {
  const context = await guard(req, res);
  if (!context) return;
  // Managers see every invite; everyone else sees the ones they made.
  const seeAll = hasForgePermission(context.access, "manageForge");
  const invites = await prisma.forgeInvite.findMany({
    where: { forgeId: context.forge.id, revokedAt: null, ...(seeAll ? {} : { creatorId: req.user!.id }) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const live = invites.filter((invite) => inviteIsUsable(invite));
  const creators = await prisma.user.findMany({ where: { id: { in: [...new Set(live.map((invite) => invite.creatorId))] } }, select: { id: true, username: true } });
  const creatorById = new Map(creators.map((creator) => [creator.id, creator] as const));
  res.json({ invites: live.map((invite) => ({ ...invite, creator: creatorById.get(invite.creatorId) ?? null })), canManageAll: seeAll });
});

forgeManagementRouter.post("/:id/invites", async (req, res) => {
  const parsed = createInviteSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const context = await guard(req, res);
  if (!context) return;

  const now = new Date();
  const active = await prisma.forgeInvite.count({
    where: { forgeId: context.forge.id, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
  });
  if (active >= 100) {
    res.status(400).json({ error: "This forge has 100 active invites. Revoke some first." });
    return;
  }

  // Codes share a namespace with forge vanity codes, so retry on the rare collision.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const clash = await prisma.forge.findUnique({ where: { inviteCode: code }, select: { id: true } });
    if (clash) continue;
    try {
      const invite = await prisma.forgeInvite.create({
        data: {
          code,
          forgeId: context.forge.id,
          creatorId: req.user!.id,
          maxUses: parsed.data.maxUses || null,
          expiresAt: parsed.data.maxAgeSeconds ? new Date(now.getTime() + parsed.data.maxAgeSeconds * 1000) : null,
        },
      });
      void logForgeAction(context.forge.id, req.user!.id, "invite.create", { type: "invite", id: invite.id, label: invite.code }, { maxUses: invite.maxUses, expiresAt: invite.expiresAt });
      res.status(201).json({ invite: { ...invite, creator: { id: req.user!.id, username: req.user!.username } } });
      return;
    } catch {
      // unique clash on code - try another
    }
  }
  res.status(500).json({ error: "Couldn't create an invite. Try again." });
});

forgeManagementRouter.delete("/:id/invites/:inviteId", async (req, res) => {
  const context = await guard(req, res);
  if (!context) return;
  const invite = await prisma.forgeInvite.findFirst({ where: { id: req.params.inviteId, forgeId: context.forge.id, revokedAt: null } });
  if (!invite) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }
  if (invite.creatorId !== req.user!.id && !hasForgePermission(context.access, "manageForge")) {
    res.status(403).json({ error: "You can only revoke invites you made" });
    return;
  }
  await prisma.forgeInvite.update({ where: { id: invite.id }, data: { revokedAt: new Date() } });
  void logForgeAction(context.forge.id, req.user!.id, "invite.revoke", { type: "invite", id: invite.id, label: invite.code });
  res.json({ ok: true, inviteId: invite.id });
});

forgeManagementRouter.delete("/:id", async (req, res) => {
  const context = await guard(req, res);
  if (!context) return;
  if (!context.access.isOwner) {
    res.status(403).json({ error: "Only the forge owner can delete it" });
    return;
  }

  const memberIds = (
    await prisma.forgeMember.findMany({ where: { forgeId: context.forge.id }, select: { userId: true } })
  ).map((member) => member.userId);

  await prisma.forge.delete({ where: { id: context.forge.id } });

  emitForgeEvent(context.forge.id, "forge:deleted", { name: context.forge.name });
  for (const userId of memberIds) {
    emitUserEvent(userId, "forge:removed", { forgeId: context.forge.id, reason: "deleted", name: context.forge.name });
  }

  res.json({ ok: true, forgeId: context.forge.id });
});

forgeManagementRouter.post("/:id/leave", async (req, res) => {
  const context = await guard(req, res);
  if (!context) return;
  if (context.access.isOwner) {
    res.status(400).json({ error: "Owners cannot leave their own forge. Delete it instead." });
    return;
  }

  await prisma.forgeMember.delete({
    where: { userId_forgeId: { userId: req.user!.id, forgeId: context.forge.id } },
  });

  void evictFromRealtime(context.forge.id, req.user!.id);
  emitForgeEvent(context.forge.id, "forge:members", { action: "left", userId: req.user!.id });
  res.json({ ok: true, forgeId: context.forge.id });
});

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

forgeManagementRouter.post("/:id/channels", async (req, res) => {
  const parsed = createChannelSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const context = await guard(req, res, "manageChannels");
  if (!context) return;

  const count = await prisma.channel.count({ where: { forgeId: context.forge.id } });
  if (count >= 100) {
    res.status(400).json({ error: "Channel limit reached (100)" });
    return;
  }

  const last = await prisma.channel.findFirst({
    where: { forgeId: context.forge.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const name = parsed.data.type === "TEXT" || parsed.data.type === "ANNOUNCEMENT"
    ? parsed.data.name.toLowerCase().replace(/\s+/g, "-")
    : parsed.data.name;

  const linkError = await validateChannelLinks(context.forge.id, parsed.data.type, parsed.data);
  if (linkError) {
    res.status(400).json({ error: linkError });
    return;
  }

  const channel = await prisma.channel.create({
    data: {
      forgeId: context.forge.id,
      name,
      type: parsed.data.type,
      topic: parsed.data.type === "CATEGORY" ? null : parsed.data.topic,
      position: (last?.position ?? -1) + 1,
      parentId: parsed.data.type === "CATEGORY" ? null : parsed.data.parentId ?? null,
      slowmodeSeconds: parsed.data.slowmodeSeconds ?? 0,
      isPrivate: parsed.data.isPrivate ?? false,
      allowedRoleIds: [...new Set(parsed.data.allowedRoleIds ?? [])],
      allowedUserIds: [...new Set(parsed.data.allowedUserIds ?? [])],
    },
  });

  void logForgeAction(context.forge.id, req.user!.id, "channel.create", { type: "channel", id: channel.id, label: channel.name }, { type: channel.type, isPrivate: channel.isPrivate });
  if (channel.isPrivate) {
    // Only people who can see it hear about it.
    for (const userId of await privateChannelViewerIds(channel)) emitUserEvent(userId, "forge:channels", { forgeId: context.forge.id, action: "created", channel });
  } else {
    emitForgeEvent(context.forge.id, "forge:channels", { action: "created", channel });
  }
  res.status(201).json({ channel });
});

forgeManagementRouter.patch("/:id/channels/:channelId", async (req, res) => {
  const parsed = updateChannelSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const context = await guard(req, res, "manageChannels");
  if (!context) return;

  const existing = await prisma.channel.findFirst({
    where: { id: req.params.channelId, forgeId: context.forge.id },
  });
  if (!existing) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  const nextName = parsed.data.name
    ? existing.type === "TEXT" || existing.type === "ANNOUNCEMENT"
      ? parsed.data.name.toLowerCase().replace(/\s+/g, "-")
      : parsed.data.name
    : undefined;

  const linkError = await validateChannelLinks(context.forge.id, existing.type, parsed.data, existing.id);
  if (linkError) {
    res.status(400).json({ error: linkError });
    return;
  }

  const channel = await prisma.channel.update({
    where: { id: existing.id },
    data: {
      name: nextName,
      topic: parsed.data.topic,
      position: parsed.data.position,
      parentId: existing.type === "CATEGORY" ? undefined : parsed.data.parentId,
      slowmodeSeconds: parsed.data.slowmodeSeconds,
      isPrivate: parsed.data.isPrivate,
      allowedRoleIds: parsed.data.allowedRoleIds ? [...new Set(parsed.data.allowedRoleIds)] : undefined,
      allowedUserIds: parsed.data.allowedUserIds ? [...new Set(parsed.data.allowedUserIds)] : undefined,
    },
  });

  const changes: Record<string, unknown> = {};
  for (const key of Object.keys(parsed.data) as Array<keyof typeof parsed.data>) {
    const before = (existing as Record<string, unknown>)[key];
    const after = (channel as Record<string, unknown>)[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) changes[key] = { from: before ?? null, to: after ?? null };
  }
  if (Object.keys(changes).length) {
    void logForgeAction(context.forge.id, req.user!.id, "channel.update", { type: "channel", id: channel.id, label: channel.name }, changes);
  }

  // Everyone refetches the channel list (it's filtered per viewer); the payload itself
  // only goes out in full when the channel is public.
  emitForgeEvent(context.forge.id, "forge:channels", channel.isPrivate || existing.isPrivate ? { action: "refresh" } : { action: "updated", channel });
  void evictLostViewers(channel);
  res.json({ channel });
});

forgeManagementRouter.delete("/:id/channels/:channelId", async (req, res) => {
  const context = await guard(req, res, "manageChannels");
  if (!context) return;

  const existing = await prisma.channel.findFirst({
    where: { id: req.params.channelId, forgeId: context.forge.id },
    select: { id: true, type: true, name: true },
  });
  if (!existing) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  if (existing.type === "TEXT" || existing.type === "ANNOUNCEMENT") {
    const remainingText = await prisma.channel.count({
      where: { forgeId: context.forge.id, type: { in: ["TEXT", "ANNOUNCEMENT"] }, NOT: { id: existing.id } },
    });
    if (remainingText === 0) {
      res.status(400).json({ error: "A forge must keep at least one text channel" });
      return;
    }
  }

  await prisma.channel.delete({ where: { id: existing.id } });

  void logForgeAction(context.forge.id, req.user!.id, "channel.delete", { type: "channel", id: existing.id, label: existing.name }, { type: existing.type });
  emitForgeEvent(context.forge.id, "forge:channels", { action: "deleted", channelId: existing.id });
  res.json({ ok: true, channelId: existing.id });
});

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

forgeManagementRouter.post("/:id/roles", async (req, res) => {
  const parsed = createRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const context = await guard(req, res, "manageRoles");
  if (!context) return;

  const roleCount = await prisma.role.count({ where: { forgeId: context.forge.id } });
  if (roleCount >= 50) {
    res.status(400).json({ error: "Role limit reached (50)" });
    return;
  }

  // Default position: just below the actor's own top role (owner: below the Owner role).
  const defaultPosition = Math.max(0, Math.min(maxAssignableRolePosition, context.access.topPosition - 1));
  const position = parsed.data.position ?? defaultPosition;

  if (!canManageRolePosition(context.access, position)) {
    res.status(403).json({ error: "You can only create roles below your own highest role" });
    return;
  }

  const requested = normalizePermissions(parsed.data.permissions);
  // A member cannot grant permissions they do not hold themselves.
  for (const key of forgePermissionKeys) {
    if (requested[key] && !hasForgePermission(context.access, key)) {
      res.status(403).json({ error: `You cannot grant ${key} because you do not hold it` });
      return;
    }
  }

  const role = await prisma.role.create({
    data: {
      forgeId: context.forge.id,
      name: parsed.data.name,
      color: parsed.data.color.toLowerCase(),
      permissions: requested,
      position,
    },
  });

  void logForgeAction(context.forge.id, req.user!.id, "role.create", { type: "role", id: role.id, label: role.name }, { permissions: requested, position });
  emitForgeEvent(context.forge.id, "forge:roles", { action: "created", role });
  res.status(201).json({ role });
});

forgeManagementRouter.patch("/:id/roles/:roleId", async (req, res) => {
  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const context = await guard(req, res, "manageRoles");
  if (!context) return;

  const existing = await prisma.role.findFirst({ where: { id: req.params.roleId, forgeId: context.forge.id } });
  if (!existing) {
    res.status(404).json({ error: "Role not found" });
    return;
  }
  if (isProtectedOwnerRole(existing)) {
    res.status(403).json({ error: "The Owner role cannot be edited" });
    return;
  }
  if (!canManageRolePosition(context.access, existing.position)) {
    res.status(403).json({ error: "You can only edit roles below your own highest role" });
    return;
  }
  if (parsed.data.position !== undefined && !canManageRolePosition(context.access, parsed.data.position)) {
    res.status(403).json({ error: "You cannot move a role to or above your own highest role" });
    return;
  }

  let nextPermissions: ReturnType<typeof normalizePermissions> | undefined;
  if (parsed.data.permissions) {
    const current = normalizePermissions(existing.permissions);
    nextPermissions = { ...current, ...parsed.data.permissions } as ReturnType<typeof normalizePermissions>;
    for (const key of forgePermissionKeys) {
      if (nextPermissions[key] !== current[key] && !hasForgePermission(context.access, key)) {
        res.status(403).json({ error: `You cannot change ${key} because you do not hold it` });
        return;
      }
    }
  }

  const role = await prisma.role.update({
    where: { id: existing.id },
    data: {
      name: parsed.data.name,
      color: parsed.data.color?.toLowerCase(),
      permissions: nextPermissions,
      position: parsed.data.position,
    },
  });

  void logForgeAction(context.forge.id, req.user!.id, "role.update", { type: "role", id: role.id, label: role.name }, { changed: Object.keys(parsed.data), permissions: nextPermissions });
  emitForgeEvent(context.forge.id, "forge:roles", { action: "updated", role });
  // Role changes can open or close private channels; let clients refetch their list.
  emitForgeEvent(context.forge.id, "forge:channels", { action: "refresh" });
  res.json({ role });
});

forgeManagementRouter.delete("/:id/roles/:roleId", async (req, res) => {
  const context = await guard(req, res, "manageRoles");
  if (!context) return;

  const existing = await prisma.role.findFirst({ where: { id: req.params.roleId, forgeId: context.forge.id } });
  if (!existing) {
    res.status(404).json({ error: "Role not found" });
    return;
  }
  if (isProtectedOwnerRole(existing)) {
    res.status(403).json({ error: "The Owner role cannot be deleted" });
    return;
  }
  if (!canManageRolePosition(context.access, existing.position)) {
    res.status(403).json({ error: "You can only delete roles below your own highest role" });
    return;
  }

  await prisma.role.delete({ where: { id: existing.id } });

  void logForgeAction(context.forge.id, req.user!.id, "role.delete", { type: "role", id: existing.id, label: existing.name });
  emitForgeEvent(context.forge.id, "forge:roles", { action: "deleted", roleId: existing.id });
  emitForgeEvent(context.forge.id, "forge:channels", { action: "refresh" });
  emitForgeEvent(context.forge.id, "forge:members", { action: "roles-changed" });
  res.json({ ok: true, roleId: existing.id });
});

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

forgeManagementRouter.put("/:id/members/:userId/roles", async (req, res) => {
  const parsed = setMemberRolesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const context = await guard(req, res, "manageRoles");
  if (!context) return;

  const target = await prisma.forgeMember.findUnique({
    where: { userId_forgeId: { userId: req.params.userId, forgeId: context.forge.id } },
    include: { roleLinks: { include: { role: { select: { id: true, name: true, position: true } } } } },
  });
  if (!target) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  // Like kick and ban: you can only change the roles of someone you outrank.
  if (req.params.userId !== req.user!.id) {
    const targetAccess = resolveForgeAccess(
      context.forge.ownerId === req.params.userId,
      target.roleLinks.map((link) => ({ position: link.role.position, permissions: {} })),
    );
    if (!canModerateMember(context.access, targetAccess)) {
      res.status(403).json({ error: "You can't change roles for someone who outranks you" });
      return;
    }
  }

  const forgeRoles = await prisma.role.findMany({
    where: { forgeId: context.forge.id },
    select: { id: true, name: true, position: true },
  });
  const roleById = new Map<string, (typeof forgeRoles)[number]>(forgeRoles.map((role) => [role.id, role] as const));

  const requestedIds = new Set<string>(parsed.data.roleIds);
  for (const id of requestedIds) {
    if (!roleById.has(id)) {
      res.status(400).json({ error: `Unknown role: ${id}` });
      return;
    }
  }

  const currentIds = new Set<string>(target.roleLinks.map((link: { roleId: string }) => link.roleId));

  // Roles the actor is not allowed to touch stay exactly as they are.
  const keep = new Set<string>();
  for (const id of currentIds) {
    const role = roleById.get(id);
    if (!role || isProtectedOwnerRole(role) || !canManageRolePosition(context.access, role.position)) {
      keep.add(id);
    }
  }

  const finalIds = new Set<string>(keep);
  for (const id of requestedIds) {
    if (keep.has(id)) continue;
    const role = roleById.get(id)!;
    if (isProtectedOwnerRole(role) || !canManageRolePosition(context.access, role.position)) {
      res.status(403).json({ error: `You cannot assign the ${role.name} role` });
      return;
    }
    finalIds.add(id);
  }

  const toAdd = [...finalIds].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !finalIds.has(id));

  await prisma.$transaction([
    ...(toRemove.length
      ? [prisma.memberRole.deleteMany({ where: { forgeMemberId: target.id, roleId: { in: toRemove } } })]
      : []),
    ...(toAdd.length
      ? [prisma.memberRole.createMany({ data: toAdd.map((roleId) => ({ forgeMemberId: target.id, roleId })) })]
      : []),
  ]);

  if (toAdd.length || toRemove.length) {
    const names = (ids: string[]) => ids.map((id) => roleById.get(id)?.name ?? id);
    void logForgeAction(context.forge.id, req.user!.id, "member.roles", { type: "member", id: target.userId, label: await usernameOf(target.userId) }, { added: names(toAdd), removed: names(toRemove) });
    emitUserEvent(target.userId, "forge:channels", { forgeId: context.forge.id, action: "refresh" });
    if (toRemove.length) {
      // Losing a role can close private channels they're sitting in.
      const privateChannels = await prisma.channel.findMany({ where: { forgeId: context.forge.id, isPrivate: true }, select: { id: true, forgeId: true, isPrivate: true, allowedRoleIds: true, allowedUserIds: true } });
      const member = await loadMemberContext(target.userId, context.forge.id);
      const lost = privateChannels.filter((channel) => !canViewChannel(member, channel)).map((channel) => channel.id);
      evictUserFromChannels(target.userId, lost, { reason: "private" });
    }
  }
  emitForgeEvent(context.forge.id, "forge:members", { action: "roles-changed", userId: target.userId });
  res.json({ userId: target.userId, roleIds: [...finalIds] });
});

forgeManagementRouter.patch("/:id/members/:userId", async (req, res) => {
  const parsed = updateMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const context = await guard(req, res);
  if (!context) return;

  const isSelf = req.params.userId === req.user!.id;
  if (!isSelf) {
    if (!hasForgePermission(context.access, "manageRoles")) {
      res.status(403).json({ error: "Missing permission: manageRoles" });
      return;
    }
    const targetAccess = await loadTargetAccess(context.forge.id, context.forge.ownerId, req.params.userId);
    if (!targetAccess) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    if (!canModerateMember(context.access, targetAccess)) {
      res.status(403).json({ error: "You cannot change the nickname of a member who outranks you" });
      return;
    }
  }

  const member = await prisma.forgeMember.update({
    where: { userId_forgeId: { userId: req.params.userId, forgeId: context.forge.id } },
    data: { nickname: parsed.data.nickname || null },
    select: { id: true, userId: true, nickname: true },
  });

  if (!isSelf) {
    void logForgeAction(context.forge.id, req.user!.id, "member.nickname", { type: "member", id: member.userId, label: await usernameOf(member.userId) }, { nickname: member.nickname });
  }
  emitForgeEvent(context.forge.id, "forge:members", { action: "updated", userId: member.userId });
  res.json({ member });
});

// ---------------------------------------------------------------------------
// Timeouts: a timed-out member can read but can't send, react or join voice.
// ---------------------------------------------------------------------------

forgeManagementRouter.put("/:id/members/:userId/timeout", async (req, res) => {
  const parsed = timeoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const context = await guard(req, res, "moderateChat");
  if (!context) return;
  if (req.params.userId === req.user!.id) {
    res.status(400).json({ error: "You can't time yourself out" });
    return;
  }
  const targetAccess = await loadTargetAccess(context.forge.id, context.forge.ownerId, req.params.userId);
  if (!targetAccess) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  if (!canModerateMember(context.access, targetAccess)) {
    res.status(403).json({ error: "You can't time out someone who outranks you" });
    return;
  }

  const timeoutUntil = parsed.data.minutes ? new Date(Date.now() + parsed.data.minutes * 60_000) : null;
  await prisma.forgeMember.update({
    where: { userId_forgeId: { userId: req.params.userId, forgeId: context.forge.id } },
    data: { timeoutUntil },
  });

  const label = await usernameOf(req.params.userId);
  void logForgeAction(
    context.forge.id,
    req.user!.id,
    timeoutUntil ? "member.timeout" : "member.untimeout",
    { type: "member", id: req.params.userId, label },
    timeoutUntil ? { minutes: parsed.data.minutes, until: timeoutUntil.toISOString(), reason: parsed.data.reason ?? null } : undefined,
  );
  emitForgeEvent(context.forge.id, "forge:members", { action: "timeout", userId: req.params.userId, timeoutUntil });
  if (timeoutUntil) {
    const voiceChannels = await prisma.channel.findMany({ where: { forgeId: context.forge.id, type: { in: ["VOICE", "STAGE"] } }, select: { id: true } });
    evictUserFromChannels(req.params.userId, voiceChannels.map((channel) => channel.id), { voiceOnly: true, reason: "timeout" });
    void createNotification({
      userId: req.params.userId,
      type: "SYSTEM",
      title: "You were timed out",
      body: `You can't chat or talk in ${context.forge.name} until ${timeoutUntil.toUTCString()}.${parsed.data.reason ? ` Reason: ${parsed.data.reason}` : ""}`,
      data: { forgeId: context.forge.id, reason: "timeout", timeoutUntil: timeoutUntil.toISOString() },
    }).catch(() => undefined);
  }
  res.json({ userId: req.params.userId, timeoutUntil });
});

forgeManagementRouter.delete("/:id/members/:userId", async (req, res) => {
  const context = await guard(req, res, "kickUsers");
  if (!context) return;

  if (req.params.userId === req.user!.id) {
    res.status(400).json({ error: "Use leave to remove yourself" });
    return;
  }

  const targetAccess = await loadTargetAccess(context.forge.id, context.forge.ownerId, req.params.userId);
  if (!targetAccess) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  if (!canModerateMember(context.access, targetAccess)) {
    res.status(403).json({ error: "You cannot kick a member who outranks you" });
    return;
  }

  await prisma.forgeMember.delete({
    where: { userId_forgeId: { userId: req.params.userId, forgeId: context.forge.id } },
  });

  void evictFromRealtime(context.forge.id, req.params.userId);
  void usernameOf(req.params.userId).then((label) => logForgeAction(context.forge.id, req.user!.id, "member.kick", { type: "member", id: req.params.userId, label }));
  emitForgeEvent(context.forge.id, "forge:members", { action: "kicked", userId: req.params.userId });
  emitUserEvent(req.params.userId, "forge:removed", { forgeId: context.forge.id, reason: "kicked", name: context.forge.name });
  void createNotification({
    userId: req.params.userId,
    type: "SYSTEM",
    title: "Removed from forge",
    body: `You were removed from ${context.forge.name}.`,
    data: { forgeId: context.forge.id, reason: "kicked" },
  }).catch(() => undefined);

  res.json({ ok: true, userId: req.params.userId });
});

// ---------------------------------------------------------------------------
// Bans
// ---------------------------------------------------------------------------

forgeManagementRouter.get("/:id/bans", async (req, res) => {
  const context = await guard(req, res, "banUsers");
  if (!context) return;

  const bans = await prisma.forgeBan.findMany({
    where: { forgeId: context.forge.id },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, username: true, avatar: true } },
      bannedBy: { select: { id: true, username: true } },
    },
  });

  res.json({ bans });
});

forgeManagementRouter.post("/:id/bans", async (req, res) => {
  const parsed = createBanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const context = await guard(req, res, "banUsers");
  if (!context) return;

  const targetId = parsed.data.userId;
  if (targetId === req.user!.id) {
    res.status(400).json({ error: "You cannot ban yourself" });
    return;
  }
  if (targetId === context.forge.ownerId) {
    res.status(403).json({ error: "The forge owner cannot be banned" });
    return;
  }

  const targetUser = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, username: true } });
  if (!targetUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const targetAccess = await loadTargetAccess(context.forge.id, context.forge.ownerId, targetId);
  if (targetAccess && !canModerateMember(context.access, targetAccess)) {
    res.status(403).json({ error: "You cannot ban a member who outranks you" });
    return;
  }

  const ban = await prisma.$transaction(async (tx) => {
    if (targetAccess) {
      await tx.forgeMember.delete({ where: { userId_forgeId: { userId: targetId, forgeId: context.forge.id } } });
    }
    return tx.forgeBan.upsert({
      where: { forgeId_userId: { forgeId: context.forge.id, userId: targetId } },
      update: { reason: parsed.data.reason ?? null, bannedById: req.user!.id },
      create: { forgeId: context.forge.id, userId: targetId, reason: parsed.data.reason, bannedById: req.user!.id },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
        bannedBy: { select: { id: true, username: true } },
      },
    });
  });

  void evictFromRealtime(context.forge.id, targetId);
  void logForgeAction(context.forge.id, req.user!.id, "ban.create", { type: "member", id: targetId, label: targetUser.username }, { reason: parsed.data.reason ?? null });
  emitForgeEvent(context.forge.id, "forge:members", { action: "banned", userId: targetId });
  emitForgeEvent(context.forge.id, "forge:bans", { action: "created", ban });
  if (targetAccess) {
    emitUserEvent(targetId, "forge:removed", { forgeId: context.forge.id, reason: "banned", name: context.forge.name });
    void createNotification({
      userId: targetId,
      type: "SYSTEM",
      title: "Banned from forge",
      body: parsed.data.reason
        ? `You were banned from ${context.forge.name}: ${parsed.data.reason}`
        : `You were banned from ${context.forge.name}.`,
      data: { forgeId: context.forge.id, reason: "banned" },
    }).catch(() => undefined);
  }

  res.status(201).json({ ban });
});

forgeManagementRouter.delete("/:id/bans/:userId", async (req, res) => {
  const context = await guard(req, res, "banUsers");
  if (!context) return;

  const existing = await prisma.forgeBan.findUnique({
    where: { forgeId_userId: { forgeId: context.forge.id, userId: req.params.userId } },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: "Ban not found" });
    return;
  }

  await prisma.forgeBan.delete({ where: { id: existing.id } });

  void usernameOf(req.params.userId).then((label) => logForgeAction(context.forge.id, req.user!.id, "ban.delete", { type: "member", id: req.params.userId, label }));
  emitForgeEvent(context.forge.id, "forge:bans", { action: "deleted", userId: req.params.userId });
  res.json({ ok: true, userId: req.params.userId });
});
