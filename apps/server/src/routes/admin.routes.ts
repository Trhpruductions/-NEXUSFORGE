import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  buildSampleGenerationConflictResponse,
  buildSampleGenerationCooldownResponse,
  getSampleGenerationCooldownRemainingMs,
  getSampleGenerationStaleThreshold,
  SAMPLE_PROFILE_GENERATION_COOLDOWN_MS,
  SAMPLE_PROFILE_GENERATION_STALE_MS,
} from "../lib/profile-tool-generation.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { requirePaidFeature } from "../middleware/entitlements.js";

export const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.use(requireAdmin);

type AppRole = "USER" | "MODERATOR" | "ADMIN" | "EXEC" | "OWNER";

const privilegedRoles = new Set<AppRole>(["ADMIN", "EXEC", "OWNER"]);
const roleRank: Record<AppRole, number> = {
  USER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  EXEC: 3,
  OWNER: 4,
};

function resolveEffectiveRole(role: AppRole | null | undefined, isAdmin: boolean): AppRole {
  if (role) return role;
  return isAdmin ? "ADMIN" : "USER";
}

function hasAdminAccess(role: AppRole | null | undefined, isAdmin: boolean): boolean {
  return isAdmin || (role ? privilegedRoles.has(role) : false);
}

const setRoleSchema = z.object({
  role: z.enum(["USER", "MODERATOR", "ADMIN", "EXEC", "OWNER"]),
});

const sampleMedalCatalog = [
  { key: "founding-member", name: "Founding Member", description: "Early supporter of NexusForge.", icon: "🏛" },
  { key: "forge-commander", name: "Forge Commander", description: "Leads high-signal communities.", icon: "🛡" },
  { key: "signal-booster", name: "Signal Booster", description: "Maintains a strong Core+ streak.", icon: "⚡" },
  { key: "legendary-builder", name: "Legendary Builder", description: "Built and scaled a thriving forge.", icon: "🏗" },
  { key: "community-pillar", name: "Community Pillar", description: "Recognized for consistent impact.", icon: "🏅" },
] as const;

const sampleActivityTemplates = [
  { type: "JOINED_FORGE", title: "Joined a new forge", description: "Connected with a new community node." },
  { type: "CREATED_FORGE", title: "Created a forge", description: "Started a new operational workspace." },
  { type: "MESSAGE_SENT", title: "Published a high-signal message", description: "Contributed to active discussions." },
  { type: "FRIEND_ADDED", title: "Expanded social graph", description: "Added a trusted ally." },
  { type: "LEVEL_UP", title: "Advanced profile level", description: "Unlocked new progression tier." },
  { type: "PREMIUM_UPGRADE", title: "Upgraded to Core+", description: "Enabled premium operations." },
] as const;

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function logAdminProfileAction(actorId: string, title: string, description: string, metadata: Record<string, unknown>) {
  try {
    await prisma.userActivity.create({
      data: {
        userId: actorId,
        type: "CUSTOM",
        title,
        description,
        metadata: {
          source: "admin-profile-tool",
          actorId,
          ...metadata,
        },
      },
    });
  } catch (error) {
    console.error("Admin profile audit log failed:", error);
  }
}

async function markStaleSampleGenerationJobsAsFailed() {
  const staleThreshold = getSampleGenerationStaleThreshold(Date.now(), SAMPLE_PROFILE_GENERATION_STALE_MS);

  await prisma.profileToolJob.updateMany({
    where: {
      action: "GENERATE_SAMPLE_DATA",
      status: "RUNNING",
      startedAt: { lt: staleThreshold },
    },
    data: {
      status: "FAILED",
      runLock: null,
      completedAt: new Date(),
      errorMessage: "Marked failed by watchdog after stale runtime window exceeded.",
    },
  });
}

async function getActiveSampleGenerationJob() {
  return prisma.profileToolJob.findFirst({
    where: {
      action: "GENERATE_SAMPLE_DATA",
      status: "RUNNING",
    },
    orderBy: { startedAt: "desc" },
    include: {
      actor: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });
}

async function getLatestSampleGenerationJob() {
  return prisma.profileToolJob.findFirst({
    where: {
      action: "GENERATE_SAMPLE_DATA",
    },
    orderBy: { startedAt: "desc" },
    include: {
      actor: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });
}

async function getLatestCompletedSampleGenerationJob() {
  return prisma.profileToolJob.findFirst({
    where: {
      action: "GENERATE_SAMPLE_DATA",
      status: "SUCCEEDED",
      completedAt: { not: null },
    },
    orderBy: { completedAt: "desc" },
    include: {
      actor: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });
}

async function createSampleGenerationJobIfAvailable(
  actorId: string,
  payload: {
    userLimit: number;
    activitiesPerUser: number;
    minReputation: number;
    maxReputation: number;
    awardRandomMedals: boolean;
  },
) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const activeJob = await tx.profileToolJob.findFirst({
          where: {
            action: "GENERATE_SAMPLE_DATA",
            status: "RUNNING",
          },
          select: { id: true },
        });

        if (activeJob) {
          return null;
        }

        return tx.profileToolJob.create({
          data: {
            action: "GENERATE_SAMPLE_DATA",
            status: "RUNNING",
            runLock: "GENERATE_SAMPLE_DATA",
            actorId,
            payload,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2034" || error.code === "P2002") {
        return null;
      }
    }
    throw error;
  }
}

adminRouter.get("/summary", async (_req, res) => {
  const [users, forges, messages, notifications, pendingFriends] = await Promise.all([
    prisma.user.count(),
    prisma.forge.count(),
    prisma.message.count(),
    prisma.notification.count(),
    prisma.friend.count({ where: { status: "PENDING" } }),
  ]);

  res.json({
    users,
    forges,
    messages,
    notifications,
    pendingFriends,
  });
});

adminRouter.get("/revenue", async (_req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [
    succeededTransactions,
    succeededTransactionsPreviousWindow,
    transactionByFeature,
    activeSubscriptions,
    activeUsersByTier,
    failedPayments,
  ] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: {
        status: "SUCCEEDED",
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        amountCents: true,
      },
    }),
    prisma.paymentTransaction.findMany({
      where: {
        status: "SUCCEEDED",
        createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
      select: {
        amountCents: true,
      },
    }),
    prisma.paymentTransaction.groupBy({
      by: ["featureCode"],
      where: {
        status: "SUCCEEDED",
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.billingSubscription.count({
      where: {
        status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
      },
    }),
    prisma.user.groupBy({
      by: ["premiumTier"],
      where: {
        premium: true,
        premiumTier: { not: "NONE" },
      },
      _count: { _all: true },
    }),
    prisma.paymentTransaction.count({
      where: {
        status: "FAILED",
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  const revenueCents = succeededTransactions.reduce((sum, row) => sum + row.amountCents, 0);
  const previousRevenueCents = succeededTransactionsPreviousWindow.reduce((sum, row) => sum + row.amountCents, 0);

  const growthPct =
    previousRevenueCents > 0
      ? Number((((revenueCents - previousRevenueCents) / previousRevenueCents) * 100).toFixed(2))
      : revenueCents > 0
        ? 100
        : 0;

  const tierDistribution = {
    CORE: 0,
    PLUS: 0,
    ELITE: 0,
    INFINITE: 0,
  };

  for (const row of activeUsersByTier) {
    if (row.premiumTier in tierDistribution) {
      tierDistribution[row.premiumTier as keyof typeof tierDistribution] = row._count._all;
    }
  }

  res.json({
    revenue: {
      last30DaysCents: revenueCents,
      previous30DaysCents: previousRevenueCents,
      growthPct,
      activeSubscriptions,
      failedPayments,
    },
    tierDistribution,
    featureRevenue: transactionByFeature.map((row) => ({
      featureCode: row.featureCode,
      revenueCents: row._sum.amountCents ?? 0,
      transactions: row._count._all,
    })),
  });
});

adminRouter.get("/users", async (req, res) => {
  const [actor, users] = await Promise.all([
    prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        appRole: true,
        isAdmin: true,
      },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        status: true,
        premium: true,
        appRole: true,
        isAdmin: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const actorRole = resolveEffectiveRole(actor?.appRole as AppRole | null, actor?.isAdmin ?? false);

  res.json({
    actorRole,
    canManageHighRoles: actorRole === "OWNER",
    users: users.map((user) => ({
      ...user,
      appRole: resolveEffectiveRole(user.appRole as AppRole | null, user.isAdmin),
      isAdmin: hasAdminAccess(user.appRole as AppRole | null, user.isAdmin),
    })),
  });
});

adminRouter.get("/profile-tools/status", async (_req, res) => {
  await markStaleSampleGenerationJobsAsFailed();

  const [activeJob, latestJob, latestCompletedJob] = await Promise.all([
    getActiveSampleGenerationJob(),
    getLatestSampleGenerationJob(),
    getLatestCompletedSampleGenerationJob(),
  ]);

  const cooldownRemainingMs = getSampleGenerationCooldownRemainingMs(
    latestCompletedJob?.completedAt ?? null,
    Date.now(),
    SAMPLE_PROFILE_GENERATION_COOLDOWN_MS,
  );

  res.json({
    inProgress: Boolean(activeJob),
    startedAt: activeJob?.startedAt ?? null,
    lastCompletedAt: latestCompletedJob?.completedAt ?? null,
    cooldownMs: SAMPLE_PROFILE_GENERATION_COOLDOWN_MS,
    cooldownRemainingMs,
    latestJob: latestJob
      ? {
          id: latestJob.id,
          title:
            latestJob.status === "RUNNING"
              ? "Sample profile generation in progress"
              : latestJob.status === "FAILED"
                ? "Sample profile generation failed"
                : "Generated sample profile data",
          description:
            latestJob.status === "RUNNING"
              ? "Background generation currently running."
              : latestJob.status === "FAILED"
                ? latestJob.errorMessage ?? "Generation run failed before completion."
                : "Populated reputation, medal links, and activity samples.",
          createdAt: latestJob.completedAt ?? latestJob.startedAt,
          metadata: {
            source: "profile-tool-job",
            action: "generate-sample-data",
            status: latestJob.status,
            payload: latestJob.payload,
            result: latestJob.result,
            errorMessage: latestJob.errorMessage,
            startedAt: latestJob.startedAt,
            completedAt: latestJob.completedAt,
          },
          actor: latestJob.actor,
        }
      : null,
  });
});

adminRouter.post("/profile-tools/seed-medals", async (req, res) => {
  const results = await Promise.all(
    sampleMedalCatalog.map(async (medal) => {
      const existing = await prisma.medal.findUnique({ where: { key: medal.key } });
      const saved = await prisma.medal.upsert({
        where: { key: medal.key },
        update: {
          name: medal.name,
          description: medal.description,
          icon: medal.icon,
        },
        create: {
          key: medal.key,
          name: medal.name,
          description: medal.description,
          icon: medal.icon,
        },
      });

      return {
        key: saved.key,
        created: !existing,
      };
    }),
  );

  const created = results.filter((entry) => entry.created).length;
  const updated = results.filter((entry) => !entry.created).length;

  await logAdminProfileAction(
    req.user!.id,
    "Seeded medal catalog",
    "Synchronized profile medal definitions.",
    {
      action: "seed-medals",
      created,
      updated,
    },
  );

  res.json({ medals: results, created, updated });
});

adminRouter.post("/profile-tools/reset-generation-lock", async (req, res) => {
  await markStaleSampleGenerationJobsAsFailed();

  const activeJob = await getActiveSampleGenerationJob();
  if (!activeJob) {
    await logAdminProfileAction(
      req.user!.id,
      "Checked generation lock recovery",
      "Manual recovery requested, but no active generation job was found.",
      {
        action: "reset-generation-lock",
        recovered: false,
      },
    );

    res.json({
      recovered: false,
      message: "No active generation job was found.",
    });
    return;
  }

  await prisma.profileToolJob.update({
    where: { id: activeJob.id },
    data: {
      status: "FAILED",
      runLock: null,
      completedAt: new Date(),
      errorMessage: `Manually reset by admin ${req.user!.username}.`,
    },
  });

  await logAdminProfileAction(
    req.user!.id,
    "Reset generation lock",
    `Force-reset sample generation job started by ${activeJob.actor.username}.`,
    {
      action: "reset-generation-lock",
      recovered: true,
      targetJobId: activeJob.id,
      targetActorId: activeJob.actor.id,
      targetActorUsername: activeJob.actor.username,
    },
  );

  res.json({
    recovered: true,
    message: `Generation lock reset for job ${activeJob.id}.`,
    jobId: activeJob.id,
  });
});

adminRouter.post("/profile-tools/generate-sample-data", async (req, res) => {
  await markStaleSampleGenerationJobsAsFailed();

  const activeJob = await getActiveSampleGenerationJob();
  if (activeJob) {
    res.status(409).json({
      error: "Sample profile generation already in progress",
      startedAt: activeJob.startedAt,
      jobId: activeJob.id,
    });
    return;
  }

  const schema = z.object({
    userLimit: z.coerce.number().int().min(1).max(100).default(25),
    activitiesPerUser: z.coerce.number().int().min(1).max(20).default(5),
    minReputation: z.coerce.number().int().min(0).max(500000).default(50),
    maxReputation: z.coerce.number().int().min(1).max(500000).default(900),
    awardRandomMedals: z.coerce.boolean().default(true),
  });

  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const { userLimit, activitiesPerUser, minReputation, maxReputation, awardRandomMedals } = parsed.data;

  if (minReputation > maxReputation) {
    res.status(400).json({ error: "minReputation cannot exceed maxReputation" });
    return;
  }

  const latestCompletedJob = await getLatestCompletedSampleGenerationJob();
  if (latestCompletedJob) {
    const cooldownRemainingMs = getSampleGenerationCooldownRemainingMs(
      latestCompletedJob.completedAt!,
      Date.now(),
      SAMPLE_PROFILE_GENERATION_COOLDOWN_MS,
    );

    if (cooldownRemainingMs > 0) {
      const response = buildSampleGenerationCooldownResponse(cooldownRemainingMs);
      for (const [key, value] of Object.entries(response.headers)) {
        res.setHeader(key, value);
      }
      res.status(response.status).json(response.body);
      return;
    }
  }

  const job = await createSampleGenerationJobIfAvailable(req.user!.id, {
    userLimit,
    activitiesPerUser,
    minReputation,
    maxReputation,
    awardRandomMedals,
  });

  if (!job) {
    const runningJob = await getActiveSampleGenerationJob();
    const response = buildSampleGenerationConflictResponse(
      runningJob
        ? {
            id: runningJob.id,
            startedAt: runningJob.startedAt,
          }
        : null,
    );

    for (const [key, value] of Object.entries(response.headers)) {
      res.setHeader(key, value);
    }
    res.status(response.status).json(response.body);
    return;
  }

  await logAdminProfileAction(
    req.user!.id,
    "Started sample profile generation",
    "Beginning profile sample data generation run.",
    {
      action: "generate-sample-data",
      phase: "started",
      userLimit,
      activitiesPerUser,
      minReputation,
      maxReputation,
      awardRandomMedals,
    },
  );

  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true },
      orderBy: { createdAt: "desc" },
      take: userLimit,
    });

    const medals = awardRandomMedals
      ? await prisma.medal.findMany({
          select: { id: true },
        })
      : [];

    let reputationUpdates = 0;
    let createdActivities = 0;
    let createdMedalLinks = 0;

    for (const user of users) {
      const targetReputation = randomInt(minReputation, maxReputation);

      const activitiesPayload = Array.from({ length: activitiesPerUser }).map(() => {
        const template = sampleActivityTemplates[randomInt(0, sampleActivityTemplates.length - 1)];
        const offsetMinutes = randomInt(0, 60 * 24 * 21);
        return {
          userId: user.id,
          type: template.type,
          title: template.title,
          description: template.description,
          createdAt: new Date(Date.now() - offsetMinutes * 60 * 1000),
        };
      });

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { reputation: targetReputation },
        });

        await tx.userActivity.createMany({
          data: activitiesPayload,
        });

        if (awardRandomMedals && medals.length > 0) {
          const grantCount = randomInt(0, Math.min(3, medals.length));
          const selectedMedalIds = new Set<string>();
          for (let idx = 0; idx < grantCount; idx += 1) {
            const medal = medals[randomInt(0, medals.length - 1)];
            if (medal) selectedMedalIds.add(medal.id);
          }

          if (selectedMedalIds.size > 0) {
            const result = await tx.userMedal.createMany({
              data: Array.from(selectedMedalIds).map((medalId) => ({
                userId: user.id,
                medalId,
              })),
              skipDuplicates: true,
            });

            createdMedalLinks += result.count;
          }
        }
      });

      reputationUpdates += 1;
      createdActivities += activitiesPayload.length;
    }

    await logAdminProfileAction(
      req.user!.id,
      "Generated sample profile data",
      "Populated reputation, medal links, and activity samples.",
      {
        action: "generate-sample-data",
        phase: "completed",
        usersProcessed: users.length,
        reputationUpdates,
        createdActivities,
        createdMedalLinks,
      },
    );

    await prisma.profileToolJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCEEDED",
        runLock: null,
        completedAt: new Date(),
        result: {
          usersProcessed: users.length,
          reputationUpdates,
          createdActivities,
          totalUserMedalLinks: createdMedalLinks,
        },
      },
    });

    res.json({
      usersProcessed: users.length,
      reputationUpdates,
      createdActivities,
      totalUserMedalLinks: createdMedalLinks,
    });
  } catch (error) {
    console.error("Generate sample profile data error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown generation failure";

    await prisma.profileToolJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        runLock: null,
        completedAt: new Date(),
        errorMessage: errorMessage.slice(0, 500),
      },
    });

    await logAdminProfileAction(
      req.user!.id,
      "Sample profile generation failed",
      "Generation run failed before completion.",
      {
        action: "generate-sample-data",
        phase: "failed",
        errorMessage,
      },
    );

    res.status(500).json({ error: "Failed to generate sample profile data" });
  }
});

adminRouter.post("/profile-tools/reputation", async (req, res) => {
  const schema = z.object({
    userId: z.string().uuid(),
    delta: z.coerce.number().int().min(-5000).max(5000),
    reason: z.string().min(1).max(160).optional(),
  });

  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const { userId, delta, reason } = parsed.data;

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true },
  });

  if (!targetUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      reputation: { increment: delta },
    },
    select: {
      id: true,
      username: true,
      reputation: true,
    },
  });

  await prisma.userActivity.create({
    data: {
      userId,
      type: "CUSTOM",
      title: `Reputation ${delta >= 0 ? "boost" : "adjustment"}`,
      description: reason ?? `Admin adjusted reputation by ${delta}.`,
      metadata: {
        delta,
        reason: reason ?? null,
        source: "admin-profile-tool",
      },
    },
  });

  await logAdminProfileAction(
    req.user!.id,
    "Adjusted user reputation",
    reason ?? `Adjusted ${updatedUser.username} reputation by ${delta}.`,
    {
      action: "adjust-reputation",
      targetUserId: userId,
      targetUsername: targetUser.username,
      delta,
    },
  );

  res.json({ user: updatedUser });
});

adminRouter.get("/profile-tools/audit", async (req, res) => {
  const schema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).max(10000).default(0),
    action: z.enum(["seed-medals", "generate-sample-data", "adjust-reputation"]).optional(),
    actorId: z.string().uuid().optional(),
  });

  const parsed = schema.safeParse({
    limit: req.query.limit ?? "25",
    offset: req.query.offset ?? "0",
    action: req.query.action,
    actorId: req.query.actorId,
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
    return;
  }

  const whereClause: Prisma.UserActivityWhereInput = {
    type: "CUSTOM",
    metadata: {
      path: ["source"],
      equals: "admin-profile-tool",
    },
  };

  if (parsed.data.action || parsed.data.actorId) {
    whereClause.AND = [];

    if (parsed.data.action) {
      whereClause.AND.push({
        metadata: {
          path: ["action"],
          equals: parsed.data.action,
        },
      });
    }

    if (parsed.data.actorId) {
      whereClause.AND.push({
        userId: parsed.data.actorId,
      });
    }
  }

  const logs = await prisma.userActivity.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: parsed.data.limit,
    skip: parsed.data.offset,
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  const total = await prisma.userActivity.count({ where: whereClause });

  res.json({
    total,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
    logs: logs.map((entry) => ({
      id: entry.id,
      title: entry.title,
      description: entry.description,
      metadata: entry.metadata,
      createdAt: entry.createdAt,
      actor: entry.user,
    })),
  });
});

adminRouter.post("/users/:id/toggle-admin", async (req, res) => {
  const [actor, user] = await Promise.all([
    prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        isAdmin: true,
        appRole: true,
      },
    }),
    prisma.user.findUnique({ where: { id: req.params.id } }),
  ]);

  if (!actor) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const actorRole = resolveEffectiveRole(actor.appRole as AppRole | null, actor.isAdmin);
  const targetRole = resolveEffectiveRole(user.appRole as AppRole | null, user.isAdmin);

  if (!hasAdminAccess(actorRole, actor.isAdmin)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  if (targetRole === "OWNER" || targetRole === "EXEC") {
    res.status(403).json({ error: "Cannot modify protected higher-up roles" });
    return;
  }

  const nextRole: AppRole = hasAdminAccess(targetRole, user.isAdmin) ? "USER" : "ADMIN";

  if (nextRole === "USER") {
    const privilegedCount = await prisma.user.count({
      where: {
        OR: [
          { isAdmin: true },
          { appRole: { in: ["ADMIN", "EXEC", "OWNER"] } },
        ],
      },
    });

    if (privilegedCount <= 1) {
      res.status(400).json({ error: "Cannot revoke the final admin account" });
      return;
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      appRole: nextRole,
      isAdmin: privilegedRoles.has(nextRole),
    },
    select: {
      id: true,
      username: true,
      appRole: true,
      isAdmin: true,
    },
  });

  res.json({
    user: {
      ...updated,
      appRole: resolveEffectiveRole(updated.appRole as AppRole | null, updated.isAdmin),
      isAdmin: hasAdminAccess(updated.appRole as AppRole | null, updated.isAdmin),
    },
  });
});

adminRouter.post("/users/:id/set-role", async (req, res) => {
  const parsed = setRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const [actor, target] = await Promise.all([
    prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        isAdmin: true,
        appRole: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        username: true,
        isAdmin: true,
        appRole: true,
      },
    }),
  ]);

  if (!actor) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const actorRole = resolveEffectiveRole(actor.appRole as AppRole | null, actor.isAdmin);
  const targetRole = resolveEffectiveRole(target.appRole as AppRole | null, target.isAdmin);
  const nextRole = parsed.data.role;

  if (!hasAdminAccess(actorRole, actor.isAdmin)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  if (roleRank[nextRole] > roleRank[actorRole]) {
    res.status(403).json({ error: "Cannot assign a role above your own" });
    return;
  }

  if ((nextRole === "EXEC" || nextRole === "OWNER") && actorRole !== "OWNER") {
    res.status(403).json({ error: "Only OWNER can assign EXEC or OWNER roles" });
    return;
  }

  if (actor.id !== target.id && roleRank[targetRole] >= roleRank[actorRole]) {
    res.status(403).json({ error: "Cannot modify users with equal or higher role" });
    return;
  }

  if (nextRole !== targetRole && !privilegedRoles.has(nextRole) && privilegedRoles.has(targetRole)) {
    const privilegedCount = await prisma.user.count({
      where: {
        OR: [
          { isAdmin: true },
          { appRole: { in: ["ADMIN", "EXEC", "OWNER"] } },
        ],
      },
    });

    if (privilegedCount <= 1) {
      res.status(400).json({ error: "Cannot revoke the final admin account" });
      return;
    }
  }

  if (actor.id === target.id && targetRole === "OWNER" && nextRole !== "OWNER") {
    const ownerCount = await prisma.user.count({
      where: {
        appRole: "OWNER",
      },
    });

    if (ownerCount <= 1) {
      res.status(400).json({ error: "Cannot demote the final owner account" });
      return;
    }
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      appRole: nextRole,
      isAdmin: privilegedRoles.has(nextRole),
    },
    select: {
      id: true,
      username: true,
      appRole: true,
      isAdmin: true,
    },
  });

  res.json({
    user: {
      ...updated,
      appRole: resolveEffectiveRole(updated.appRole as AppRole | null, updated.isAdmin),
      isAdmin: hasAdminAccess(updated.appRole as AppRole | null, updated.isAdmin),
    },
  });
});

adminRouter.get("/ai-insights", requirePaidFeature("ADVANCED_MODERATION_AI"), async (_req, res) => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [recentMessages, recentAccounts, pendingFriends, unreadNotifications, premiumUsers] = await Promise.all([
    prisma.message.count({ where: { createdAt: { gte: oneDayAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.friend.count({ where: { status: "PENDING" } }),
    prisma.notification.count({ where: { read: false, createdAt: { gte: oneDayAgo } } }),
    prisma.user.count({ where: { premium: true, premiumTier: { not: "NONE" } } }),
  ]);

  const pressureScore = Math.min(
    100,
    Math.round(recentMessages / 20 + recentAccounts * 2 + pendingFriends * 4 + unreadNotifications * 1.5),
  );

  const riskLevel =
    pressureScore >= 85
      ? "CRITICAL"
      : pressureScore >= 65
        ? "HIGH"
        : pressureScore >= 40
          ? "MEDIUM"
          : "LOW";

  const incidentLikelihoodPct = Math.min(
    99,
    Math.round(
      pressureScore * 0.55 +
        Math.min(30, recentAccounts * 0.9) +
        Math.min(20, pendingFriends * 0.35),
    ),
  );

  const bottlenecks = [
    pendingFriends > 40 ? "Friend request backlog suggests possible social spam burst." : null,
    recentAccounts > 25 ? "New account velocity is elevated and should trigger stricter verification." : null,
    unreadNotifications > 120 ? "Notification queue pressure is high; triage channel alerts first." : null,
  ].filter((item): item is string => Boolean(item));

  const recommendedPlaybooks = [
    {
      title: "Harden Join Pipeline",
      detail:
        recentAccounts > 20
          ? "Enable newcomer verification burst mode and gate high-risk joins for manual review."
          : "Keep current verification flow and monitor join velocity every 15 minutes.",
      priority: recentAccounts > 20 ? "immediate" : "monitor",
    },
    {
      title: "Contain Social Spam",
      detail:
        pendingFriends > 30
          ? "Throttle friend-request fanout and queue suspicious social graph clusters for moderator audit."
          : "Friend request flow appears stable; no additional throttling required.",
      priority: pendingFriends > 30 ? "today" : "monitor",
    },
    {
      title: "Message Surge Guard",
      detail:
        recentMessages > 2500
          ? "Raise anti-raid thresholds and auto-slow channels with burst traffic signatures."
          : "Message volume is manageable; maintain baseline anti-raid policy.",
      priority: recentMessages > 2500 ? "immediate" : "monitor",
    },
  ];

  const automationActions = [
    pressureScore > 70 ? "Escalate raid-shield thresholds" : "Traffic stable",
    recentAccounts > 20 ? "Enable newcomer verification burst mode" : "New user flow normal",
    pendingFriends > 30 ? "Review social graph spam cluster" : "Friend request flow normal",
  ];

  res.json({
    insights: {
      pressureScore,
      recentMessages,
      recentAccounts,
      pendingFriends,
      unreadNotifications,
      premiumUsers,
      riskLevel,
      incidentLikelihoodPct,
      automationActions,
      recommendedPlaybooks,
      bottlenecks,
    },
  });
});
