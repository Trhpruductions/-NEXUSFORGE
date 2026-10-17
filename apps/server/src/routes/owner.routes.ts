import { randomUUID } from "node:crypto";
import type { Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { AuditOperation, AuditStatus, BillingStatus, ExpenseCategory, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOwner } from "../middleware/owner.js";
import {
  PERIOD_KEYS,
  getFinanceTotals,
  getRecurringRevenue,
  getRevenueBreakdown,
  getSubscriptionSnapshot,
  getTrend,
  resolvePeriod,
  type PeriodKey,
} from "../lib/finance-metrics.js";
import { getHostMetrics, getServiceChecks, type ServiceStatus } from "../lib/owner-health.js";
import { env } from "../config/env.js";

export const ownerRouter = Router();

ownerRouter.use(requireAuth, requireOwner);

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function parseQuery<T extends z.ZodTypeAny>(schema: T, input: unknown, res: Response): z.infer<T> | null {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
    return null;
  }
  return parsed.data;
}

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};

const modeSchema = z.enum(["live", "test"]).default("live");

const periodQuerySchema = z.object({
  period: z.enum(PERIOD_KEYS).default("month"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  mode: modeSchema,
});

function resolvePeriodFromQuery(query: z.infer<typeof periodQuerySchema>) {
  if (query.period === "custom") {
    if (!query.from || !query.to || query.to <= query.from) {
      return { error: "custom period needs from and to, with to after from" as const };
    }
    return { period: resolvePeriod("custom", new Date(), { from: query.from, to: query.to }) };
  }
  return { period: resolvePeriod(query.period as PeriodKey) };
}

function netForRow(amountCents: number, refundedCents: number, feeCents: number | null, lostDisputeCents: number) {
  return amountCents - refundedCents - (feeCents ?? 0) - lostDisputeCents;
}

// ---------- Overview ----------

ownerRouter.get("/overview", async (req, res) => {
  const mode = req.query.mode === "test" ? "test" : "live";
  const livemode = mode === "live";
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - ONLINE_WINDOW_MS);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const todayPeriod = resolvePeriod("today", now);
  const monthPeriod = resolvePeriod("month", now);

  const [
    registeredUsers,
    onlineUsers,
    registrations,
    forges,
    activeSubscriptions,
    failedWebhooks,
    openDisputes,
    recentAdminActions,
    today,
    month,
    services,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { lastSeenAt: { gte: fiveMinutesAgo } } }),
    Promise.all([
      prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
    ]),
    prisma.forge.count(),
    prisma.billingSubscription.count({ where: { livemode, status: { in: ["ACTIVE", "TRIALING"] } } }),
    prisma.webhookEvent.count({ where: { status: "FAILED" } }),
    prisma.paymentDispute.count({ where: { status: "OPEN", transaction: { livemode } } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, operation: true, resourceType: true, resourceId: true, actorId: true, status: true, createdAt: true, endpoint: true },
    }),
    getFinanceTotals(todayPeriod, livemode),
    getFinanceTotals(monthPeriod, livemode),
    getServiceChecks(),
  ]);

  const alerts: Array<{ level: "critical" | "warning"; message: string }> = [];
  for (const service of services) {
    if (service.status === "Offline") alerts.push({ level: "critical", message: `${service.name} is offline: ${service.detail}` });
    if (service.status === "Degraded") alerts.push({ level: "warning", message: `${service.name} is degraded: ${service.detail}` });
  }
  if (failedWebhooks > 0) alerts.push({ level: "critical", message: `${failedWebhooks} payment webhook event(s) failed and are waiting for Stripe to retry.` });
  if (openDisputes > 0) alerts.push({ level: "warning", message: `${openDisputes} open payment dispute(s) need a response.` });
  if (month.failedCount > 0) alerts.push({ level: "warning", message: `${month.failedCount} failed payment(s) this month.` });

  res.json({
    generatedAt: now.toISOString(),
    mode,
    users: {
      registered: registeredUsers,
      onlineNow: onlineUsers,
      onlineDefinition: "lastSeenAt within the last 5 minutes",
      registeredLast24h: registrations[0],
      registeredLast7d: registrations[1],
      registeredLast30d: registrations[2],
    },
    communities: { forges },
    subscriptions: { activePaid: activeSubscriptions, definition: "BillingSubscription rows with status ACTIVE or TRIALING in the selected mode" },
    revenue: { today, month },
    services,
    alerts,
    recentAdminActions,
  });
});

// ---------- Live status ----------

ownerRouter.get("/services", async (_req, res) => {
  const checkedAt = new Date().toISOString();
  const services = await getServiceChecks();
  const counts = services.reduce<Record<ServiceStatus, number>>(
    (acc, service) => {
      acc[service.status] += 1;
      return acc;
    },
    { Online: 0, Degraded: 0, Offline: 0, Unknown: 0, "Not Configured": 0 },
  );
  res.json({ checkedAt, counts, services, host: getHostMetrics() });
});

// ---------- Finance ----------

ownerRouter.get("/finance/summary", async (req, res) => {
  const query = parseQuery(periodQuerySchema, req.query, res);
  if (!query) return;
  const resolved = resolvePeriodFromQuery(query);
  if ("error" in resolved) {
    res.status(400).json({ error: resolved.error });
    return;
  }
  const { period } = resolved;
  const livemode = query.mode === "live";

  const [totals, previous, breakdown, recurring, subscriptions, trend, expenseTotal, lastSync] = await Promise.all([
    getFinanceTotals(period, livemode),
    period.previousStart && period.previousEnd ? getFinanceTotals({ start: period.previousStart, end: period.previousEnd }, livemode) : Promise.resolve(null),
    getRevenueBreakdown(period, livemode),
    getRecurringRevenue(livemode),
    getSubscriptionSnapshot(livemode),
    getTrend(period, livemode),
    prisma.expense.count({ where: { deletedAt: null } }),
    prisma.webhookEvent.findFirst({ where: { status: "PROCESSED", livemode }, orderBy: { processedAt: "desc" }, select: { processedAt: true } }),
  ]);

  res.json({
    mode: query.mode,
    period: { key: period.key, start: period.start?.toISOString() ?? null, end: period.end?.toISOString() ?? null },
    totals,
    previousTotals: previous,
    breakdown,
    recurring,
    subscriptions,
    trend,
    coverage: {
      capturedPaymentsWithFee: totals.feeKnownCount,
      capturedPayments: totals.capturedCount,
      expenseRecordsAllTime: expenseTotal,
      profitLabel: "Recorded profit based on available data",
    },
    provider: {
      name: "Stripe",
      configured: Boolean(env.STRIPE_SECRET_KEY),
      webhookConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET),
      lastSyncedAt: lastSync?.processedAt?.toISOString() ?? null,
      settlementBalance: "Not connected: Stripe balance data is not read by this app",
    },
  });
});

const transactionQuerySchema = z.object({
  status: z.nativeEnum(PaymentStatus).optional(),
  kind: z.enum(["SUBSCRIPTION", "RENEWAL", "ONE_TIME", "COIN_PACK"]).optional(),
  featureCode: z.enum(["CORE_PLUS", "FORGE_BOOST_PACK", "CREATOR_CAMPAIGN_SLOT", "EVENT_TICKET_PASS", "TEAM_BRANDING_KIT", "ADVANCED_MODERATION_AI", "COIN_PACK"]).optional(),
  provider: z.enum(["STRIPE"]).optional(),
  mode: modeSchema,
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().max(120).optional(),
  ...pagination,
});

ownerRouter.get("/finance/transactions", async (req, res) => {
  const query = parseQuery(transactionQuerySchema, req.query, res);
  if (!query) return;

  const where: Prisma.PaymentTransactionWhereInput = {
    livemode: query.mode === "live",
    ...(query.status ? { status: query.status } : {}),
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.featureCode ? { featureCode: query.featureCode } : {}),
    ...(query.provider ? { provider: query.provider } : {}),
    ...(query.from || query.to ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lt: query.to } : {}) } } : {}),
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
        disputes: { select: { id: true, amountCents: true, status: true, providerStatus: true, createdAt: true, closedAt: true } },
      },
    }),
  ]);

  res.json({
    page: query.page,
    pageSize: query.pageSize,
    total,
    items: rows.map((row) => {
      const lostDisputeCents = row.disputes.filter((dispute) => dispute.status === "LOST").reduce((sum, dispute) => sum + dispute.amountCents, 0);
      return {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        status: row.status,
        kind: row.kind,
        provider: row.provider,
        livemode: row.livemode,
        featureCode: row.featureCode,
        tier: row.tier,
        grossCents: row.amountCents,
        refundedCents: row.refundedCents,
        feeCents: row.feeCents,
        feeReported: row.feeCents !== null,
        netCents: netForRow(row.amountCents, row.refundedCents, row.feeCents, lostDisputeCents),
        currency: row.currency,
        providerPaymentId: row.providerPaymentId,
        providerPaymentIntentId: row.providerPaymentIntentId,
        providerSubscriptionId: row.providerSubscriptionId,
        user: row.user,
        disputes: row.disputes,
      };
    }),
  });
});

ownerRouter.get("/finance/transactions/:id", async (req, res) => {
  const row = await prisma.paymentTransaction.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, username: true, email: true } },
      refunds: { orderBy: { createdAt: "asc" } },
      disputes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  const subscription = row.providerSubscriptionId
    ? await prisma.billingSubscription.findUnique({
        where: { providerSubscriptionId: row.providerSubscriptionId },
        select: { status: true, tier: true, interval: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, livemode: true },
      })
    : null;

  const lostDisputeCents = row.disputes.filter((dispute) => dispute.status === "LOST").reduce((sum, dispute) => sum + dispute.amountCents, 0);

  res.json({
    transaction: {
      id: row.id,
      status: row.status,
      kind: row.kind,
      provider: row.provider,
      livemode: row.livemode,
      featureCode: row.featureCode,
      tier: row.tier,
      grossCents: row.amountCents,
      refundedCents: row.refundedCents,
      feeCents: row.feeCents,
      netCents: netForRow(row.amountCents, row.refundedCents, row.feeCents, lostDisputeCents),
      currency: row.currency,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      providerPaymentId: row.providerPaymentId,
      providerPaymentIntentId: row.providerPaymentIntentId,
      providerSubscriptionId: row.providerSubscriptionId,
      providerEventId: row.providerEventId,
      user: row.user,
    },
    refunds: row.refunds,
    disputes: row.disputes,
    subscription,
  });
});

ownerRouter.get("/finance/subscriptions", async (req, res) => {
  const query = parseQuery(
    z.object({ status: z.nativeEnum(BillingStatus).optional(), mode: modeSchema, ...pagination }),
    req.query,
    res,
  );
  if (!query) return;

  const where: Prisma.BillingSubscriptionWhereInput = { livemode: query.mode === "live", ...(query.status ? { status: query.status } : {}) };
  const [total, rows] = await Promise.all([
    prisma.billingSubscription.count({ where }),
    prisma.billingSubscription.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { user: { select: { id: true, username: true, email: true } } },
    }),
  ]);

  res.json({
    page: query.page,
    pageSize: query.pageSize,
    total,
    items: rows.map((row) => ({
      id: row.id,
      status: row.status,
      tier: row.tier,
      interval: row.interval,
      livemode: row.livemode,
      startedAt: row.createdAt,
      currentPeriodEnd: row.currentPeriodEnd,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      providerSubscriptionId: row.providerSubscriptionId,
      user: row.user,
      updatedAt: row.updatedAt,
    })),
  });
});

ownerRouter.get("/finance/webhooks", async (req, res) => {
  const query = parseQuery(z.object({ status: z.enum(["PROCESSED", "FAILED"]).optional(), ...pagination }), req.query, res);
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

// ---------- Expenses (owner-recorded, audited) ----------

// No defaults here: a PATCH must only change the fields the owner sent.
const expenseFieldsSchema = z.object({
  category: z.nativeEnum(ExpenseCategory),
  customCategory: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().min(1).max(500),
  amountCents: z.number().int().min(1).max(1_000_000_000_000),
  currency: z.string().trim().regex(/^[a-zA-Z]{3}$/),
  incurredOn: z.coerce.date(),
  recurring: z.boolean(),
  reference: z.string().trim().max(200).optional().nullable(),
});
const expenseInputSchema = expenseFieldsSchema.extend({
  currency: expenseFieldsSchema.shape.currency.default("usd"),
  recurring: expenseFieldsSchema.shape.recurring.default(false),
});

function expenseSnapshot(row: {
  id: string;
  category: ExpenseCategory;
  customCategory: string | null;
  description: string;
  amountCents: number;
  currency: string;
  incurredOn: Date;
  recurring: boolean;
  reference: string | null;
}) {
  return {
    id: row.id,
    category: row.category,
    customCategory: row.customCategory,
    description: row.description,
    amountCents: row.amountCents,
    currency: row.currency,
    incurredOn: row.incurredOn.toISOString(),
    recurring: row.recurring,
    reference: row.reference,
  };
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  params: { operation: AuditOperation; resourceId: string; actorId: string; endpoint: string; method: string; before: unknown; after: unknown; changedFields: string[] },
) {
  await tx.auditLog.create({
    data: {
      operation: params.operation,
      resourceType: "Expense",
      resourceId: params.resourceId,
      actorId: params.actorId,
      status: AuditStatus.SUCCESS,
      endpoint: params.endpoint,
      method: params.method,
      beforeValues: params.before as Prisma.InputJsonValue ?? Prisma.JsonNull,
      afterValues: params.after as Prisma.InputJsonValue ?? Prisma.JsonNull,
      changedFields: params.changedFields,
      requestId: randomUUID(),
    },
  });
}

ownerRouter.get("/finance/expenses", async (req, res) => {
  const query = parseQuery(
    z.object({
      category: z.nativeEnum(ExpenseCategory).optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      ...pagination,
    }),
    req.query,
    res,
  );
  if (!query) return;

  const where: Prisma.ExpenseWhereInput = {
    deletedAt: null,
    ...(query.category ? { category: query.category } : {}),
    ...(query.from || query.to ? { incurredOn: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lt: query.to } : {}) } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({ where, orderBy: { incurredOn: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
  ]);
  res.json({ page: query.page, pageSize: query.pageSize, total, items: rows.map(expenseSnapshot) });
});

ownerRouter.post("/finance/expenses", async (req, res) => {
  const parsed = expenseInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid expense", details: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  if (data.category === ExpenseCategory.OTHER && !data.customCategory) {
    res.status(400).json({ error: "customCategory is required for OTHER expenses" });
    return;
  }

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.expense.create({
      data: {
        category: data.category,
        customCategory: data.customCategory ?? null,
        description: data.description,
        amountCents: data.amountCents,
        currency: data.currency.toLowerCase(),
        incurredOn: data.incurredOn,
        recurring: data.recurring,
        reference: data.reference ?? null,
        createdById: req.user!.id,
        updatedById: req.user!.id,
      },
    });
    await writeAudit(tx, {
      operation: AuditOperation.CREATE,
      resourceId: row.id,
      actorId: req.user!.id,
      endpoint: req.originalUrl,
      method: "POST",
      before: null,
      after: expenseSnapshot(row),
      changedFields: Object.keys(expenseSnapshot(row)),
    });
    return row;
  });
  res.status(201).json({ expense: expenseSnapshot(created) });
});

ownerRouter.patch("/finance/expenses/:id", async (req, res) => {
  const parsed = expenseFieldsSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid expense", details: parsed.error.flatten() });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.expense.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!before) return null;
    const patch = parsed.data;
    const row = await tx.expense.update({
      where: { id: before.id },
      data: {
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.customCategory !== undefined ? { customCategory: patch.customCategory ?? null } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.amountCents !== undefined ? { amountCents: patch.amountCents } : {}),
        ...(patch.currency !== undefined ? { currency: patch.currency.toLowerCase() } : {}),
        ...(patch.incurredOn !== undefined ? { incurredOn: patch.incurredOn } : {}),
        ...(patch.recurring !== undefined ? { recurring: patch.recurring } : {}),
        ...(patch.reference !== undefined ? { reference: patch.reference ?? null } : {}),
        updatedById: req.user!.id,
      },
    });
    const beforeSnapshot = expenseSnapshot(before);
    const afterSnapshot = expenseSnapshot(row);
    const changedFields = Object.keys(afterSnapshot).filter((key) => JSON.stringify((beforeSnapshot as Record<string, unknown>)[key]) !== JSON.stringify((afterSnapshot as Record<string, unknown>)[key]));
    await writeAudit(tx, {
      operation: AuditOperation.UPDATE,
      resourceId: row.id,
      actorId: req.user!.id,
      endpoint: req.originalUrl,
      method: "PATCH",
      before: beforeSnapshot,
      after: afterSnapshot,
      changedFields,
    });
    return row;
  });

  if (!updated) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.json({ expense: expenseSnapshot(updated) });
});

ownerRouter.delete("/finance/expenses/:id", async (req, res) => {
  const deleted = await prisma.$transaction(async (tx) => {
    const before = await tx.expense.findFirst({ where: { id: req.params.id, deletedAt: null } });
    if (!before) return false;
    await tx.expense.update({ where: { id: before.id }, data: { deletedAt: new Date(), updatedById: req.user!.id } });
    await writeAudit(tx, {
      operation: AuditOperation.DELETE,
      resourceId: before.id,
      actorId: req.user!.id,
      endpoint: req.originalUrl,
      method: "DELETE",
      before: expenseSnapshot(before),
      after: null,
      changedFields: ["deletedAt"],
    });
    return true;
  });

  if (!deleted) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.status(204).end();
});

// ---------- Memberships ----------

ownerRouter.get("/memberships", async (req, res) => {
  const mode = req.query.mode === "test" ? "test" : "live";
  const livemode = mode === "live";

  const [byStatus, premiumUsers, premiumWithBilling, premiumWithoutBilling, paidMembers, premiumWithoutCapturedPayment, byTier] = await Promise.all([
    prisma.billingSubscription.groupBy({ by: ["status"], where: { livemode }, _count: { _all: true } }),
    prisma.user.count({ where: { premium: true } }),
    prisma.user.count({ where: { premium: true, billingSubscriptions: { some: { livemode } } } }),
    prisma.user.count({ where: { premium: true, billingSubscriptions: { none: { livemode } } } }),
    prisma.user.count({
      where: { paymentTransactions: { some: { livemode, status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.REFUNDED, PaymentStatus.DISPUTED] } } } },
    }),
    prisma.user.count({
      where: {
        premium: true,
        paymentTransactions: { none: { livemode, status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.REFUNDED, PaymentStatus.DISPUTED] } } },
      },
    }),
    prisma.user.groupBy({ by: ["premiumTier"], where: { premium: true }, _count: { _all: true } }),
  ]);

  const statusCounts = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all]));
  res.json({
    mode,
    totals: {
      totalAccounts: await prisma.user.count(),
      freeAccounts: await prisma.user.count({ where: { premium: false } }),
      premiumFlagAccounts: premiumUsers,
      paidSubscribersActive: (statusCounts.ACTIVE ?? 0) + (statusCounts.TRIALING ?? 0),
      pastDue: statusCounts.PAST_DUE ?? 0,
      canceledOrExpired: (statusCounts.CANCELED ?? 0) + (statusCounts.EXPIRED ?? 0),
      lifetime: "Not tracked: this app has no lifetime membership record",
      suspendedAccounts: await prisma.user.count({ where: { suspendedAt: { not: null } } }),
    },
    reconciliation: {
      premiumWithBillingRecord: premiumWithBilling,
      premiumWithoutBillingRecord: premiumWithoutBilling,
      premiumWithoutVerifiedPayment: premiumWithoutCapturedPayment,
      accountsWithVerifiedPayment: paidMembers,
      note: "Premium without a billing record may be a manual grant, a legacy grant, or a bypass. It is not counted as a paid subscriber.",
    },
    premiumByTier: byTier.map((row) => ({ tier: row.premiumTier, count: row._count._all })),
  });
});

// ---------- Users ----------

ownerRouter.get("/users", async (req, res) => {
  const query = parseQuery(z.object({ q: z.string().trim().max(120).optional(), ...pagination }), req.query, res);
  if (!query) return;

  const where: Prisma.UserWhereInput = query.q
    ? { OR: [{ username: { contains: query.q, mode: "insensitive" } }, { email: { contains: query.q, mode: "insensitive" } }, { id: query.q }] }
    : {};
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        username: true,
        email: true,
        appRole: true,
        premium: true,
        premiumTier: true,
        emailVerified: true,
        suspendedAt: true,
        createdAt: true,
        lastSeenAt: true,
      },
    }),
  ]);

  const now = Date.now();
  res.json({
    page: query.page,
    pageSize: query.pageSize,
    total,
    items: rows.map((row) => ({
      ...row,
      online: row.lastSeenAt ? now - row.lastSeenAt.getTime() < ONLINE_WINDOW_MS : false,
    })),
  });
});

ownerRouter.get("/users/:id", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      username: true,
      email: true,
      appRole: true,
      premium: true,
      premiumTier: true,
      emailVerified: true,
      phoneVerified: true,
      ageVerified: true,
      suspendedAt: true,
      suspensionReason: true,
      createdAt: true,
      lastSeenAt: true,
      billingSubscriptions: {
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, tier: true, interval: true, livemode: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, createdAt: true },
      },
      paymentTransactions: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, status: true, kind: true, featureCode: true, amountCents: true, refundedCents: true, currency: true, livemode: true, createdAt: true },
      },
    },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const auditEvents = await prisma.auditLog.findMany({
    where: { resourceId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, operation: true, resourceType: true, status: true, createdAt: true, endpoint: true },
  });

  res.json({
    user,
    auditEvents,
    membership: {
      hasVerifiedPayment: user.paymentTransactions.some((payment) => payment.livemode && ["SUCCEEDED", "REFUNDED", "DISPUTED"].includes(payment.status)),
      premiumWithoutBillingRecord: user.premium && user.billingSubscriptions.length === 0,
    },
  });
});

// ---------- Communities ----------

ownerRouter.get("/communities", async (req, res) => {
  const query = parseQuery(z.object({ q: z.string().trim().max(120).optional(), ...pagination }), req.query, res);
  if (!query) return;

  const where: Prisma.ForgeWhereInput = query.q ? { name: { contains: query.q, mode: "insensitive" } } : {};
  const [total, rows] = await Promise.all([
    prisma.forge.count({ where }),
    prisma.forge.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        name: true,
        createdAt: true,
        owner: { select: { id: true, username: true } },
        _count: { select: { members: true, channels: true } },
      },
    }),
  ]);

  res.json({
    page: query.page,
    pageSize: query.pageSize,
    total,
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
      owner: row.owner,
      memberCount: row._count.members,
      channelCount: row._count.channels,
    })),
  });
});

// ---------- Developer platform (no secrets are returned) ----------

ownerRouter.get("/developer", async (_req, res) => {
  const [apiKeys, enabledApiKeys, webhookSubscriptions, enabledWebhooks, botApps, publicBotApps, recentWebhookFailures] = await Promise.all([
    prisma.apiKey.count(),
    prisma.apiKey.count({ where: { enabled: true } }),
    prisma.webhookSubscription.count(),
    prisma.webhookSubscription.count({ where: { enabled: true } }),
    prisma.botApp.count(),
    prisma.botApp.count({ where: { isPublic: true } }),
    prisma.webhookEvent.count({ where: { status: "FAILED" } }),
  ]);
  res.json({
    apiKeys: { total: apiKeys, enabled: enabledApiKeys, note: "Key values and hashes are never returned" },
    webhooks: { total: webhookSubscriptions, enabled: enabledWebhooks, note: "Signing secrets are never returned. Per-delivery health is not recorded for developer webhooks yet." },
    botApps: { total: botApps, public: publicBotApps },
    oauthClients: "Not shown: no owner-level listing exists yet",
    stripeWebhookFailures: recentWebhookFailures,
  });
});

// ---------- Store and purchases ----------

ownerRouter.get("/store", async (req, res) => {
  const mode = req.query.mode === "test" ? "test" : "live";
  const livemode = mode === "live";
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [cosmeticItems, cosmeticPurchases, cosmeticPurchasesLast30d, shopItems, coinPackPayments, failedPurchases, pendingPurchases] = await Promise.all([
    prisma.cosmeticItem.count(),
    prisma.userCosmetic.count(),
    prisma.userCosmetic.count({ where: { acquiredAt: { gte: monthAgo } } }),
    prisma.shopItem.count(),
    prisma.paymentTransaction.aggregate({
      where: { livemode, kind: "COIN_PACK", status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.REFUNDED, PaymentStatus.DISPUTED] } },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.paymentTransaction.count({ where: { livemode, status: PaymentStatus.FAILED } }),
    prisma.paymentTransaction.count({ where: { livemode, status: PaymentStatus.PENDING } }),
  ]);
  res.json({
    mode,
    coinStore: {
      itemsInCatalog: cosmeticItems,
      cosmeticPurchasesAllTime: cosmeticPurchases,
      cosmeticPurchasesLast30d,
      note: "Cosmetic purchases are paid with in-app coins. Money from coin packs is in the Finance section.",
    },
    coinPacks: { paidCount: coinPackPayments._count._all, grossCents: coinPackPayments._sum.amountCents ?? 0 },
    shopItemsDefined: shopItems,
    failedPurchases,
    pendingPurchases,
    appleGoogleBilling: { status: "Not Configured", note: "No store billing integration exists in this codebase" },
  });
});

// ---------- Audit log ----------

ownerRouter.get("/audit", async (req, res) => {
  const query = parseQuery(
    z.object({
      operation: z.nativeEnum(AuditOperation).optional(),
      resourceType: z.string().trim().max(60).optional(),
      status: z.nativeEnum(AuditStatus).optional(),
      ...pagination,
    }),
    req.query,
    res,
  );
  if (!query) return;

  const where: Prisma.AuditLogWhereInput = {
    ...(query.operation ? { operation: query.operation } : {}),
    ...(query.resourceType ? { resourceType: query.resourceType } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { actor: { select: { id: true, username: true } } },
    }),
  ]);
  res.json({
    page: query.page,
    pageSize: query.pageSize,
    total,
    items: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      operation: row.operation,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      status: row.status,
      endpoint: row.endpoint,
      method: row.method,
      actor: row.actor,
      changedFields: row.changedFields,
      afterValues: row.afterValues,
    })),
  });
});

// ---------- Support (no data source yet) ----------

ownerRouter.get("/support", (_req, res) => {
  res.json({
    available: false,
    reason: "No support ticket or message report data model exists in this application yet, so there is nothing to show.",
    tickets: null,
    reports: null,
  });
});

// ---------- Legal and release ----------

ownerRouter.get("/release", (_req, res) => {
  res.json({
    appVersion: process.env.npm_package_version ?? null,
    legal: {
      termsVersion: null,
      privacyVersion: null,
      note: "No terms or privacy version records exist in this application.",
    },
    deployment: { status: "Not connected", note: "No deployment history is recorded by this app." },
  });
});
