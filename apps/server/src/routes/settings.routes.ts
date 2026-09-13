import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, comparePassword } from "../lib/password.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { issueCode, verifyCode } from "../lib/verification.js";

/** Account, privacy, and linked-account settings for the signed-in user. */
export const settingsRouter = Router();

settingsRouter.use(requireAuth);
settingsRouter.use(requireCsrf);

export const privacySchema = z.object({
  showOnlineStatus: z.boolean().default(true),
  allowFriendRequests: z.boolean().default(true),
  allowDmsFromFriends: z.boolean().default(true),
  allowDmsFromMembers: z.boolean().default(true),
  showActivity: z.boolean().default(true),
  showJoinedServers: z.boolean().default(false),
  contentFilter: z.enum(["off", "friends", "everyone"]).default("everyone"),
});

export type PrivacySettings = z.infer<typeof privacySchema>;

export const preferencesSchema = z.object({
  notifications: z
    .object({
      mentions: z.boolean().default(true),
      directMessages: z.boolean().default(true),
      friendRequests: z.boolean().default(true),
      eventReminders: z.boolean().default(true),
      liveAlerts: z.boolean().default(true),
      system: z.boolean().default(true),
      sounds: z.boolean().default(true),
      push: z.boolean().default(true),
    })
    .prefault({}),
  appearance: z
    .object({
      accent: z.enum(["gold", "ember", "ice", "violet"]).default("gold"),
      density: z.enum(["cozy", "compact"]).default("cozy"),
      fontScale: z.enum(["small", "default", "large"]).default("default"),
      reduceMotion: z.boolean().default(false),
      showAvatarsInChat: z.boolean().default(true),
    })
    .prefault({}),
  voice: z
    .object({
      inputDeviceId: z.string().max(200).nullable().default(null),
      outputDeviceId: z.string().max(200).nullable().default(null),
      inputMode: z.enum(["voice", "ptt"]).default("voice"),
      inputVolume: z.number().int().min(0).max(100).default(100),
      outputVolume: z.number().int().min(0).max(100).default(100),
      noiseSuppression: z.boolean().default(true),
      echoCancellation: z.boolean().default(true),
      cameraDeviceId: z.string().max(200).nullable().default(null),
    })
    .prefault({}),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export function parsePreferences(raw: unknown): Preferences {
  const parsed = preferencesSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : preferencesSchema.parse({});
}

const accountSchema = z
  .object({
    displayName: z.string().trim().max(40).nullable().optional(),
    email: z.string().email().optional(),
    bio: z.string().trim().max(512).nullable().optional(),
    clanTag: z.string().trim().max(12).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied." });

const passwordSchema = z.object({
  currentPassword: z.string().min(8).max(72),
  newPassword: z.string().min(8).max(72),
  code: z.string().trim().regex(/^\d{6}$/).optional(),
});

/** For accounts with two-factor on, password and email changes need a fresh code from a verified channel. */
async function requireSensitiveCode(userId: string, code: string | undefined): Promise<{ ok: true } | { ok: false; error: string; needsCode: boolean }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorEnabled: true } });
  if (!user?.twoFactorEnabled) return { ok: true };
  if (!code) return { ok: false, error: "Enter the confirmation code we sent you", needsCode: true };
  const check = await verifyCode({ userId, purpose: "SENSITIVE_CHANGE", code });
  return check.ok ? { ok: true } : { ok: false, error: check.error, needsCode: true };
}

const linkedAccountsSchema = z.object({
  discord: z.string().trim().max(80).nullable().optional(),
  x: z.string().trim().max(80).nullable().optional(),
  instagram: z.string().trim().max(80).nullable().optional(),
  kick: z.string().trim().max(80).nullable().optional(),
  youtube: z.string().trim().max(120).nullable().optional(),
  twitch: z.string().trim().max(80).nullable().optional(),
});

settingsRouter.get("/", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      emailVerified: true,
      bio: true,
      clanTag: true,
      avatar: true,
      banner: true,
      appRole: true,
      premiumTier: true,
      twoFactorEnabled: true,
      socialLinks: true,
      privacySettings: true,
      preferences: true,
      createdAt: true,
      refreshTokens: { where: { revokedAt: null }, select: { id: true, createdAt: true, expiresAt: true }, orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const privacy = privacySchema.safeParse(user.privacySettings ?? {});
  res.json({
    account: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      emailVerified: user.emailVerified,
      bio: user.bio,
      clanTag: user.clanTag,
      avatar: user.avatar,
      banner: user.banner,
      appRole: user.appRole,
      premiumTier: user.premiumTier,
      createdAt: user.createdAt,
    },
    privacy: privacy.success ? privacy.data : privacySchema.parse({}),
    preferences: parsePreferences(user.preferences),
    linkedAccounts: (user.socialLinks as Record<string, string | null> | null) ?? {},
    sessions: user.refreshTokens,
    twoFactor: { enabled: user.twoFactorEnabled, available: true },
  });
});

/** Sends a SENSITIVE_CHANGE code to every verified channel. */
settingsRouter.post("/sensitive-challenge", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, email: true, emailVerified: true, phoneNumber: true, phoneVerified: true } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const sends = await Promise.all([
    user.emailVerified ? issueCode({ userId: user.id, channel: "EMAIL", purpose: "SENSITIVE_CHANGE", target: user.email }) : null,
    user.phoneVerified && user.phoneNumber ? issueCode({ userId: user.id, channel: "SMS", purpose: "SENSITIVE_CHANGE", target: user.phoneNumber }) : null,
  ]);
  const delivered = sends.filter((entry) => entry?.ok);
  if (!delivered.length) {
    const failed = sends.find((entry) => entry && !entry.ok);
    res.status(failed?.retryAfterSeconds ? 429 : 400).json({ error: failed?.error ?? "Verify your email or phone first" });
    return;
  }
  res.json({ ok: true, devCode: delivered.find((entry) => entry?.devCode)?.devCode });
});

settingsRouter.patch("/account", async (req, res) => {
  const parsed = accountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  if (parsed.data.email) {
    const gate = await requireSensitiveCode(req.user!.id, typeof req.body?.code === "string" ? req.body.code : undefined);
    if (!gate.ok) {
      res.status(403).json({ error: gate.error, needsCode: gate.needsCode });
      return;
    }
    const taken = await prisma.user.findFirst({ where: { email: parsed.data.email.toLowerCase(), id: { not: req.user!.id } }, select: { id: true } });
    if (taken) {
      res.status(409).json({ error: "That email is already in use" });
      return;
    }
  }
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      displayName: parsed.data.displayName === undefined ? undefined : parsed.data.displayName || null,
      email: parsed.data.email?.toLowerCase(),
      emailVerified: parsed.data.email ? false : undefined,
      bio: parsed.data.bio === undefined ? undefined : parsed.data.bio || null,
      clanTag: parsed.data.clanTag === undefined ? undefined : parsed.data.clanTag || null,
    },
    select: { id: true, username: true, displayName: true, email: true, emailVerified: true, bio: true, clanTag: true },
  });
  res.json({ account: user });
});

settingsRouter.put("/privacy", async (req, res) => {
  const parsed = privacySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  await prisma.user.update({ where: { id: req.user!.id }, data: { privacySettings: parsed.data } });
  res.json({ privacy: parsed.data });
});

settingsRouter.put("/preferences", async (req, res) => {
  const current = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { preferences: true } });
  const base = parsePreferences(current?.preferences);
  const incoming = (req.body ?? {}) as Partial<Record<keyof Preferences, Record<string, unknown>>>;
  const merged = {
    notifications: { ...base.notifications, ...(incoming.notifications ?? {}) },
    appearance: { ...base.appearance, ...(incoming.appearance ?? {}) },
    voice: { ...base.voice, ...(incoming.voice ?? {}) },
  };
  const parsed = preferencesSchema.safeParse(merged);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  await prisma.user.update({ where: { id: req.user!.id }, data: { preferences: parsed.data } });
  res.json({ preferences: parsed.data });
});

settingsRouter.put("/linked-accounts", async (req, res) => {
  const parsed = linkedAccountsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const current = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { socialLinks: true } });
  const merged: Record<string, string | null> = { ...((current?.socialLinks as Record<string, string | null> | null) ?? {}) };
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;
    if (value) merged[key] = value.replace(/^@/, "");
    else delete merged[key];
  }
  await prisma.user.update({ where: { id: req.user!.id }, data: { socialLinks: merged } });
  res.json({ linkedAccounts: merged });
});

settingsRouter.post("/password", async (req, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { password: true } });
  if (!user || !(await comparePassword(parsed.data.currentPassword, user.password))) {
    res.status(403).json({ error: "Current password is incorrect" });
    return;
  }
  if (parsed.data.currentPassword === parsed.data.newPassword) {
    res.status(400).json({ error: "Choose a different password" });
    return;
  }
  const gate = await requireSensitiveCode(req.user!.id, parsed.data.code);
  if (!gate.ok) {
    res.status(403).json({ error: gate.error, needsCode: gate.needsCode });
    return;
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: req.user!.id }, data: { password: await hashPassword(parsed.data.newPassword) } }),
    // Sign out every other device.
    prisma.refreshToken.updateMany({ where: { userId: req.user!.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  res.json({ ok: true, message: "Password updated. Other sessions were signed out." });
});

settingsRouter.delete("/sessions/:id", async (req, res) => {
  const result = await prisma.refreshToken.updateMany({
    where: { id: req.params.id, userId: req.user!.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!result.count) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ ok: true });
});
