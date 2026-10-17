import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { resolveIntervalFromPriceId, resolveTierFromPriceId } from "./stripe.js";
import { syncStorePremium } from "./store-billing/lifecycle.js";

// Stripe webhook bookkeeping: each event is claimed before it is applied, so a repeated delivery is applied once, and
// each subscription remembers the newest event it has applied, so an older event that arrives late cannot overwrite it.

/** A claim whose processing started this long ago is treated as abandoned, so Stripe's retry can apply it. */
const ABANDONED_CLAIM_MS = 5 * 60 * 1000;

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string }).code === "P2002";
}

/**
 * Claims an event for processing. "claimed" means this delivery should apply it. "duplicate" means it was already
 * applied, or another delivery is applying it right now (Stripe retries if that one fails).
 */
export async function claimStripeEvent(event: Stripe.Event): Promise<"claimed" | "duplicate"> {
  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        id: event.id,
        type: event.type,
        livemode: event.livemode,
        stripeCreatedAt: new Date(event.created * 1000),
        status: "APPLYING",
      },
    });
    return "claimed";
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }

  const existing = await prisma.stripeWebhookEvent.findUnique({ where: { id: event.id }, select: { status: true, receivedAt: true } });
  if (!existing || existing.status === "APPLIED") return "duplicate";
  if (Date.now() - existing.receivedAt.getTime() < ABANDONED_CLAIM_MS) return "duplicate";

  // The earlier attempt stopped part way: take the claim over, so this delivery applies the event.
  await prisma.stripeWebhookEvent.updateMany({
    where: { id: event.id, status: "APPLYING", receivedAt: existing.receivedAt },
    data: { receivedAt: new Date() },
  });
  return "claimed";
}

export async function markStripeEventApplied(eventId: string): Promise<void> {
  await prisma.stripeWebhookEvent.update({ where: { id: eventId }, data: { status: "APPLIED", appliedAt: new Date() } });
}

/** Removes a claim whose processing failed, so Stripe's retry can apply the event. */
export async function releaseStripeEvent(eventId: string): Promise<void> {
  await prisma.stripeWebhookEvent.deleteMany({ where: { id: eventId, status: "APPLYING" } });
}

/** Stripe's period fields are Unix seconds. */
export function readSubscriptionPeriod(subscription: unknown): { start: Date | null; end: Date | null } {
  const raw = subscription as { current_period_start?: number; current_period_end?: number };
  const start = typeof raw.current_period_start === "number" ? new Date(raw.current_period_start * 1000) : null;
  const end = typeof raw.current_period_end === "number" ? new Date(raw.current_period_end * 1000) : null;
  return { start, end };
}

type Metadata = Record<string, unknown>;

function metadataOf(value: unknown): Metadata {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Metadata) : {};
}

/** True when an event is older than the newest one this subscription has already applied. */
export function isOlderThanApplied(metadata: unknown, eventCreated: number): boolean {
  const last = metadataOf(metadata).lastStripeEventAt;
  return typeof last === "number" && eventCreated < last;
}

export function stampedMetadata(existing: unknown, event: Stripe.Event): Prisma.InputJsonValue {
  return { ...metadataOf(existing), lastStripeEventAt: event.created, lastStripeEventType: event.type } as Prisma.InputJsonValue;
}

type StripeSubscriptionLike = {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  items: { data: { price: { id: string } }[] };
};

function statusFor(status: string): "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" {
  if (status === "active") return "ACTIVE";
  if (status === "trialing") return "TRIALING";
  if (status === "canceled") return "CANCELED";
  return "PAST_DUE";
}

/**
 * A subscription changed at Stripe (created, updated or deleted). Applies the subscription's current state, then brings
 * the user's premium in line with every live source. A subscription the app did not sell is ignored, because checkout
 * is what records those.
 */
export async function applySubscriptionEvent(event: Stripe.Event): Promise<"applied" | "skipped" | "stale"> {
  const sub = event.data.object as unknown as StripeSubscriptionLike & Parameters<typeof readSubscriptionPeriod>[0];
  const local = await prisma.billingSubscription.findUnique({
    where: { providerSubscriptionId: sub.id },
    select: { id: true, userId: true, metadata: true },
  });
  if (!local) return "skipped";
  if (isOlderThanApplied(local.metadata, event.created)) return "stale";

  const period = readSubscriptionPeriod(sub);
  const providerPriceId = sub.items.data[0]?.price.id ?? null;
  const tier = providerPriceId ? resolveTierFromPriceId(providerPriceId) : null;
  const interval = providerPriceId ? resolveIntervalFromPriceId(providerPriceId) : null;

  await prisma.billingSubscription.update({
    where: { id: local.id },
    data: {
      providerPriceId,
      status: statusFor(sub.status),
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      ...(tier ? { tier } : {}),
      ...(interval ? { interval } : {}),
      metadata: stampedMetadata(local.metadata, event),
    },
  });

  await syncStorePremium(prisma, local.userId);
  return "applied";
}

/**
 * Stamps a subscription with the time of an invoice event, so a later-arriving older event cannot overwrite it.
 * Returns false when the subscription has already applied something newer.
 */
export async function stampSubscriptionFromInvoice(subscriptionId: string, event: Stripe.Event, status?: "PAST_DUE"): Promise<boolean> {
  const local = await prisma.billingSubscription.findUnique({
    where: { providerSubscriptionId: subscriptionId },
    select: { id: true, metadata: true },
  });
  if (!local) return false;
  if (isOlderThanApplied(local.metadata, event.created)) return false;
  await prisma.billingSubscription.update({
    where: { id: local.id },
    data: { ...(status ? { status } : {}), metadata: stampedMetadata(local.metadata, event) },
  });
  return true;
}
