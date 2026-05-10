import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { requirePaidFeature } from "../middleware/entitlements.js";

export const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.use(requireAdmin);

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

adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      status: true,
      premium: true,
      isAdmin: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json({ users });
});

adminRouter.post("/users/:id/toggle-admin", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isAdmin: !user.isAdmin },
    select: {
      id: true,
      username: true,
      isAdmin: true,
    },
  });

  res.json({ user: updated });
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
      automationActions,
    },
  });
});
