import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { comparePassword, hashPassword } from "../lib/password.js";
import { randomToken, sha256, signAccessToken } from "../lib/jwt.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { hasActiveFeatureEntitlement } from "../middleware/entitlements.js";
import { csrfCookieName } from "../middleware/csrf.js";

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  email: z.string().email(),
  password: z.string().min(8).max(72),
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

const REFRESH_COOKIE_NAME = "nf_refresh";

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

async function issueTokens(user: { id: string; username: string; email: string; appRole?: "USER" | "MODERATOR" | "ADMIN" | "EXEC" | "OWNER" }) {
  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    email: user.email,
    appRole: user.appRole,
  });

  const refreshToken = randomToken();
  const tokenHash = sha256(refreshToken);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken };
}

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  const username = parsed.data.username.trim();

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  });

  if (existing) {
    res.status(409).json({ error: "Email or username already in use" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const emailVerifyToken = randomToken(24);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: passwordHash,
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
    },
  });

  const tokens = await issueTokens(user);
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
      message: "Email verification token generated for integration",
      token: emailVerifyToken,
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

  const tokens = await issueTokens(user);
  const csrfToken = randomToken(16);
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
      isAdmin: hasAdminAccess(user.appRole, user.isAdmin),
    },
  })
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

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }

  await prisma.refreshToken.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await issueTokens(session.user);
  const csrfToken = randomToken(16);
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, refreshCookieOptions());
  res.cookie(csrfCookieName(), csrfToken, csrfCookieOptions());
  res.json({ accessToken: tokens.accessToken, csrfToken });
});

authRouter.post("/logout", async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;

  if (refreshToken) {
    const tokenHash = sha256(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
  res.clearCookie(csrfCookieName(), csrfCookieOptions());
  res.status(204).send();
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
    },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    user: {
      ...user,
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

  const requestedPremiumCosmetics = parsed.data.avatar !== undefined || parsed.data.banner !== undefined;
  if (requestedPremiumCosmetics) {
    const hasBrandingKit = await hasActiveFeatureEntitlement(req.user!.id, "TEAM_BRANDING_KIT");
    if (!hasBrandingKit) {
      res.status(402).json({
        error: "Payment required",
        feature: "TEAM_BRANDING_KIT",
        message: "Custom avatar and banner cosmetics require the Team Branding Kit.",
      });
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

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    res.status(200).json({ message: "If the email exists, a reset token has been issued" });
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

  res.status(200).json({
    message: "Password reset token generated for integration",
    token: resetToken,
  });
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

  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

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
