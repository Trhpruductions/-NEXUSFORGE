import { DisputeStatus, ExpenseCategory, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

/**
 * Financial definitions used by the Owner Console. Every figure comes from verified rows.
 *
 *  - Gross collected: amount of payments Stripe captured (SUCCEEDED, REFUNDED or DISPUTED).
 *  - Refunds: refund records created in the period, for payments in the selected mode.
 *  - Lost disputes: disputes Stripe closed as lost, in the period.
 *  - Open disputes: money at risk. Shown separately and not deducted from net.
 *  - Processing fees: Stripe fees recorded on payments in the period, where Stripe reported them.
 *  - Net collected = gross - refunds - lost disputes - processing fees.
 *  - Operating expenses: recorded Expense rows in the period, excluding PAYMENT_PROCESSING, because
 *    those fees are already deducted through Stripe. Expenses are never taken from payment data.
 *  - Recorded operating profit = net collected - operating expenses. It is labelled as based on the
 *    recorded data, and the coverage fields show how many expenses were entered.
 *  - Pending and failed payments are never included in gross or net.
 *  - MRR: the last captured recurring charge for each ACTIVE or TRIALING subscription, normalised to a
 *    month (yearly charges divided by 12). Discounts, prorations and tax are not modelled.
 *
 * Periods are UTC. Each period is compared with the previous window of equal length.
 */

const CAPTURED: PaymentStatus[] = [PaymentStatus.SUCCEEDED, PaymentStatus.REFUNDED, PaymentStatus.DISPUTED];

export const PERIOD_KEYS = [
  "today",
  "yesterday",
  "week",
  "last_week",
  "month",
  "last_month",
  "last_30",
  "last_90",
  "year",
  "last_year",
  "all",
  "custom",
] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export type ResolvedPeriod = {
  key: PeriodKey;
  start: Date | null;
  end: Date | null;
  previousStart: Date | null;
  previousEnd: Date | null;
};

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date: Date) {
  // Weeks start on Monday, UTC.
  const day = startOfUtcDay(date);
  const offset = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - offset * 86_400_000);
}

export function resolvePeriod(key: PeriodKey, now = new Date(), custom?: { from: Date; to: Date }): ResolvedPeriod {
  const todayStart = startOfUtcDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
  const weekStart = startOfUtcWeek(now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  let start: Date | null = null;
  let end: Date | null = null;

  switch (key) {
    case "today":
      start = todayStart;
      end = tomorrowStart;
      break;
    case "yesterday":
      start = new Date(todayStart.getTime() - 86_400_000);
      end = todayStart;
      break;
    case "week":
      start = weekStart;
      end = new Date(weekStart.getTime() + 7 * 86_400_000);
      break;
    case "last_week":
      start = new Date(weekStart.getTime() - 7 * 86_400_000);
      end = weekStart;
      break;
    case "month":
      start = monthStart;
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      break;
    case "last_month":
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      end = monthStart;
      break;
    case "last_30":
      start = new Date(now.getTime() - 30 * 86_400_000);
      end = now;
      break;
    case "last_90":
      start = new Date(now.getTime() - 90 * 86_400_000);
      end = now;
      break;
    case "year":
      start = yearStart;
      end = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
      break;
    case "last_year":
      start = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
      end = yearStart;
      break;
    case "custom":
      if (!custom) throw new Error("custom period needs from and to");
      start = custom.from;
      end = custom.to;
      break;
    case "all":
      break;
  }

  let previousStart: Date | null = null;
  let previousEnd: Date | null = null;
  if (start && end) {
    const length = end.getTime() - start.getTime();
    previousEnd = start;
    previousStart = new Date(start.getTime() - length);
  }

  return { key, start, end, previousStart, previousEnd };
}

function createdIn(start: Date | null, end: Date | null) {
  if (!start && !end) return undefined;
  return { ...(start ? { gte: start } : {}), ...(end ? { lt: end } : {}) };
}

export type FinanceTotals = {
  grossCents: number;
  capturedCount: number;
  refundCents: number;
  refundCount: number;
  lostDisputeCents: number;
  lostDisputeCount: number;
  openDisputeCents: number;
  openDisputeCount: number;
  feeCents: number;
  feeKnownCount: number;
  netCents: number;
  pendingCents: number;
  pendingCount: number;
  failedCount: number;
  operatingExpenseCents: number;
  operatingExpenseCount: number;
  recordedProfitCents: number;
};

export async function getFinanceTotals(period: { start: Date | null; end: Date | null }, livemode: boolean): Promise<FinanceTotals> {
  const createdAt = createdIn(period.start, period.end);
  const mode = { livemode };

  const [captured, pending, failed, refunds, lostDisputes, openDisputes, expenses] = await Promise.all([
    prisma.paymentTransaction.aggregate({
      where: { ...mode, status: { in: CAPTURED }, createdAt },
      _sum: { amountCents: true, feeCents: true },
      _count: { _all: true },
    }),
    prisma.paymentTransaction.aggregate({
      where: { ...mode, status: PaymentStatus.PENDING, createdAt },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.paymentTransaction.count({ where: { ...mode, status: PaymentStatus.FAILED, createdAt } }),
    prisma.paymentRefund.aggregate({
      where: { createdAt, transaction: mode },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.paymentDispute.aggregate({
      where: { status: DisputeStatus.LOST, createdAt, transaction: mode },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.paymentDispute.aggregate({
      where: { status: DisputeStatus.OPEN, createdAt, transaction: mode },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    // Expenses are not tied to a payment mode. They are business costs, recorded once by the owner.
    prisma.expense.aggregate({
      where: {
        deletedAt: null,
        category: { not: ExpenseCategory.PAYMENT_PROCESSING },
        incurredOn: createdIn(period.start, period.end),
      },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
  ]);

  const grossCents = captured._sum.amountCents ?? 0;
  const refundCents = refunds._sum.amountCents ?? 0;
  const lostDisputeCents = lostDisputes._sum.amountCents ?? 0;
  const feeCents = captured._sum.feeCents ?? 0;
  const netCents = grossCents - refundCents - lostDisputeCents - feeCents;
  const operatingExpenseCents = expenses._sum.amountCents ?? 0;

  const feeKnown = await prisma.paymentTransaction.count({
    where: { ...mode, status: { in: CAPTURED }, createdAt, feeCents: { not: null } },
  });

  return {
    grossCents,
    capturedCount: captured._count._all,
    refundCents,
    refundCount: refunds._count._all,
    lostDisputeCents,
    lostDisputeCount: lostDisputes._count._all,
    openDisputeCents: openDisputes._sum.amountCents ?? 0,
    openDisputeCount: openDisputes._count._all,
    feeCents,
    feeKnownCount: feeKnown,
    netCents,
    pendingCents: pending._sum.amountCents ?? 0,
    pendingCount: pending._count._all,
    failedCount: failed,
    operatingExpenseCents,
    operatingExpenseCount: expenses._count._all,
    recordedProfitCents: netCents - operatingExpenseCents,
  };
}

export async function getRevenueBreakdown(period: { start: Date | null; end: Date | null }, livemode: boolean) {
  const createdAt = createdIn(period.start, period.end);
  const rows = await prisma.paymentTransaction.groupBy({
    by: ["featureCode", "kind", "provider"],
    where: { livemode, status: { in: CAPTURED }, createdAt },
    _sum: { amountCents: true, feeCents: true },
    _count: { _all: true },
  });
  return rows.map((row) => ({
    featureCode: row.featureCode,
    kind: row.kind,
    provider: row.provider,
    grossCents: row._sum.amountCents ?? 0,
    feeCents: row._sum.feeCents ?? 0,
    count: row._count._all,
  }));
}

export async function getRecurringRevenue(livemode: boolean) {
  const rows = (await prisma.$queryRaw(Prisma.sql`
    SELECT DISTINCT ON (pt."providerSubscriptionId")
           pt."providerSubscriptionId" AS "providerSubscriptionId",
           pt."amountCents" AS "amountCents",
           bs."interval"::text AS "interval"
    FROM "PaymentTransaction" pt
    JOIN "BillingSubscription" bs ON bs."providerSubscriptionId" = pt."providerSubscriptionId"
    WHERE pt."livemode" = ${livemode}
      AND pt."kind" IN ('SUBSCRIPTION', 'RENEWAL')
      AND pt."status" IN ('SUCCEEDED', 'REFUNDED', 'DISPUTED')
      AND bs."status" IN ('ACTIVE', 'TRIALING')
      AND bs."livemode" = ${livemode}
    ORDER BY pt."providerSubscriptionId", pt."createdAt" DESC
  `)) as Array<{ providerSubscriptionId: string; amountCents: number; interval: string }>;

  let mrrCents = 0;
  for (const row of rows) {
    const monthly = row.interval === "YEARLY" ? row.amountCents / 12 : row.amountCents;
    mrrCents += monthly;
  }
  const activeSubscriptions = await prisma.billingSubscription.count({
    where: { livemode, status: { in: ["ACTIVE", "TRIALING"] } },
  });

  return {
    mrrCents: Math.round(mrrCents),
    arrCents: Math.round(mrrCents * 12),
    subscriptionsWithRevenueBasis: rows.length,
    activeSubscriptions,
    assumption: "MRR uses each active subscription's last captured charge, normalised to a month. Discounts, prorations and tax are not modelled.",
  };
}

export async function getSubscriptionSnapshot(livemode: boolean) {
  const [active, pastDue, canceled, byTier] = await Promise.all([
    prisma.billingSubscription.count({ where: { livemode, status: { in: ["ACTIVE", "TRIALING"] } } }),
    prisma.billingSubscription.count({ where: { livemode, status: "PAST_DUE" } }),
    prisma.billingSubscription.count({ where: { livemode, status: { in: ["CANCELED", "EXPIRED"] } } }),
    prisma.billingSubscription.groupBy({
      by: ["tier"],
      where: { livemode, status: { in: ["ACTIVE", "TRIALING"] } },
      _count: { _all: true },
    }),
  ]);

  return {
    active,
    pastDue,
    canceled,
    byTier: byTier.map((row) => ({ tier: row.tier, count: row._count._all })),
  };
}

export async function getTrend(period: { start: Date | null; end: Date | null }, livemode: boolean) {
  const since = period.start ?? new Date(0);
  const until = period.end ?? new Date(Date.now() + 86_400_000);
  const rows = (await prisma.$queryRaw(Prisma.sql`
    SELECT date_trunc('day', "createdAt") AS day,
           COALESCE(SUM("amountCents"), 0) AS "grossCents",
           COUNT(*) AS count
    FROM "PaymentTransaction"
    WHERE "livemode" = ${livemode}
      AND status IN ('SUCCEEDED', 'REFUNDED', 'DISPUTED')
      AND "createdAt" >= ${since} AND "createdAt" < ${until}
    GROUP BY 1
    ORDER BY 1
  `)) as Array<{ day: Date; grossCents: bigint; count: bigint }>;

  return rows.map((row) => ({
    day: row.day.toISOString().slice(0, 10),
    grossCents: Number(row.grossCents),
    count: Number(row.count),
  }));
}
