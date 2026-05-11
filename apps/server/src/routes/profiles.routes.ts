import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { hasAdminAccess } from "../lib/app-roles.js";
import { requireAuth } from "../middleware/auth.js";

export const profilesRouter = Router();
const userIdParamSchema = z.string().uuid();
const medalKeyParamSchema = z.string().min(1).max(64);

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
      where: { id: validatedUserId.data },
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
      leaderboard: users,
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
