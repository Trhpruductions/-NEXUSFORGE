import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { createNotification } from "../lib/notifications.js";
import { getIo } from "../lib/realtime.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import {
  canManageRolePosition,
  canModerateMember,
  forgePermissionKeys,
  hasForgePermission,
  isProtectedOwnerRole,
  maxAssignableRolePosition,
  normalizePermissions,
  resolveForgeAccess,
  type ForgePermissionKey,
  type ResolvedForgeAccess,
} from "../lib/forge-permissions.js";

/**
 * Forge management: settings, channels, roles, members, bans, leave/delete.
 * Mounted at /api/forges alongside forgesRouter; every route here is scoped to /:id/...
 */
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

const createChannelSchema = z.object({
  name: channelNameSchema,
  type: z.enum(["TEXT", "VOICE", "ANNOUNCEMENT", "STAGE"]).default("TEXT"),
  topic: z.string().trim().max(240).optional(),
});

const updateChannelSchema = z
  .object({
    name: channelNameSchema.optional(),
    topic: z.string().trim().max(240).nullable().optional(),
    position: z.number().int().min(0).max(500).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied." });

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
  res.json({ forge });
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

  const channel = await prisma.channel.create({
    data: {
      forgeId: context.forge.id,
      name,
      type: parsed.data.type,
      topic: parsed.data.topic,
      position: (last?.position ?? -1) + 1,
    },
  });

  emitForgeEvent(context.forge.id, "forge:channels", { action: "created", channel });
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

  const channel = await prisma.channel.update({
    where: { id: existing.id },
    data: {
      name: nextName,
      topic: parsed.data.topic,
      position: parsed.data.position,
    },
  });

  emitForgeEvent(context.forge.id, "forge:channels", { action: "updated", channel });
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

  emitForgeEvent(context.forge.id, "forge:roles", { action: "updated", role });
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

  emitForgeEvent(context.forge.id, "forge:roles", { action: "deleted", roleId: existing.id });
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

  emitForgeEvent(context.forge.id, "forge:members", { action: "updated", userId: member.userId });
  res.json({ member });
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

  emitForgeEvent(context.forge.id, "forge:bans", { action: "deleted", userId: req.params.userId });
  res.json({ ok: true, userId: req.params.userId });
});
