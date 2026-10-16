import { DisputeStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "./prisma.js";

/**
 * Revenue definitions used by the Owner Console. Every number comes from verified rows.
 *
 *  - Gross collected: amount of payments Stripe captured (SUCCEEDED, REFUNDED or DISPUTED).
 *  - Refunds: sum of Stripe refund records created in the window.
 *  - Lost disputes: amount of disputes Stripe closed as lost.
 *  - Open disputes: money at risk. Shown separately and not deducted from net.
 *  - Fees: Stripe processing fees where the balance transaction was readable.
 *  - Net collected = gross - refunds - lost disputes - fees (fees counted only when known).
 *  - Pending and failed payments are never included in gross or net.
 *
 * Windows are by record date (payment date for payments, refund date for refunds).
 */

const CAPTURED: PaymentStatus[] = [PaymentStatus.SUCCEEDED, PaymentStatus.REFUNDED, PaymentStatus.DISPUTED];

export type FinanceWindow = "today" | "week" | "month" | "all";

export function windowStart(window: FinanceWindow, now = new Date()): Date | null {
  if (window === "all") return null;
  const start = new Date(now);
  if (window === "today") {
    start.setUTCHours(0, 0, 0, 0);
  } else if (window === "week") {
    start.setTime(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    start.setTime(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return start;
}

function createdSince(start: Date | null) {
  return start ? { gte: start } : undefined;
}

export async function getFinanceWindowTotals(window: FinanceWindow) {
  const start = windowStart(window);
  const createdAt = createdSince(start);

  const [captured, pending, failed, refunds, lostDisputes, openDisputes] = await Promise.all([
    prisma.paymentTransaction.aggregate({
      where: { status: { in: CAPTURED }, createdAt },
      _sum: { amountCents: true, feeCents: true },
      _count: { _all: true },
    }),
    prisma.paymentTransaction.aggregate({
      where: { status: PaymentStatus.PENDING, createdAt },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.paymentTransaction.count({ where: { status: PaymentStatus.FAILED, createdAt } }),
    prisma.paymentRefund.aggregate({ where: { createdAt }, _sum: { amountCents: true }, _count: { _all: true } }),
    prisma.paymentDispute.aggregate({
      where: { status: DisputeStatus.LOST, createdAt },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.paymentDispute.aggregate({
      where: { status: DisputeStatus.OPEN, createdAt },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
  ]);

  const grossCents = captured._sum.amountCents ?? 0;
  const refundCents = refunds._sum.amountCents ?? 0;
  const lostDisputeCents = lostDisputes._sum.amountCents ?? 0;
  const feeCents = captured._sum.feeCents ?? 0;

  return {
    window,
    since: start?.toISOString() ?? null,
    grossCents,
    refundCents,
    refundCount: refunds._count._all,
    lostDisputeCents,
    lostDisputeCount: lostDisputes._count._all,
    openDisputeCents: openDisputes._sum.amountCents ?? 0,
    openDisputeCount: openDisputes._count._all,
    feeCents,
    netCents: grossCents - refundCents - lostDisputeCents - feeCents,
    capturedCount: captured._count._all,
    pendingCents: pending._sum.amountCents ?? 0,
    pendingCount: pending._count._all,
    failedCount: failed,
  };
}

export async function getSubscriptionSnapshot() {
  const [active, pastDue, canceled, byTier] = await Promise.all([
    prisma.billingSubscription.count({ where: { status: { in: ["ACTIVE", "TRIALING"] } } }),
    prisma.billingSubscription.count({ where: { status: "PAST_DUE" } }),
    prisma.billingSubscription.count({ where: { status: { in: ["CANCELED", "EXPIRED"] } } }),
    prisma.billingSubscription.groupBy({
      by: ["tier"],
      where: { status: { in: ["ACTIVE", "TRIALING"] } },
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
