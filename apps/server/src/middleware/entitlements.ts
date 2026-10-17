import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

export type FeatureCode =
  | "CORE_PLUS"
  | "FORGE_BOOST_PACK"
  | "CREATOR_CAMPAIGN_SLOT"
  | "EVENT_TICKET_PASS"
  | "TEAM_BRANDING_KIT"
  | "ADVANCED_MODERATION_AI";

const tierRank: Record<"NONE" | "CORE" | "PLUS" | "ELITE" | "INFINITE", number> = {
  NONE: 0,
  CORE: 1,
  PLUS: 2,
  ELITE: 3,
  INFINITE: 4,
};

function hasMinimumTier(currentTier: string, minimumTier: "CORE" | "PLUS" | "ELITE" | "INFINITE") {
  const current = (currentTier in tierRank ? currentTier : "NONE") as keyof typeof tierRank;
  return tierRank[current] >= tierRank[minimumTier];
}

/**
 * Paid features are enforced when billing is connected (STRIPE_SECRET_KEY set), and always in production.
 * A production server with no billing key must not open every paid feature for free, so it fails closed.
 * Development and test servers with no key stay open, so they can be used without a payment setup.
 */
export function billingEnforcedFor(input: { stripeSecretKey?: string | undefined; nodeEnv: string }): boolean {
  return Boolean(input.stripeSecretKey) || input.nodeEnv === "production";
}

export function billingEnforced() {
  return billingEnforcedFor({ stripeSecretKey: env.STRIPE_SECRET_KEY, nodeEnv: env.NODE_ENV });
}

export async function hasActiveFeatureEntitlement(userId: string, featureCode: Exclude<FeatureCode, "CORE_PLUS">) {
  if (!billingEnforced()) return true;
  const entitlement = await prisma.featureEntitlement.findFirst({
    where: { userId, featureCode, active: true, quantity: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { id: true },
  });
  return Boolean(entitlement);
}

export function requireMinimumPremiumTier(minimumTier: "CORE" | "PLUS" | "ELITE" | "INFINITE") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!billingEnforced()) {
      next();
      return;
    }
    const user = req.user ? await prisma.user.findUnique({ where: { id: req.user.id }, select: { premiumTier: true } }) : null;
    if (!user || !hasMinimumTier(user.premiumTier, minimumTier)) {
      res.status(402).json({ error: `This needs Core+ ${minimumTier} or higher.`, code: "UPGRADE_REQUIRED", minimumTier });
      return;
    }
    next();
  };
}

export function requirePaidFeature(featureCode: Exclude<FeatureCode, "CORE_PLUS">) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || !(await hasActiveFeatureEntitlement(req.user.id, featureCode))) {
      res.status(402).json({ error: "This is a paid feature. Get it from the Pricing page.", code: "PAYMENT_REQUIRED", featureCode });
      return;
    }
    next();
  };
}
