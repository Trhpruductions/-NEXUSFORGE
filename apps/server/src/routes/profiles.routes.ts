import express, { Router, type ErrorRequestHandler, type Request, type RequestHandler, type Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { safeUser } from "../lib/safe-user.js";
import { achievementProgress, evaluateAchievements } from "../lib/achievements.js";
import { hasAdminAccess } from "../lib/app-roles.js";
import { attachProfileBadges } from "../lib/profile-badges.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { hasActiveFeatureEntitlement } from "../middleware/entitlements.js";
import { limitsForUser } from "../lib/user-limits.js";
import { upgradeRequired } from "../lib/plans.js";
import { checkProfileImage, PROFILE_IMAGE_LIMITS, type ProfileImageKind } from "../lib/image-validation.js";
import { ownedProfileImageKey, storeProfileImage, swapStoredImage } from "../lib/storage.js";
import {
  isUniqueViolation,
  usernameCooldownEndsAt,
  usernameIssue,
  usernameTaken,
} from "../lib/usernames.js";

export const profilesRouter = Router();
const userIdParamSchema = z.string().uuid();
const medalKeyParamSchema = z.string().min(1).max(64);

const userGroupSchema = z.enum(["CAS", "CRT", "COMP", "OPS"]);

const userGroupDefinitions: Record<z.infer<typeof userGroupSchema>, { name: string; description: string }> = {
  CAS: {
    name: "Casual Crew",
    description: "Low-pressure players who jump in for quick matches, chat, and social sessions.",
  },
  CRT: {
    name: "Creator Circle",
    description: "Streamers, editors, and clip makers who keep the feed moving.",
  },
  COMP: {
    name: "Competitive League",
    description: "Ranked players, scrim leaders, and tournament regulars.",
  },
  OPS: {
    name: "Ops Team",
    description: "Moderators, admins, and owner-level operators.",
  },
};

profilesRouter.get("/users/groups", requireAuth, async (_req, res) => {
  try {
    const groups = await Promise.all(
      Object.entries(userGroupDefinitions).map(async ([tag, meta]) => {
        const users = await prisma.user.findMany({
          where: { clanTag: tag, deletedAt: null },
          select: {
            id: true,
            username: true,
            avatar: true,
            status: true,
            premiumTier: true,
            reputation: true,
          },
          orderBy: [{ reputation: "desc" }, { createdAt: "asc" }],
          take: 3,
        });

        const [totalUsers, onlineUsers, premiumUsers, avgResult] = await Promise.all([
          prisma.user.count({ where: { clanTag: tag } }),
          prisma.user.count({ where: { clanTag: tag, status: "ONLINE" } }),
          prisma.user.count({ where: { clanTag: tag, premium: true, premiumTier: { not: "NONE" } } }),
          prisma.user.aggregate({
            where: { clanTag: tag },
            _avg: { reputation: true },
          }),
        ]);

        return {
          tag,
          name: meta.name,
          description: meta.description,
          totalUsers,
          onlineUsers,
          premiumUsers,
          avgReputation: Math.round(avgResult._avg.reputation ?? 0),
          sampleUsers: users,
        };
      }),
    );

    res.json({ groups });
  } catch (error) {
    console.error("Get user groups error:", error);
    res.status(500).json({ error: "Failed to get user groups" });
  }
});

/**
 * @route GET /api/profiles/creators/live
 * @desc Get currently live creators
 * @access Private
 */
profilesRouter.get("/creators/live", requireAuth, async (_req, res) => {
  try {
    const creators = await prisma.user.findMany({
      where: {
        isCreator: true,
        creatorStatus: "LIVE",
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        isCreator: true,
        isStaff: true,
        isRep: true,
        isPartner: true,
        livePlatform: true,
        liveStreamTitle: true,
        liveStreamUrl: true,
        liveGameCategory: true,
        liveViewerCount: true,
        activityType: true,
        activityStatus: true,
        socialLinks: true,
      },
      orderBy: { liveViewerCount: "desc" },
    });

    res.json(creators);
  } catch (error) {
    console.error("Get live creators error:", error);
    res.status(500).json({ error: "Failed to get live creators" });
  }
});

/**
 * @route POST /api/profiles/activity
 * @desc Update current user activity (Game, Music, etc.)
 * @access Private
 */
profilesRouter.post("/activity", requireAuth, async (req, res) => {
  try {
    const activitySchema = z.object({
      activityType: z.enum(["GAME", "MUSIC", "STREAMING", "SOCIAL", "CLEAR"]),
      activityStatus: z.string().max(255).optional(),
      activityMetadata: z.any().optional(),
      showActivity: z.boolean().optional(),
    });

    const parsed = activitySchema.parse(req.body);

    if (parsed.activityType === "CLEAR") {
      const updated = await prisma.user.update({
        where: { id: req.user!.id },
        data: {
          activityType: null,
          activityStatus: null,
          activityMetadata: Prisma.JsonNull,
          currentActivity: null,
        },
      });
      res.json(safeUser(updated));
      return;
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        activityType: parsed.activityType,
        activityStatus: parsed.activityStatus,
        activityMetadata: parsed.activityMetadata || Prisma.JsonNull,
        currentActivity: parsed.activityStatus,
        showActivity: parsed.showActivity ?? true,
      },
    });

    res.json(safeUser(updated));
  } catch (error) {
    res.status(400).json({ error: "Failed to update activity" });
  }
});

// Search users by username or tag
profilesRouter.get("/users/search", requireAuth, async (req, res) => {
  try {
    const querySchema = z.object({
      q: z.string().min(1).max(50),
      limit: z.coerce.number().int().min(1).max(50).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    });

    const parsed = querySchema.safeParse({
      q: req.query.q,
      limit: req.query.limit ?? "20",
      offset: req.query.offset ?? "0",
    });

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
      return;
    }

    const { q, limit, offset } = parsed.data;

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { clanTag: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        clanTag: true,
        premium: true,
        premiumTier: true,
        reputation: true,
        createdAt: true,
      },
      take: limit,
      skip: offset,
      orderBy: {
        reputation: "desc",
      },
    });

    const total = await prisma.user.count({
      where: {
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { clanTag: { contains: q, mode: "insensitive" } },
        ],
      },
    });

    res.json({
      users,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({ error: "Failed to search users" });
  }
});

// Get public profile for a user
profilesRouter.get("/users/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    const validatedUserId = userIdParamSchema.safeParse(userId);
    if (!validatedUserId.success) {
      res.status(400).json({ error: "Invalid userId" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: validatedUserId.data, deletedAt: null },
      select: {
        id: true,
        username: true,
        avatar: true,
        banner: true,
        bio: true,
        clanTag: true,
        premium: true,
        premiumTier: true,
        corePlusBoostLevel: true,
        corePlusStreakDays: true,
        reputation: true,
        status: true,
        createdAt: true,
        medals: {
          include: { medal: true },
          take: 10,
          orderBy: { grantedAt: "desc" },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Count forges owned and member of
    const forgesOwned = await prisma.forge.count({
      where: { ownerId: validatedUserId.data },
    });

    const forgesMember = await prisma.forgeMember.count({
      where: { userId: validatedUserId.data },
    });

    const [appRankHigherCount, boostRankHigherCount] = await Promise.all([
      prisma.user.count({
        where: {
          reputation: {
            gt: user.reputation,
          },
        },
      }),
      prisma.user.count({
        where: {
          OR: [
            {
              corePlusBoostLevel: {
                gt: user.corePlusBoostLevel ?? 0,
              },
            },
            {
              corePlusBoostLevel: user.corePlusBoostLevel ?? 0,
              corePlusStreakDays: {
                gt: user.corePlusStreakDays ?? 0,
              },
            },
          ],
        },
      }),
    ]);

    res.json({
      ...user,
      forgesOwned,
      forgesMember,
      appRank: appRankHigherCount + 1,
      boostRank: boostRankHigherCount + 1,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

// Get leaderboards
profilesRouter.get("/leaderboards/:type", requireAuth, async (req, res) => {
  try {
    const typeSchema = z.enum(["reputation", "streaks", "medals"]);
    const querySchema = z.object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    });

    const typeValidation = typeSchema.safeParse(req.params.type);
    if (!typeValidation.success) {
      res.status(400).json({ error: "Invalid leaderboard type" });
      return;
    }

    const queryValidation = querySchema.safeParse({
      limit: req.query.limit ?? "20",
      offset: req.query.offset ?? "0",
    });

    if (!queryValidation.success) {
      res.status(400).json({ error: "Invalid query params" });
      return;
    }

    const type = typeValidation.data;
    const { limit, offset } = queryValidation.data;

    let users;

    if (type === "reputation") {
      users = await prisma.user.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          username: true,
          avatar: true,
          clanTag: true,
          reputation: true,
          premium: true,
          premiumTier: true,
          createdAt: true,
        },
        orderBy: { reputation: "desc" },
        take: limit,
        skip: offset,
      });
    } else if (type === "streaks") {
      users = await prisma.user.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          username: true,
          avatar: true,
          clanTag: true,
          corePlusBoostLevel: true,
          corePlusStreakDays: true,
          premium: true,
          premiumTier: true,
          createdAt: true,
        },
        orderBy: [
          { corePlusBoostLevel: "desc" },
          { corePlusStreakDays: "desc" },
        ],
        take: limit,
        skip: offset,
      });
    } else if (type === "medals") {
      const usersWithMedalCount = await prisma.user.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          username: true,
          avatar: true,
          clanTag: true,
          premium: true,
          premiumTier: true,
          createdAt: true,
          _count: {
            select: { medals: true },
          },
        },
        orderBy: {
          medals: {
            _count: "desc",
          },
        },
        take: limit,
        skip: offset,
      });

      users = usersWithMedalCount.map(({ _count, ...user }) => ({
        ...user,
        medalCount: _count.medals,
      }));
    }

    const total = await prisma.user.count();

    res.json({
      leaderboard: await attachProfileBadges(users ?? []),
      type,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Get leaderboards error:", error);
    res.status(500).json({ error: "Failed to get leaderboards" });
  }
});

// Get user's activity feed
profilesRouter.get("/users/:userId/activity", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    const validatedUserId = userIdParamSchema.safeParse(userId);
    if (!validatedUserId.success) {
      res.status(400).json({ error: "Invalid userId" });
      return;
    }

    const querySchema = z.object({
      limit: z.coerce.number().int().min(1).max(50).optional(),
      offset: z.coerce.number().int().min(0).optional(),
    });

    const parsed = querySchema.safeParse({
      limit: req.query.limit ?? "20",
      offset: req.query.offset ?? "0",
    });

    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query params" });
      return;
    }

    const { limit, offset } = parsed.data;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: validatedUserId.data },
      select: { id: true },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const activities = await prisma.userActivity.findMany({
      where: { userId: validatedUserId.data },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const total = await prisma.userActivity.count({
      where: { userId: validatedUserId.data },
    });

    res.json({
      activities,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Get activity feed error:", error);
    res.status(500).json({ error: "Failed to get activity feed" });
  }
});

// Get user's medals
/** Every achievement with unlocked state for a player (drives the profile Achievements tab). */
profilesRouter.get("/users/:userId/achievements", requireAuth, async (req, res) => {
  const validated = userIdParamSchema.safeParse(req.params.userId);
  if (!validated.success) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }
  const exists = await prisma.user.findUnique({ where: { id: validated.data }, select: { id: true } });
  if (!exists) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (validated.data === req.user!.id) await evaluateAchievements(validated.data);
  res.json({ achievements: await achievementProgress(validated.data) });
});

profilesRouter.get("/users/:userId/medals", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    const validatedUserId = userIdParamSchema.safeParse(userId);
    if (!validatedUserId.success) {
      res.status(400).json({ error: "Invalid userId" });
      return;
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: validatedUserId.data },
      select: { id: true },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const medals = await prisma.userMedal.findMany({
      where: { userId: validatedUserId.data },
      include: { medal: true },
      orderBy: { grantedAt: "desc" },
    });

    res.json({
      medals: medals.map((um) => ({
        ...um.medal,
        grantedAt: um.grantedAt,
      })),
      total: medals.length,
    });
  } catch (error) {
    console.error("Get medals error:", error);
    res.status(500).json({ error: "Failed to get medals" });
  }
});

// Grant medal to user (admin only)
profilesRouter.post("/users/:userId/medals/:medalKey", requireAuth, async (req, res) => {
  try {
    const { userId, medalKey } = req.params;

    const validatedUserId = userIdParamSchema.safeParse(userId);
    if (!validatedUserId.success) {
      res.status(400).json({ error: "Invalid userId" });
      return;
    }

    const validatedMedalKey = medalKeyParamSchema.safeParse(medalKey);
    if (!validatedMedalKey.success) {
      res.status(400).json({ error: "Invalid medalKey" });
      return;
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { isAdmin: true, appRole: true },
    });

    if (!currentUser || !hasAdminAccess(currentUser.appRole, currentUser.isAdmin)) {
      res.status(403).json({ error: "Admin only" });
      return;
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: validatedUserId.data },
      select: { id: true },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Get medal
    const medal = await prisma.medal.findUnique({
      where: { key: validatedMedalKey.data },
    });

    if (!medal) {
      res.status(404).json({ error: "Medal not found" });
      return;
    }

    // Check if user already has medal
    const existingMedal = await prisma.userMedal.findUnique({
      where: {
        userId_medalId: {
          userId: validatedUserId.data,
          medalId: medal.id,
        },
      },
    });

    if (existingMedal) {
      res.status(409).json({ error: "User already has this medal" });
      return;
    }

    // Grant medal
    await prisma.userMedal.create({
      data: {
        userId: validatedUserId.data,
        medalId: medal.id,
      },
    });

    // Add activity
    await prisma.userActivity.create({
      data: {
        userId: validatedUserId.data,
        type: "MEDAL_EARNED",
        title: `Earned ${medal.name}`,
        description: medal.description ?? undefined,
        metadata: { medalId: medal.id, medalKey: validatedMedalKey.data },
      },
    });

    res.status(201).json({
      message: "Medal granted successfully",
      medal,
    });
  } catch (error) {
    console.error("Grant medal error:", error);
    res.status(500).json({ error: "Failed to grant medal" });
  }
});

// Add activity (internal only - no direct endpoint, used by system)
export async function addUserActivity(
  userId: string,
  type: "JOINED_FORGE" | "CREATED_FORGE" | "MESSAGE_SENT" | "FRIEND_ADDED" | "MEDAL_EARNED" | "LEVEL_UP" | "PREMIUM_UPGRADE" | "CUSTOM",
  title: string,
  description?: string,
  metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput
) {
  try {
    await prisma.userActivity.create({
      data: {
        userId,
        type,
        title,
        description,
        metadata,
      },
    });
  } catch (error) {
    console.error("Add user activity error:", error);
  }
}

// Update user reputation (internal - called by other systems)
export async function updateUserReputation(userId: string, delta: number) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        reputation: {
          increment: delta,
        },
      },
    });
  } catch (error) {
    console.error("Update reputation error:", error);
  }
}

// ---------------------------------------------------------------------------
// Profile editor: the signed-in user's own name, username, bio, links, privacy and pictures.
// Every write targets req.user.id. No user id is read from the URL or the body, and unknown
// fields are rejected (strict schemas).
// ---------------------------------------------------------------------------

const DISPLAY_NAME_MAX = 40;
const BIO_MAX = 512;
const SOCIAL_LINK_MAX_LENGTH = 200;
const PICTURE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** One link per platform, each on that platform's own domain. The list also sets the count limit. */
const SOCIAL_PLATFORMS = {
  discord: { label: "Discord", domains: ["discord.gg", "discord.com"] },
  x: { label: "X", domains: ["x.com", "twitter.com"] },
  instagram: { label: "Instagram", domains: ["instagram.com"] },
  kick: { label: "Kick", domains: ["kick.com"] },
  youtube: { label: "YouTube", domains: ["youtube.com", "youtu.be"] },
  twitch: { label: "Twitch", domains: ["twitch.tv"] },
} as const;
type SocialPlatform = keyof typeof SOCIAL_PLATFORMS;
const SOCIAL_PLATFORM_KEYS = Object.keys(SOCIAL_PLATFORMS) as SocialPlatform[];
const SOCIAL_LINKS_MAX = SOCIAL_PLATFORM_KEYS.length;

type SocialLinkResult = { ok: true; href: string } | { ok: false; error: string };

/** Checks a social link is an https address on the platform's own domain, and returns it normalised. */
export function parseSocialLink(platform: SocialPlatform, raw: string): SocialLinkResult {
  const value = raw.trim();
  const { label, domains } = SOCIAL_PLATFORMS[platform];
  if (value.length > SOCIAL_LINK_MAX_LENGTH) return { ok: false, error: `${label} link can be up to ${SOCIAL_LINK_MAX_LENGTH} characters.` };
  if (/\s/.test(value)) return { ok: false, error: `${label} link can't contain spaces.` };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: `${label} link must be a full address that starts with https://` };
  }
  if (url.protocol !== "https:") return { ok: false, error: `${label} link must start with https://` };
  if (url.username || url.password || url.port) return { ok: false, error: `${label} link can't include a login or a port number.` };
  const host = url.hostname.toLowerCase();
  if (!domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    return { ok: false, error: `${label} links must be on ${domains[0]}.` };
  }
  return { ok: true, href: url.href };
}

const noControlChars = (value: string) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);

const displayNameField = z
  .string()
  .trim()
  .max(DISPLAY_NAME_MAX)
  .refine(noControlChars, "Display names can't contain control characters.");

const bioField = z
  .string()
  .transform((value) => value.replace(/\r\n?/g, "\n").trim())
  .refine((value) => Array.from(value).length <= BIO_MAX, `Bio can be up to ${BIO_MAX} characters.`)
  .refine(noControlChars, "Bio can't contain control characters.");

const socialField = (platform: SocialPlatform) =>
  z
    .string()
    .max(SOCIAL_LINK_MAX_LENGTH)
    .nullable()
    .optional()
    .superRefine((value, ctx) => {
      if (!value || !value.trim()) return;
      const result = parseSocialLink(platform, value);
      if (!result.ok) ctx.addIssue({ code: "custom", message: result.error });
    });

const socialLinksField = z
  .strictObject({
    discord: socialField("discord"),
    x: socialField("x"),
    instagram: socialField("instagram"),
    kick: socialField("kick"),
    youtube: socialField("youtube"),
    twitch: socialField("twitch"),
  })
  .refine(
    (value) => Object.values(value).filter((link) => typeof link === "string" && link.trim()).length <= SOCIAL_LINKS_MAX,
    `You can add up to ${SOCIAL_LINKS_MAX} links.`,
  );

export const profileUpdateSchema = z
  .strictObject({
    displayName: displayNameField.nullable().optional(),
    username: z.string().trim().min(1).max(64).optional(),
    bio: bioField.nullable().optional(),
    socialLinks: socialLinksField.optional(),
    privacy: z
      .strictObject({
        showOnlineStatus: z.boolean().optional(),
        showActivity: z.boolean().optional(),
        showJoinedServers: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");

const editorUserSelect = {
  id: true,
  username: true,
  displayName: true,
  bio: true,
  avatar: true,
  banner: true,
  socialLinks: true,
  privacySettings: true,
  usernameChangedAt: true,
} as const;

type EditorRow = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatar: string | null;
  banner: string | null;
  socialLinks: Prisma.JsonValue | null;
  privacySettings: Prisma.JsonValue | null;
  usernameChangedAt: Date | null;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Privacy toggles for the optional parts of a profile. Missing values take the settings defaults. */
function readPrivacy(raw: unknown) {
  const stored = isPlainObject(raw) ? raw : {};
  return {
    showOnlineStatus: typeof stored.showOnlineStatus === "boolean" ? stored.showOnlineStatus : true,
    showActivity: typeof stored.showActivity === "boolean" ? stored.showActivity : true,
    showJoinedServers: typeof stored.showJoinedServers === "boolean" ? stored.showJoinedServers : false,
  };
}

function readSocialLinks(raw: unknown): Partial<Record<SocialPlatform, string>> {
  const stored = isPlainObject(raw) ? raw : {};
  const links: Partial<Record<SocialPlatform, string>> = {};
  for (const platform of SOCIAL_PLATFORM_KEYS) {
    const value = stored[platform];
    if (typeof value === "string" && value.trim()) links[platform] = value.trim();
  }
  return links;
}

function editorState(row: EditorRow) {
  const cooldownEnds = usernameCooldownEndsAt(row.usernameChangedAt);
  return {
    profile: {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      bio: row.bio,
      avatar: row.avatar,
      banner: row.banner,
      socialLinks: readSocialLinks(row.socialLinks),
      privacy: readPrivacy(row.privacySettings),
      usernameChangeAvailableAt: cooldownEnds ? cooldownEnds.toISOString() : null,
    },
    limits: {
      displayNameMax: DISPLAY_NAME_MAX,
      bioMax: BIO_MAX,
      socialLinkMaxLength: SOCIAL_LINK_MAX_LENGTH,
      socialLinksMax: SOCIAL_LINKS_MAX,
      socialPlatforms: SOCIAL_PLATFORM_KEYS.map((key) => ({ key, label: SOCIAL_PLATFORMS[key].label, domains: [...SOCIAL_PLATFORMS[key].domains] })),
      usernameMin: 3,
      usernameMax: 32,
      pictures: { ...PROFILE_IMAGE_LIMITS, types: PICTURE_TYPES },
    },
  };
}

async function editorStateFor(userId: string) {
  const row = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: editorUserSelect });
  return row ? editorState(row) : null;
}

/** Full editor state for the signed-in user: what the form is filled from, and the limits it enforces. */
profilesRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const state = await editorStateFor(req.user!.id);
    if (!state) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    res.json(state);
  } catch (error) {
    console.error("Get profile editor error:", error);
    res.status(500).json({ error: "Couldn't load your profile." });
  }
});

/**
 * Advisory only: the form shows it while typing, but the save is authoritative and the database's
 * unique username constraint decides any race.
 */
profilesRouter.get("/me/username-availability", requireAuth, async (req, res) => {
  const parsed = z.object({ username: z.string().trim().min(1).max(64) }).safeParse({ username: req.query.username });
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a username to check." });
    return;
  }
  try {
    const userId = req.user!.id;
    const me = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { username: true, usernameChangedAt: true } });
    if (!me) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    const name = parsed.data.username;
    const issue = usernameIssue(name);
    if (issue) {
      res.json({ available: false, reason: issue.reason, message: issue.message });
      return;
    }
    if (name === me.username) {
      res.json({ available: true, reason: "current", message: "This is your current username." });
      return;
    }
    const caseOnly = name.toLowerCase() === me.username.toLowerCase();
    const cooldownEnds = caseOnly ? null : usernameCooldownEndsAt(me.usernameChangedAt);
    if (cooldownEnds) {
      res.json({ available: false, reason: "cooldown", message: "You can change your username once a day.", availableAt: cooldownEnds.toISOString() });
      return;
    }
    if (await usernameTaken(name, userId)) {
      res.json({ available: false, reason: "taken", message: "That username is already taken." });
      return;
    }
    res.json({ available: true, reason: "free", message: "That username is available." });
  } catch (error) {
    console.error("Username availability error:", error);
    res.status(500).json({ error: "Couldn't check that username. Try again." });
  }
});

/** Saves the text fields in one write. Pictures are sent separately (see the picture routes). */
profilesRouter.patch("/me", requireAuth, requireCsrf, async (req, res) => {
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const userId = req.user!.id;
  const input = parsed.data;
  try {
    const current = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { username: true, usernameChangedAt: true, socialLinks: true, privacySettings: true },
    });
    if (!current) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    const data: Prisma.UserUpdateInput = {};
    if (input.displayName !== undefined) data.displayName = input.displayName || null;
    if (input.bio !== undefined) data.bio = input.bio || null;

    if (input.socialLinks !== undefined) {
      const links = readSocialLinks(current.socialLinks);
      for (const platform of SOCIAL_PLATFORM_KEYS) {
        const value = input.socialLinks[platform];
        if (value === undefined) continue;
        if (!value || !value.trim()) {
          delete links[platform];
          continue;
        }
        const result = parseSocialLink(platform, value);
        if (!result.ok) {
          res.status(400).json({ error: result.error });
          return;
        }
        links[platform] = result.href;
      }
      data.socialLinks = links as Prisma.InputJsonObject;
    }

    if (input.username !== undefined && input.username !== current.username) {
      const issue = usernameIssue(input.username);
      if (issue) {
        res.status(400).json({ error: issue.message });
        return;
      }
      // Changing only the letter case is allowed at any time; a real rename waits out the cooldown.
      const caseOnly = input.username.toLowerCase() === current.username.toLowerCase();
      const cooldownEnds = caseOnly ? null : usernameCooldownEndsAt(current.usernameChangedAt);
      if (cooldownEnds) {
        res.status(429).json({ error: "You can change your username once a day.", retryAt: cooldownEnds.toISOString() });
        return;
      }
      if (await usernameTaken(input.username, userId)) {
        res.status(409).json({ error: "That username is already taken." });
        return;
      }
      data.username = input.username;
      data.usernameChangedAt = new Date();
    }

    if (input.privacy) {
      const stored = isPlainObject(current.privacySettings) ? current.privacySettings : {};
      // Merge into what is already stored, so toggles saved elsewhere are kept.
      data.privacySettings = { ...stored, ...input.privacy } as Prisma.InputJsonObject;
    }

    const updated = await prisma.user.update({ where: { id: userId }, data, select: editorUserSelect });
    res.json(editorState(updated));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "That username is already taken." });
      return;
    }
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Couldn't save your profile. Nothing was changed." });
  }
});

class ProfileAccountMissing extends Error {}

/** Points the user's avatar or banner at `url` (null clears it) and returns the URL it held before. */
async function commitPicture(userId: string, kind: ProfileImageKind, url: string | null): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.user.findFirst({ where: { id: userId, deletedAt: null }, select: { avatar: true, banner: true } });
    if (!row) throw new ProfileAccountMissing();
    await tx.user.update({ where: { id: userId }, data: kind === "avatar" ? { avatar: url } : { banner: url } });
    return kind === "avatar" ? row.avatar : row.banner;
  });
}

async function bannerAllowed(userId: string) {
  const limits = await limitsForUser(userId);
  return limits.profileBanner || (await hasActiveFeatureEntitlement(userId, "TEAM_BRANDING_KIT"));
}

/** Reads the raw picture bytes (PNG, JPEG or WebP only, size-capped, no compressed bodies). */
function pictureUploadParsers(kind: ProfileImageKind): [RequestHandler, ErrorRequestHandler] {
  const parser = express.raw({ type: PICTURE_TYPES, limit: PROFILE_IMAGE_LIMITS[kind].maxBytes, inflate: false });
  const parserError: ErrorRequestHandler = (error, _req, res, next) => {
    const status = (error as { status?: unknown } | null)?.status;
    if (status === 413) {
      res.status(413).json({ error: `${kind === "avatar" ? "Avatar" : "Banner"} pictures can be up to ${PROFILE_IMAGE_LIMITS[kind].maxBytes / (1024 * 1024)} MB.` });
      return;
    }
    if (typeof status === "number" && status >= 400 && status < 500) {
      res.status(415).json({ error: "Only plain PNG, JPEG and WebP pictures are accepted." });
      return;
    }
    next(error);
  };
  return [parser, parserError];
}

async function uploadPicture(kind: ProfileImageKind, req: Request, res: Response) {
  const userId = req.user!.id;
  try {
    if (!Buffer.isBuffer(req.body)) {
      res.status(415).json({ error: "Send the picture file itself as PNG, JPEG or WebP." });
      return;
    }
    if (kind === "banner" && !(await bannerAllowed(userId))) {
      res.status(402).json(upgradeRequired("A profile banner is a Core+ perk.", "PROFILE_BANNER", "CORE"));
      return;
    }
    const contentType = req.headers["content-type"];
    const declared = typeof contentType === "string" ? contentType.split(";")[0].trim().toLowerCase() : null;
    const picture = checkProfileImage(req.body, kind, declared);
    if (!picture.ok) {
      res.status(picture.status).json({ error: picture.error });
      return;
    }
    // Write the new file, switch the database to it, and only then remove the old one (lib/storage.ts).
    const result = await swapStoredImage({
      write: () => storeProfileImage({ userId, kind, bytes: picture.bytes, ext: picture.ext, mime: picture.mime }),
      commit: (url) => commitPicture(userId, kind, url),
      keyForOwnedUrl: (url) => ownedProfileImageKey(url, userId),
      onCleanupError: (error, key) => console.error("Profile picture cleanup failed:", key, error),
    });
    res.json({ [kind]: result.url });
  } catch (error) {
    if (error instanceof ProfileAccountMissing) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    console.error("Profile picture upload error:", error);
    res.status(500).json({ error: "Couldn't save that picture. Your current picture is unchanged." });
  }
}

async function removePicture(kind: ProfileImageKind, req: Request, res: Response) {
  const userId = req.user!.id;
  try {
    await swapStoredImage({
      commit: (url) => commitPicture(userId, kind, url),
      keyForOwnedUrl: (url) => ownedProfileImageKey(url, userId),
      onCleanupError: (error, key) => console.error("Profile picture cleanup failed:", key, error),
    });
    res.json({ [kind]: null });
  } catch (error) {
    if (error instanceof ProfileAccountMissing) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    console.error("Profile picture remove error:", error);
    res.status(500).json({ error: "Couldn't remove that picture. Your current picture is unchanged." });
  }
}

profilesRouter.post("/me/avatar", requireAuth, requireCsrf, ...pictureUploadParsers("avatar"), (req, res) => uploadPicture("avatar", req, res));
profilesRouter.post("/me/banner", requireAuth, requireCsrf, ...pictureUploadParsers("banner"), (req, res) => uploadPicture("banner", req, res));
profilesRouter.delete("/me/avatar", requireAuth, requireCsrf, (req, res) => removePicture("avatar", req, res));
profilesRouter.delete("/me/banner", requireAuth, requireCsrf, (req, res) => removePicture("banner", req, res));
