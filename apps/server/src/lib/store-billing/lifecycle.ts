import type { Prisma, PaidFeatureCode } from "@prisma/client";
import { prisma } from "../prisma.js";
import type { StoreProvider } from "./types.js";

// One place decides what a store purchase's status means for the user: a subscription sets the Core+ tier while it is
// active, and an add-on's units are added and taken back. Stripe subscriptions and lifetime membership are respected
// everywhere: store changes never remove them.

export type PurchaseStatus = "ACTIVE" | "EXPIRED" | "REVOKED";
type Tier = "CORE" | "PLUS" | "ELITE" | "INFINITE";
type Db = Prisma.TransactionClient;

const TIER_RANK: Tier[] = ["CORE", "PLUS", "ELITE", "INFINITE"];

export function boostLevelFor(tier: Tier): number {
  return tier === "INFINITE" ? 5 : tier === "ELITE" ? 3 : tier === "PLUS" ? 2 : 1;
}

function highestTier(tiers: Tier[]): Tier | null {
  let best: Tier | null = null;
  for (const tier of tiers) {
    if (best === null || TIER_RANK.indexOf(tier) > TIER_RANK.indexOf(best)) best = tier;
  }
  return best;
}

/**
 * Brings the user's premium fields in line with every source that is still live: active Stripe subscriptions and
 * active store subscriptions. The user gets the highest tier among them, so a plan change or an upgrade takes effect,
 * and a cancellation or refund takes effect too. With no live source, premium ends. Lifetime members are never changed.
 */
export async function syncStorePremium(db: Db, userId: string, now: Date = new Date()): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { lifetimeMember: true } });
  if (!user || user.lifetimeMember) return;

  const stripeActive = await db.billingSubscription.findMany({
    where: { userId, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
    select: { tier: true },
  });
  const storeActive = await db.storePurchase.findMany({
    where: { userId, status: "ACTIVE", tier: { not: null }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    select: { tier: true },
  });
  const best = highestTier([...stripeActive.map((row) => row.tier as Tier), ...storeActive.map((row) => row.tier as Tier)]);

  if (best) {
    await db.user.updateMany({
      where: { id: userId, lifetimeMember: false },
      data: { premium: true, premiumTier: best, corePlusBoostLevel: boostLevelFor(best) },
    });
    return;
  }
  await db.user.updateMany({
    where: { id: userId, lifetimeMember: false },
    data: { premium: false, premiumTier: "NONE" },
  });
}

/**
 * Adds one unit of an add-on (+1) or takes one back (-1). Taking back never goes below zero, so units the user has
 * already used are not clawed back.
 */
export async function adjustAddon(db: Db, userId: string, featureCode: PaidFeatureCode, delta: 1 | -1, source: StoreProvider): Promise<void> {
  const key = { userId_featureCode: { userId, featureCode } };
  const current = await db.featureEntitlement.findUnique({ where: key, select: { quantity: true } });
  if (!current) {
    if (delta > 0) await db.featureEntitlement.create({ data: { userId, featureCode, source, active: true, quantity: 1 } });
    return;
  }
  const quantity = Math.max(0, current.quantity + delta);
  await db.featureEntitlement.update({ where: key, data: { quantity, active: quantity > 0 } });
}

/**
 * Moves a stored store purchase to a new status and updates the user to match. Returns "unknown" when the store
 * transaction was never recorded here, and "unchanged" when it already has that status (so repeated notifications
 * do nothing).
 */
export async function setStorePurchaseStatus(input: {
  provider: StoreProvider;
  transactionId: string;
  status: PurchaseStatus;
  /** Set when a purchase is reinstated, so its expiry reflects the store's latest answer. */
  expiresAt?: Date | null;
  now?: Date;
}): Promise<"changed" | "unchanged" | "unknown"> {
  const now = input.now ?? new Date();
  const row = await prisma.storePurchase.findUnique({
    where: { provider_transactionId: { provider: input.provider, transactionId: input.transactionId } },
    select: { id: true, userId: true, provider: true, tier: true, featureCode: true, status: true },
  });
  if (!row) return "unknown";
  if (row.status === input.status) return "unchanged";

  const changed = await prisma.$transaction(async (tx) => {
    // The status is only moved from the value we read, so two notifications for the same change apply it once.
    const data = input.expiresAt === undefined ? { status: input.status } : { status: input.status, expiresAt: input.expiresAt };
    const moved = await tx.storePurchase.updateMany({ where: { id: row.id, status: row.status }, data });
    if (moved.count === 0) return false;

    if (row.featureCode) {
      const wasActive = row.status === "ACTIVE";
      const isActive = input.status === "ACTIVE";
      if (wasActive !== isActive) await adjustAddon(tx, row.userId, row.featureCode, isActive ? 1 : -1, row.provider as StoreProvider);
    }
    if (row.tier) await syncStorePremium(tx, row.userId, now);
    return true;
  });
  return changed ? "changed" : "unchanged";
}
