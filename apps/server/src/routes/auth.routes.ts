import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { comparePassword, hashPassword } from "../lib/password.js";
import { randomToken, sha256, signAccessToken } from "../lib/jwt.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { billingEnforced, hasActiveFeatureEntitlement } from "../middleware/entitlements.js";
import { csrfCookieName } from "../middleware/csrf.js";
import { anonymizeIP } from "../lib/ip-security.js";
import { sendEmail } from "../lib/delivery.js";
import { limitsForUser, messageLengthProblem } from "../lib/user-limits.js";
import { upgradeRequired } from "../lib/plans.js";
import { AuditOperation, AuditStatus } from "@prisma/client";
import { getAuditLogger } from "../utils/audit-logger.js";
import jwt from "jsonwebtoken";
import { issueCode, verifyCode, maskEmail, maskPhone } from "../lib/verification.js";
import { checkSecondFactor } from "../lib/second-factor.js";
import { currentRequiredPolicies, recordAcceptances } from "../lib/legal-policies.js";
import { missingSignupAcceptances } from "../lib/legal-rules.js";
import { isAdult as isAdultBirthdate } from "../lib/age-verification.js";
import { alertIfNewDevice, deviceContext, type DeviceContext } from "../lib/sessions.js";
import { currentSuspension, suspendedResponse } from "../lib/account-suspension.js";

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  birthdate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  /** Exact published versions of the required policies the person ticked to accept. */
  acceptedPolicyVersionIds: z.array(z.string().uuid()).max(20).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string().min(20),
  newPassword: z.string().min(8).max(72),
});

const updateMeSchema = z.object({
  username: z.string().min(3).max(32).optional(),
  avatar: z.string().url().nullable().optional(),
  banner: z.string().url().nullable().optional(),
  bio: z.string().max(512).nullable().optional(),
  clanTag: z.string().max(12).nullable().optional(),
  status: z.enum(["ONLINE", "IDLE", "DND", "OFFLINE"]).optional(),
  currentActivity: z.string().max(120).nullable().optional(),
  activityDetails: z.string().max(240).nullable().optional(),
});

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  deviceName: z.string().max(80).optional(),
  platform: z.string().max(40).optional(),
});

const activateCorePlusSchema = z.object({
  tier: z.enum(["CORE", "PLUS", "ELITE", "INFINITE"]).optional(),
});

export const REFRESH_COOKIE_NAME = "nf_refresh";
/** Two tabs refreshing at the same moment both present the same token; that is not theft. */
const REFRESH_REUSE_GRACE_MS = 30_000;

export const authRouter = Router();

const privilegedRoles = new Set(["ADMIN", "EXEC", "OWNER"]);

function hasAdminAccess(role: string | null | undefined, isAdmin: boolean): boolean {
  return isAdmin || (role ? privilegedRoles.has(role) : false);
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

function csrfCookieOptions() {
  return {
    httpOnly: false,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

type SessionCarry = { sessionId: string; signedInAt: Date; deviceLabel: string | null; userAgent: string | null };

/**
 * Issues an access token and a refresh token. Without `carry` this starts a new session
 * (sign-in); with it, the new refresh token continues an existing session (rotation).
 */
async function issueTokens(
  user: { id: string; username: string; email: string; appRole?: "USER" | "MODERATOR" | "ADMIN" | "EXEC" | "OWNER" },
  ctx: DeviceContext,
  carry?: SessionCarry,
) {
  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    email: user.email,
    appRole: user.appRole,
    jti: randomToken(16), // Entropy for the access token id
  });

  const refreshToken = randomToken();
  const tokenHash = sha256(refreshToken);

  const now = new Date();
  const sessionId = carry?.sessionId ?? randomUUID();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000),
      sessionId,
      signedInAt: carry?.signedInAt ?? now,
      lastUsedAt: now,
      // A session keeps the device it signed in on; the network can change.
      deviceLabel: carry?.deviceLabel ?? ctx.deviceLabel,
      userAgent: carry?.userAgent ?? ctx.userAgent,
      ipPrefix: ctx.ipPrefix,
    },
  });

  return { accessToken, refreshToken, sessionId };
}

async function logSessionRevocation(input: {
  sessionId: string;
  userId: string;
  reason: string;
  req: any;
  metadata?: Record<string, unknown>;
}) {
  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      operation: AuditOperation.DELETE,
      resourceType: "Session",
      resourceId: input.sessionId,
      actorId: input.userId,
      status: AuditStatus.SUCCESS,
      ipAddress: anonymizeIP(input.req.ip || "unknown"),
      userAgent: input.req.get?.("user-agent") || undefined,
      endpoint: input.req.originalUrl || input.req.url,
      method: input.req.method,
      metadata: {
        reason: input.reason,
        sessionRevokedAt: new Date().toISOString(),
        ...input.metadata,
      },
    });
  } catch (error) {
    console.error("Failed to log session revocation:", error);
  }
}

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const username = parsed.data.username.trim();

  // Age Verification Logic
  const birthDate = new Date(parsed.data.birthdate);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age < 18) {
    res.status(403).json({ error: "Access denied. You must be at least 18 years old to create an account." });
    return;
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  });

  if (existing) {
    res.status(409).json({ error: "Email or username already in use" });
    return;
  }

  // Every published policy that's required at sign-up must have been explicitly accepted,
  // by its exact current version (a stale page can't accept an outdated version).
  const requiredPolicies = await currentRequiredPolicies();
  const missingPolicies = missingSignupAcceptances(requiredPolicies, parsed.data.acceptedPolicyVersionIds ?? []);
  if (missingPolicies.length) {
    res.status(400).json({ error: "Please read and accept the Terms of Service and Privacy Policy to continue.", missingPolicies, required: requiredPolicies });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const emailVerifyToken = randomToken(24);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: passwordHash,
      birthdate: birthDate,
      ageVerified: true,
      ageVerificationLevel: "ATTESTED",
      ageVerifiedAt: new Date(),
      corePlusBoostLevel: 3,
      emailVerifyToken: sha256(emailVerifyToken),
      emailVerifyExpires: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
    select: {
      id: true,
      username: true,
      email: true,
      premium: true,
      premiumTier: true,
      corePlusActivatedAt: true,
      corePlusBoostLevel: true,
      corePlusStreakDays: true,
      appRole: true,
      createdAt: true,
      emailVerified: true,
      isAdmin: true,
      ageVerified: true,
    },
  });

  if (requiredPolicies.length) {
    await recordAcceptances(user.id, requiredPolicies.map((policy) => policy.versionId), "SIGNUP");
  }

  const emailCode = await issueCode({ userId: user.id, channel: "EMAIL", purpose: "VERIFY_EMAIL", target: user.email });
  const tokens = await issueTokens(user, deviceContext(req));
  const csrfToken = randomToken(16);
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions());
  res.cookie(csrfCookieName(), csrfToken, csrfCookieOptions());

  res.status(201).json({
    accessToken: tokens.accessToken,
    csrfToken,
    user: {
      ...user,
      isAdmin: hasAdminAccess(user.appRole, user.isAdmin),
    },
    verification: {
      message: emailCode.ok ? "We sent a 6-digit code to your email" : "Email verification is pending",
      sentTo: maskEmail(user.email),
      delivered: emailCode.ok,
      devCode: emailCode.devCode,
    },
  });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const validPassword = await comparePassword(parsed.data.password, user.password);
  if (!validPassword) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.birthdate && !isAdultBirthdate(user.birthdate)) {
    res.status(403).json({ error: "This account is registered to someone under 18 and cannot sign in.", underage: true });
    return;
  }

  const suspension = await currentSuspension(user.id);
  if (suspension) {
    res.status(403).json(suspendedResponse(suspension));
    return;
  }

  if (user.totpEnabledAt) {
    const token = jwt.sign({ sub: user.id, purpose: "2fa", method: "totp" }, env.JWT_ACCESS_SECRET, { expiresIn: "10m" });
    res.json({ requiresTwoFactor: true, challengeToken: token, method: "totp", channels: ["Authenticator app"] });
    return;
  }

  if (user.twoFactorEnabled) {
    const challenge = await startTwoFactorChallenge(user);
    if (!challenge.ok) {
      res.status(503).json({ error: challenge.error ?? "Could not send your sign-in code. Try again shortly." });
      return;
    }
    res.json({ requiresTwoFactor: true, challengeToken: challenge.token, channels: challenge.channels, devCode: challenge.devCode });
    return;
  }

  const ctx = deviceContext(req);
  const tokens = await issueTokens(user, ctx);
  void alertIfNewDevice(user, ctx, tokens.sessionId).catch((error) => console.error("[AUTH] new-device alert failed", error));
  const csrfToken = randomToken(16);

  // Auditing: Log anonymized IP (Unreversible protection)
  const secureIP = anonymizeIP(req.ip || "unknown");
  console.log(`[AUTH] User ${user.id} logged in. Secure-IP: ${secureIP}`);

  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions());
  res.cookie(csrfCookieName(), csrfToken, csrfCookieOptions());

  res.json({
    accessToken: tokens.accessToken,
    csrfToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      banner: user.banner,
      bio: user.bio,
      status: user.status,
      premium: user.premium,
      premiumTier: user.premiumTier,
      corePlusActivatedAt: user.corePlusActivatedAt,
      corePlusBoostLevel: user.corePlusBoostLevel,
      corePlusStreakDays: user.corePlusStreakDays,
      appRole: user.appRole,
      createdAt: user.createdAt,
      emailVerified: user.emailVerified,
      deletionScheduledFor: user.deletionScheduledFor,
      isAdmin: hasAdminAccess(user.appRole, user.isAdmin),
    },
  })
});

type TwoFactorUser = { id: string; email: string; phoneNumber: string | null; twoFactorChannels: string[] };

async function startTwoFactorChallenge(user: TwoFactorUser) {
  const channels = user.twoFactorChannels.length ? user.twoFactorChannels : ["EMAIL"];
  const sends = await Promise.all(
    channels.map((channel) =>
      channel === "SMS" && user.phoneNumber
        ? issueCode({ userId: user.id, channel: "SMS", purpose: "LOGIN", target: user.phoneNumber })
        : issueCode({ userId: user.id, channel: "EMAIL", purpose: "LOGIN", target: user.email }),
    ),
  );
  const delivered = sends.filter((entry) => entry.ok);
  if (!delivered.length) {
    return { ok: false as const, error: sends[0]?.error };
  }
  const token = jwt.sign({ sub: user.id, purpose: "2fa" }, env.JWT_ACCESS_SECRET, { expiresIn: "10m" });
  return {
    ok: true as const,
    token,
    channels: channels.map((channel) => (channel === "SMS" && user.phoneNumber ? `SMS to ${maskPhone(user.phoneNumber)}` : `Email to ${maskEmail(user.email)}`)),
    devCode: delivered.find((entry) => entry.devCode)?.devCode,
  };
}

function readChallenge(token: unknown): string | null {
  if (typeof token !== "string") return null;
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub?: string; purpose?: string };
    return payload.purpose === "2fa" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

const twoFactorVerifySchema = z.object({
  challengeToken: z.string().min(10),
  // 6 digits, or an authenticator recovery code like "k7xm-q2pd".
  code: z.string().trim().regex(/^(\d{6}|[a-z0-9]{4}-?[a-z0-9]{4})$/i),
});

authRouter.post("/2fa/verify", async (req, res) => {
  const parsed = twoFactorVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter the 6-digit code" });
    return;
  }
  const userId = readChallenge(parsed.data.challengeToken);
  if (!userId) {
    res.status(401).json({ error: "Your sign-in window expired. Sign in again." });
    return;
  }
  const pending = await prisma.user.findUnique({ where: { id: userId }, select: { totpEnabledAt: true } });
  let recoveryCodesLeft: number | undefined;
  if (pending?.totpEnabledAt) {
    const factor = await checkSecondFactor(userId, parsed.data.code);
    if (!factor.ok) {
      res.status(factor.status).json({ error: factor.error });
      return;
    }
    if (factor.usedRecoveryCode) recoveryCodesLeft = factor.recoveryCodesLeft;
  } else {
    const check = await verifyCode({ userId, purpose: "LOGIN", code: parsed.data.code });
    if (!check.ok) {
      res.status(400).json({ error: check.error, attemptsLeft: check.attemptsLeft });
      return;
    }
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const suspension = await currentSuspension(user.id);
  if (suspension) {
    res.status(403).json(suspendedResponse(suspension));
    return;
  }

  const ctx = deviceContext(req);
  const tokens = await issueTokens(user, ctx);
  void alertIfNewDevice(user, ctx, tokens.sessionId).catch((error) => console.error("[AUTH] new-device alert failed", error));
  const csrfToken = randomToken(16);
  console.log(`[AUTH] User ${user.id} completed two-factor sign-in. Secure-IP: ${anonymizeIP(req.ip || "unknown")}`);
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions());
  res.cookie(csrfCookieName(), csrfToken, csrfCookieOptions());
  res.json({
    accessToken: tokens.accessToken,
    csrfToken,
    ...(recoveryCodesLeft !== undefined ? { recoveryCodesLeft } : {}),
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      banner: user.banner,
      bio: user.bio,
      status: user.status,
      premium: user.premium,
      premiumTier: user.premiumTier,
      corePlusActivatedAt: user.corePlusActivatedAt,
      corePlusBoostLevel: user.corePlusBoostLevel,
      corePlusStreakDays: user.corePlusStreakDays,
      appRole: user.appRole,
      createdAt: user.createdAt,
      emailVerified: user.emailVerified,
      deletionScheduledFor: user.deletionScheduledFor,
      isAdmin: hasAdminAccess(user.appRole, user.isAdmin),
    },
  });
});

authRouter.post("/2fa/resend", async (req, res) => {
  const userId = readChallenge(req.body?.challengeToken);
  if (!userId) {
    res.status(401).json({ error: "Your sign-in window expired. Sign in again." });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, phoneNumber: true, twoFactorChannels: true, totpEnabledAt: true } });
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (user.totpEnabledAt) {
    res.status(400).json({ error: "Open your authenticator app for the code, or use one of your recovery codes." });
    return;
  }
  const challenge = await startTwoFactorChallenge(user);
  if (!challenge.ok) {
    res.status(429).json({ error: challenge.error ?? "Please wait before requesting another code" });
    return;
  }
  res.json({ ok: true, challengeToken: challenge.token, channels: challenge.channels, devCode: challenge.devCode });
});

authRouter.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!refreshToken) {
    res.status(401).json({ error: "Missing refresh token" });
    return;
  }

  const tokenHash = sha256(refreshToken);
  const session = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  // Reuse detection: every refresh replaces the token, so an old (already replaced) token
  // turning up again means it was copied. End that whole session on every device. A reuse
  // within a few seconds is just two tabs refreshing at once, so that only gets a 401.
  if (session?.revokedAt && Date.now() - session.revokedAt.getTime() > REFRESH_REUSE_GRACE_MS) {
    const family = session.sessionId ?? session.id;
    const ended = await prisma.refreshToken.updateMany({
      where: { userId: session.userId, OR: [{ sessionId: family }, { id: family }], revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (ended.count) console.warn(`[AUTH] Reused refresh token for user ${session.userId}: session ${family} ended (${ended.count} token(s) revoked).`);
  }

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }
  const suspension = await currentSuspension(session.userId);
  if (suspension) {
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
    res.status(403).json(suspendedResponse(suspension));
    return;
  }

  await prisma.refreshToken.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  await logSessionRevocation({
    sessionId: session.id,
    userId: session.userId,
    reason: "refresh_rotation",
    req,
    metadata: {
      flow: "refresh",
      tokenRotation: true,
    },
  });

  // Same session, new token. Rows from before sessions were tracked start their chain here.
  const tokens = await issueTokens(session.user, deviceContext(req), {
    sessionId: session.sessionId ?? session.id,
    signedInAt: session.signedInAt ?? session.createdAt,
    deviceLabel: session.deviceLabel,
    userAgent: session.userAgent,
  });
  const csrfToken = randomToken(16);
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions());
  res.cookie(csrfCookieName(), csrfToken, csrfCookieOptions());
  res.json({ accessToken: tokens.accessToken, csrfToken });
});

authRouter.post("/logout", async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;

  if (refreshToken) {
    const tokenHash = sha256(refreshToken);
    const session = await prisma.refreshToken.findFirst({
      where: { tokenHash },
      select: { id: true, userId: true },
    });

    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (session) {
      await logSessionRevocation({
        sessionId: session.id,
        userId: session.userId,
        reason: "logout",
        req,
        metadata: {
          flow: "logout",
        },
      });
    }
  }

  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
  res.clearCookie(csrfCookieName(), csrfCookieOptions());
  res.status(204).send();
});

authRouter.post("/verify-email", async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Token is required" });
    return;
  }

  const tokenHash = sha256(token);
  const user = await prisma.user.findFirst({
    where: {
      emailVerifyToken: tokenHash,
      emailVerifyExpires: { gt: new Date() },
    },
  });

  if (!user) {
    res.status(400).json({ error: "Invalid or expired verification token" });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpires: null,
    },
  });

  res.json({ message: "Email verified successfully" });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      banner: true,
      bio: true,
      status: true,
      premium: true,
      premiumTier: true,
      corePlusActivatedAt: true,
      corePlusBoostLevel: true,
      corePlusStreakDays: true,
      clanTag: true,
      currentActivity: true,
      activityDetails: true,
      lastSeenAt: true,
      createdAt: true,
      emailVerified: true,
      appRole: true,
      isAdmin: true,
      birthdate: true,
      ageVerificationLevel: true,
      onboardedAt: true,
      deletionScheduledFor: true,
      economyAccounts: {
        select: {
          currencyType: true,
          balance: true,
        }
      },
    },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    user: {
      ...user,
      birthdate: undefined,
      hasBirthdate: Boolean(user.birthdate),
      onboarded: Boolean(user.onboardedAt),
      economyAccounts: user.economyAccounts.map((account) => ({ currencyType: account.currencyType, balance: account.balance.toString() })),
      isAdmin: hasAdminAccess(user.appRole, user.isAdmin),
    },
  });
});

authRouter.patch("/me", requireAuth, async (req, res) => {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const betaCosmeticsBypassUsers = new Set(["jacksongaming69"]);
  const requester = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { username: true },
  });
  const isBetaCosmeticsBypass = requester ? betaCosmeticsBypassUsers.has(requester.username.toLowerCase()) : false;

  const wantsBanner = Boolean(parsed.data.banner);
  const wantsAnimatedAvatar = typeof parsed.data.avatar === "string" && /\.gif(\?|$)/i.test(parsed.data.avatar);
  if ((wantsBanner || wantsAnimatedAvatar) && !isBetaCosmeticsBypass) {
    const limits = await limitsForUser(req.user!.id);
    const allowed = (wantsBanner ? limits.profileBanner : true) && (wantsAnimatedAvatar ? limits.animatedAvatar : true);
    if (!allowed && !(await hasActiveFeatureEntitlement(req.user!.id, "TEAM_BRANDING_KIT"))) {
      res.status(402).json(upgradeRequired(
        wantsBanner ? "A profile banner is a Core+ perk." : "Animated avatars are a Core+ perk.",
        wantsBanner ? "PROFILE_BANNER" : "ANIMATED_AVATAR",
        "CORE",
      ));
      return;
    }
  }

  if (parsed.data.username) {
    const taken = await prisma.user.findFirst({
      where: {
        username: parsed.data.username.trim(),
        id: { not: req.user!.id },
      },
    });

    if (taken) {
      res.status(409).json({ error: "Username already in use" });
      return;
    }
  }

  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      ...(parsed.data.username ? { username: parsed.data.username.trim() } : {}),
      ...(parsed.data.avatar !== undefined ? { avatar: parsed.data.avatar } : {}),
      ...(parsed.data.banner !== undefined ? { banner: parsed.data.banner } : {}),
      ...(parsed.data.bio !== undefined ? { bio: parsed.data.bio } : {}),
      ...(parsed.data.clanTag !== undefined ? { clanTag: parsed.data.clanTag } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.currentActivity !== undefined ? { currentActivity: parsed.data.currentActivity } : {}),
      ...(parsed.data.activityDetails !== undefined ? { activityDetails: parsed.data.activityDetails } : {}),
      lastSeenAt: new Date(),
    },
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      banner: true,
      bio: true,
      clanTag: true,
      status: true,
      premium: true,
      premiumTier: true,
      corePlusActivatedAt: true,
      corePlusBoostLevel: true,
      corePlusStreakDays: true,
      currentActivity: true,
      activityDetails: true,
      lastSeenAt: true,
      createdAt: true,
      emailVerified: true,
      appRole: true,
      isAdmin: true,
    },
  });

  res.json({
    user: {
      ...updated,
      isAdmin: hasAdminAccess(updated.appRole, updated.isAdmin),
    },
  });
});

authRouter.get("/verify-email", async (req, res) => {
  const token = req.query.token;
  if (typeof token !== "string") {
    res.status(400).json({ error: "Missing token" });
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      emailVerifyToken: sha256(token),
      emailVerifyExpires: { gt: new Date() },
    },
  });

  if (!user) {
    res.status(400).json({ error: "Invalid or expired verification token" });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpires: null,
    },
  });

  res.json({ message: "Email verified" });
});

authRouter.post("/forgot-password", async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  // Same answer whether or not the address has an account, and the reset link only ever
  // goes to the inbox. (It used to be returned in this response, so knowing someone's
  // email was enough to take over their account.)
  const answer = { message: "If that email has an account, we've sent a link to reset the password. It works for 30 minutes." };
  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, username: true, email: true, deletedAt: true } });

  if (!user || user.deletedAt) {
    res.status(200).json(answer);
    return;
  }

  const resetToken = randomToken(24);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: sha256(resetToken),
      resetTokenExpires: new Date(Date.now() + 1000 * 60 * 30),
    },
  });

  const link = `${env.APP_WEB_URL.replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(resetToken)}`;
  void sendEmail(
    user.email,
    "Reset your Vexora Gaming password",
    `Hi ${user.username},

Someone (hopefully you) asked to reset your Vexora Gaming password. Open this link within 30 minutes to choose a new one:

${link}

If it wasn't you, you can ignore this email; your password hasn't changed.

Vexora Gaming`,
  ).catch((error) => console.error("[AUTH] reset email failed", error));

  res.status(200).json(answer);
});

authRouter.post("/reset-password", async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: sha256(parsed.data.token),
      resetTokenExpires: { gt: new Date() },
    },
  });

  if (!user) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hashPassword(parsed.data.newPassword),
      resetToken: null,
      resetTokenExpires: null,
    },
  });

  const revokedSessions = await prisma.refreshToken.findMany({
    where: { userId: user.id, revokedAt: null },
    select: { id: true, userId: true },
  });

  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await Promise.all(
    revokedSessions.map((session) =>
      logSessionRevocation({
        sessionId: session.id,
        userId: user.id,
        reason: "password_reset",
        req,
        metadata: {
          flow: "reset-password",
          batchInvalidation: true,
        },
      }),
    ),
  );

  res.status(200).json({ message: "Password reset successful" });
});

authRouter.post("/push-subscriptions", requireAuth, async (req, res) => {
  const parsed = pushSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    update: {
      userId: req.user!.id,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      deviceName: parsed.data.deviceName,
      platform: parsed.data.platform,
    },
    create: {
      userId: req.user!.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      deviceName: parsed.data.deviceName,
      platform: parsed.data.platform,
    },
  });

  res.status(201).json({ subscription });
});

authRouter.post("/core-plus/activate", requireAuth, async (req, res) => {
  const parsed = activateCorePlusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  // With billing connected, Core+ comes from checkout (the Stripe webhook sets the tier).
  // Only staff may switch it on directly, for testing.
  if (billingEnforced()) {
    const actor = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { appRole: true, isAdmin: true } });
    if (!actor || !hasAdminAccess(actor.appRole, actor.isAdmin)) {
      res.status(402).json({ error: "Core+ is activated through checkout on the Pricing page.", code: "PAYMENT_REQUIRED" });
      return;
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      corePlusBoostLevel: true,
      corePlusStreakDays: true,
      corePlusActivatedAt: true,
    },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const tier = parsed.data.tier ?? "PLUS";
  const minimumBoostByTier: Record<"CORE" | "PLUS" | "ELITE" | "INFINITE", number> = {
    CORE: 1,
    PLUS: 2,
    ELITE: 3,
    INFINITE: 5,
  };

  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      premium: true,
      premiumTier: tier,
      corePlusActivatedAt: user.corePlusActivatedAt ?? new Date(),
      corePlusBoostLevel: Math.max(user.corePlusBoostLevel, minimumBoostByTier[tier]),
      corePlusStreakDays: user.corePlusStreakDays > 0 ? user.corePlusStreakDays + 1 : 1,
    },
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      banner: true,
      bio: true,
      status: true,
      premium: true,
      premiumTier: true,
      corePlusActivatedAt: true,
      corePlusBoostLevel: true,
      corePlusStreakDays: true,
      clanTag: true,
      currentActivity: true,
      activityDetails: true,
      lastSeenAt: true,
      createdAt: true,
      emailVerified: true,
      appRole: true,
      isAdmin: true,
    },
  });

  res.status(200).json({
    user: {
      ...updated,
      isAdmin: hasAdminAccess(updated.appRole, updated.isAdmin),
    },
  });
});

authRouter.get("/core-plus/telemetry", requireAuth, async (_req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [activeMembers, upgradesToday, premiumUsers, boostStats] = await prisma.$transaction([
    prisma.user.count({
      where: {
        premium: true,
        premiumTier: { not: "NONE" },
      },
    }),
    prisma.user.count({
      where: {
        premium: true,
        corePlusActivatedAt: { gte: startOfToday },
      },
    }),
    prisma.user.findMany({
      where: {
        premium: true,
        premiumTier: { not: "NONE" },
      },
      select: {
        premiumTier: true,
      },
    }),
    prisma.user.aggregate({
      where: {
        premium: true,
        premiumTier: { not: "NONE" },
      },
      _avg: {
        corePlusBoostLevel: true,
      },
      _max: {
        corePlusBoostLevel: true,
      },
    }),
  ]);

  const tierDistribution = {
    CORE: 0,
    PLUS: 0,
    ELITE: 0,
    INFINITE: 0,
  };

  for (const row of premiumUsers) {
    if (row.premiumTier in tierDistribution) {
      tierDistribution[row.premiumTier as keyof typeof tierDistribution] += 1;
    }
  }

  res.json({
    telemetry: {
      activeMembers,
      upgradesToday,
      tierDistribution,
      avgBoostLevel: Number((boostStats._avg.corePlusBoostLevel ?? 0).toFixed(2)),
      highestBoostLevel: boostStats._max.corePlusBoostLevel ?? 0,
    },
  });
});
