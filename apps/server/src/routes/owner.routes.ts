import { Router } from "express";
import { z } from "zod";
import { BillingStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOwner } from "../middleware/owner.js";
import { getFinanceWindowTotals, getSubscriptionSnapshot, windowStart } from "../lib/finance-metrics.js";
import { env } from "../config/env.js";

export const ownerRouter = Router();

ownerRouter.use(requireAuth, requireOwner);

const transactionQuerySchema = z.object({
  status: z.nativeEnum(PaymentStatus).optional(),
  kind: z.enum(["SUBSCRIPTION", "RENEWAL", "ONE_TIME", "COIN_PACK"]).optional(),
  featureCode: z.enum(["CORE_PLUS", "FORGE_BOOST_PACK", "CREATOR_CAMPAIGN_SLOT", "EVENT_TICKET_PASS", "TEAM_BRANDING_KIT", "ADVANCED_MODERATION_AI", "COIN_PACK"]).optional(),
  provider: z.enum(["STRIPE"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const webhookQuerySchema = z.object({
  status: z.enum(["PROCESSED", "FAILED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

function parseQuery<T extends z.ZodTypeAny>(schema: T, input: unknown, res: import("express").Response): z.infer<T> | null {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
    return null;
  }
  return parsed.data;
}

// Overview: operational counts, revenue headline, and alerts. Every value is read from the database.
ownerRouter.get("/overview", async (_req, res) => {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [users, activeUsers24h, activeUsers7d, forges, failedWebhooks, openDisputes, recentAdminActions, revenueToday, revenueMonth, subscriptions] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { lastSeenAt: { gte: dayAgo } } }),
    prisma.user.count({ where: { lastSeenAt: { gte: weekAgo } } }),
    prisma.forge.count(),
    prisma.webhookEvent.count({ where: { status: "FAILED" } }),
    prisma.paymentDispute.count({ where: { status: "OPEN" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, operation: true, resourceType: true, resourceId: true, actorId: true, status: true, createdAt: true, endpoint: true } }),
    getFinanceWindowTotals("today"),
    getFinanceWindowTotals("month"),
    getSubscriptionSnapshot(),
  ]);

  const alerts: Array<{ level: "critical" | "warning"; message: string }> = [];
  if (failedWebhooks > 0) alerts.push({ level: "critical", message: `${failedWebhooks} payment webhook(s) failed and are waiting for Stripe to retry.` });
  if (openDisputes > 0) alerts.push({ level: "warning", message: `${openDisputes} open payment dispute(s) need a response.` });
  if (revenueMonth.failedCount > 0) alerts.push({ level: "warning", message: `${revenueMonth.failedCount} failed payment(s) in the last 30 days.` });

  res.json({
    generatedAt: now.toISOString(),
    users: { total: users, active24h: activeUsers24h, active7d: activeUsers7d },
    communities: { forges },
    revenue: { today: revenueToday, month: revenueMonth },
    subscriptions,
    recentAdminActions,
    alerts,
  });
});

ownerRouter.get("/finance/summary", async (req, res) => {
  const window = typeof req.query.window === "string" ? req.query.window : "month";
  if (!["today", "week", "month", "all"].includes(window)) {
    res.status(400).json({ error: "window must be today, week, month or all" });
    return;
  }

  const [totals, subscriptions] = await Promise.all([
    getFinanceWindowTotals(window as "today" | "week" | "month" | "all"),
    getSubscriptionSnapshot(),
  ]);

  // Daily gross for the trend chart. Grouped in the database, not in memory.
  const since = windowStart(window as "today" | "week" | "month" | "all") ?? new Date(0);
  const trendRows = (await prisma.$queryRaw(Prisma.sql`
    SELECT date_trunc('day', "createdAt") AS day,
           COALESCE(SUM("amountCents"), 0) AS "grossCents",
           COUNT(*) AS count
    FROM "PaymentTransaction"
    WHERE status IN ('SUCCEEDED', 'REFUNDED', 'DISPUTED') AND "createdAt" >= ${since}
    GROUP BY 1
    ORDER BY 1
  `)) as Array<{ day: Date; grossCents: bigint; count: bigint }>;

  res.json({
    totals,
    subscriptions,
    trend: trendRows.map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      grossCents: Number(row.grossCents),
      count: Number(row.count),
    })),
    provider: { name: "Stripe", configured: Boolean(env.STRIPE_SECRET_KEY), webhookConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET) },
  });
});

ownerRouter.get("/finance/transactions", async (req, res) => {
  const query = parseQuery(transactionQuerySchema, req.query, res);
  if (!query) return;

  const where: Prisma.PaymentTransactionWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.featureCode ? { featureCode: query.featureCode } : {}),
    ...(query.provider ? { provider: query.provider } : {}),
    ...(query.from || query.to ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}),
    ...(query.q
      ? {
          OR: [
            { providerPaymentId: { contains: query.q, mode: "insensitive" } },
            { providerPaymentIntentId: { contains: query.q, mode: "insensitive" } },
            { providerSubscriptionId: { contains: query.q, mode: "insensitive" } },
            { user: { username: { contains: query.q, mode: "insensitive" } } },
            { user: { email: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.paymentTransaction.count({ where }),
    prisma.paymentTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        user: { select: { id: true, username: true, email: true } },
        refunds: { select: { id: true, amountCents: true, status: true, createdAt: true } },
        disputes: { select: { id: true, amountCents: true, status: true, providerStatus: true, createdAt: true, closedAt: true } },
      },
    }),
  ]);

  res.json({
    page: query.page,
    pageSize: query.pageSize,
    total,
    items: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      status: row.status,
      kind: row.kind,
      provider: row.provider,
      featureCode: row.featureCode,
      tier: row.tier,
      amountCents: row.amountCents,
      feeCents: row.feeCents,
      refundedCents: row.refundedCents,
      currency: row.currency,
      providerPaymentId: row.providerPaymentId,
      providerPaymentIntentId: row.providerPaymentIntentId,
      providerSubscriptionId: row.providerSubscriptionId,
      user: row.user,
      refunds: row.refunds,
      disputes: row.disputes,
    })),
  });
});

ownerRouter.get("/finance/subscriptions", async (req, res) => {
  const statusParam = typeof req.query.status === "string" ? req.query.status : undefined;
  const status = statusParam && (Object.values(BillingStatus) as string[]).includes(statusParam) ? (statusParam as BillingStatus) : undefined;

  const rows = await prisma.billingSubscription.findMany({
    where: status ? { status } : {},
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { user: { select: { id: true, username: true, email: true } } },
  });

  res.json({
    items: rows.map((row) => ({
      id: row.id,
      status: row.status,
      tier: row.tier,
      interval: row.interval,
      currentPeriodEnd: row.currentPeriodEnd,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      providerSubscriptionId: row.providerSubscriptionId,
      user: row.user,
      updatedAt: row.updatedAt,
    })),
  });
});

ownerRouter.get("/finance/webhooks", async (req, res) => {
  const query = parseQuery(webhookQuerySchema, req.query, res);
  if (!query) return;

  const where: Prisma.WebhookEventWhereInput = query.status ? { status: query.status } : {};
  const [total, rows] = await Promise.all([
    prisma.webhookEvent.count({ where }),
    prisma.webhookEvent.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  res.json({ page: query.page, pageSize: query.pageSize, total, items: rows });
});
