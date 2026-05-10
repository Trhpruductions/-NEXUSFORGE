import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

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

export async function hasActiveFeatureEntitlement(userId: string, featureCode: Exclude<FeatureCode, "CORE_PLUS">) {
  const entitlement = await prisma.featureEntitlement.findUnique({
    where: {
      userId_featureCode: {
        userId,
        featureCode,
      },
    },
    select: {
      active: true,
      quantity: true,
      expiresAt: true,
    },
  });

  const now = new Date();
  return (
    Boolean(entitlement?.active) &&
    (entitlement?.quantity ?? 0) > 0 &&
    (!entitlement?.expiresAt || entitlement.expiresAt > now)
  );
}

export function requireMinimumPremiumTier(minimumTier: "CORE" | "PLUS" | "ELITE" | "INFINITE") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { premium: true, premiumTier: true },
    });

    if (!user?.premium || !hasMinimumTier(user.premiumTier, minimumTier)) {
      res.status(402).json({
        error: "Payment required",
        feature: "CORE_PLUS",
        requiredTier: minimumTier,
      });
      return;
    }

    next();
  };
}

export function requirePaidFeature(featureCode: Exclude<FeatureCode, "CORE_PLUS">) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const valid = await hasActiveFeatureEntitlement(req.user.id, featureCode);

    if (!valid) {
      res.status(402).json({
        error: "Payment required",
        feature: featureCode,
      });
      return;
    }

    next();
  };
}
