import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

// Records the payments the webhook learns about after the first checkout: renewals, failed charges, refunds and disputes.
// Each record is keyed by the Stripe object it came from, so a repeated delivery of the same event changes nothing.
// The first invoice of a new subscription is recorded by the checkout itself, so it is not recorded again here.
// Every record stores whether Stripe reported it in live mode (metadata.livemode), so test and live money stay apart.

// Only the Stripe fields these handlers use. The API version differs between invoice shapes, so the rest is not typed.
export type LooseInvoice = {
  id: string;
  livemode?: boolean | null;
  billing_reason?: string | null;
  amount_paid?: number | null;
  amount_due?: number | null;
  currency?: string | null;
  subscription?: unknown;
  parent?: { subscription_details?: { subscription?: unknown } | null } | null;
};

export type LooseCharge = {
  id: string;
  livemode?: boolean | null;
  amount?: number | null;
  amount_refunded?: number | null;
  currency?: string | null;
  payment_intent?: unknown;
  invoice?: unknown;
};

export type LooseDispute = {
  id: string;
  livemode?: boolean | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  reason?: string | null;
  charge?: unknown;
  payment_intent?: unknown;
};

export type LedgerOutcome = "recorded" | "updated" | "skipped" | "duplicate" | "unknown";

/** Looks up what a charge belongs to. Used only when a dispute does not name its payment intent. */
export type ChargeResolver = (chargeId: string) => Promise<{ payment_intent?: unknown; invoice?: unknown }>;

/** The subscription an invoice belongs to, in either the older or the newer Stripe invoice shape. */
export function subscriptionIdOf(invoice: LooseInvoice): string | null {
  const direct = invoice.subscription;
  if (typeof direct === "string" && direct.length > 0) return direct;
  const nested = invoice.parent?.subscription_details?.subscription;
  return typeof nested === "string" && nested.length > 0 ? nested : null;
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string }).code === "P2002";
}

function metadataOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function subscriptionOwner(subscriptionId: string) {
  return prisma.billingSubscription.findUnique({ where: { providerSubscriptionId: subscriptionId }, select: { userId: true, tier: true } });
}

/** A renewal the card was charged for. The first invoice of a subscription is skipped: checkout records that payment. */
export async function recordRenewalPayment(invoice: LooseInvoice): Promise<LedgerOutcome> {
  if (invoice.billing_reason !== "subscription_cycle") return "skipped";
  const subscriptionId = subscriptionIdOf(invoice);
  const amountCents = invoice.amount_paid ?? 0;
  if (!subscriptionId || amountCents <= 0) return "skipped";

  const owner = await subscriptionOwner(subscriptionId);
  if (!owner) return "skipped";

  try {
    await prisma.paymentTransaction.create({
      data: {
        userId: owner.userId,
        provider: "STRIPE",
        providerEventId: `invoice:${invoice.id}`,
        providerPaymentId: invoice.id,
        amountCents,
        currency: invoice.currency ?? "usd",
        status: "SUCCEEDED",
        featureCode: "CORE_PLUS",
        tier: owner.tier,
        metadata: { invoiceId: invoice.id, subscriptionId, billingReason: "subscription_cycle", livemode: invoice.livemode ?? null },
      },
    });
    return "recorded";
  } catch (error) {
    if (isUniqueViolation(error)) return "duplicate";
    throw error;
  }
}

/** A renewal the card could not pay. Stripe sends this again on each retry, so it is keyed by the event. */
export async function recordFailedPayment(eventId: string, invoice: LooseInvoice): Promise<LedgerOutcome> {
  const subscriptionId = subscriptionIdOf(invoice);
  const amountCents = invoice.amount_due ?? 0;
  if (!subscriptionId || amountCents <= 0) return "skipped";

  const owner = await subscriptionOwner(subscriptionId);
  if (!owner) return "skipped";

  try {
    await prisma.paymentTransaction.create({
      data: {
        userId: owner.userId,
        provider: "STRIPE",
        providerEventId: `failed:${eventId}`,
        providerPaymentId: invoice.id,
        amountCents,
        currency: invoice.currency ?? "usd",
        status: "FAILED",
        featureCode: "CORE_PLUS",
        tier: owner.tier,
        metadata: { invoiceId: invoice.id, subscriptionId, livemode: invoice.livemode ?? null },
      },
    });
    return "recorded";
  } catch (error) {
    if (isUniqueViolation(error)) return "duplicate";
    throw error;
  }
}

/**
 * A refund on a charge. Matches the payment the charge belongs to (by payment intent or invoice). A full refund
 * marks the payment REFUNDED; a partial refund keeps it SUCCEEDED and records the refunded amount. The charge's
 * refunded total is cumulative, so applying it again changes nothing.
 */
export async function recordRefund(charge: LooseCharge): Promise<LedgerOutcome> {
  const keys = [charge.payment_intent, charge.invoice].filter((key): key is string => typeof key === "string" && key.length > 0);
  if (keys.length === 0) return "unknown";

  const payments = await prisma.paymentTransaction.findMany({
    where: { providerPaymentId: { in: keys }, status: { in: ["SUCCEEDED", "REFUNDED"] } },
    select: { id: true, amountCents: true, metadata: true },
  });
  if (payments.length === 0) return "unknown";

  const refundedCents = charge.amount_refunded ?? 0;
  for (const payment of payments) {
    const refundedForPayment = Math.min(refundedCents, payment.amountCents);
    const metadata = metadataOf(payment.metadata);
    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        status: refundedForPayment >= payment.amountCents ? "REFUNDED" : "SUCCEEDED",
        metadata: { ...metadata, chargeId: charge.id, amountRefundedCents: refundedForPayment } as Prisma.InputJsonValue,
      },
    });
  }
  return "updated";
}

// Statuses a dispute can have at Stripe. Open ones are money Stripe may still take back; "lost" is money already taken.
const OPEN_DISPUTE_STATUSES = new Set(["needs_response", "under_review", "warning_needs_response", "warning_under_review"]);

/**
 * A dispute (chargeback) opened or closed. The dispute is stored on the payment it belongs to, with two totals:
 * money still open to a dispute, and money lost to one. Won or prevented disputes add nothing to either total.
 * Applying the same dispute again replaces its entry, so repeats change nothing.
 */
export async function recordDispute(dispute: LooseDispute, resolveCharge: ChargeResolver): Promise<LedgerOutcome> {
  let paymentIntent = typeof dispute.payment_intent === "string" && dispute.payment_intent.length > 0 ? dispute.payment_intent : null;
  let invoiceId: string | null = null;
  if (!paymentIntent && typeof dispute.charge === "string") {
    const charge = await resolveCharge(dispute.charge);
    paymentIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
    invoiceId = typeof charge.invoice === "string" ? charge.invoice : null;
  }
  const keys = [paymentIntent, invoiceId].filter((key): key is string => typeof key === "string" && key.length > 0);
  if (keys.length === 0) return "unknown";

  const payments = await prisma.paymentTransaction.findMany({
    where: { providerPaymentId: { in: keys }, status: { in: ["SUCCEEDED", "REFUNDED"] } },
    select: { id: true, metadata: true },
  });
  if (payments.length === 0) return "unknown";

  const entry = {
    id: dispute.id,
    status: dispute.status ?? "unknown",
    amountCents: dispute.amount ?? 0,
    reason: dispute.reason ?? null,
    livemode: dispute.livemode ?? null,
  };

  for (const payment of payments) {
    const metadata = metadataOf(payment.metadata);
    const existing = Array.isArray(metadata.disputes) ? (metadata.disputes as Array<Record<string, unknown>>) : [];
    const disputes = [...existing.filter((item) => item.id !== dispute.id), entry];
    const disputeOpenCents = disputes.filter((item) => OPEN_DISPUTE_STATUSES.has(String(item.status))).reduce((sum, item) => sum + Number(item.amountCents), 0);
    const disputeLostCents = disputes.filter((item) => item.status === "lost").reduce((sum, item) => sum + Number(item.amountCents), 0);
    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        metadata: { ...metadata, disputes, disputeOpenCents, disputeLostCents } as Prisma.InputJsonValue,
      },
    });
  }
  return "updated";
}
