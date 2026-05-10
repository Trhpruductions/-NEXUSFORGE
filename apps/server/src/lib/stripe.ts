import Stripe from "stripe";
import { env } from "../config/env.js";

export type BillableTier = "CORE" | "PLUS" | "ELITE" | "INFINITE";
export type BillableInterval = "MONTHLY" | "YEARLY";
export type PaidFeatureCode =
  | "CORE_PLUS"
  | "FORGE_BOOST_PACK"
  | "CREATOR_CAMPAIGN_SLOT"
  | "EVENT_TICKET_PASS"
  | "TEAM_BRANDING_KIT"
  | "ADVANCED_MODERATION_AI";

export const stripeClient = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      // Keep SDK-managed default API version to match current Stripe package types.
    })
  : null;

type StripePriceMap = {
  tierPrices: Record<BillableTier, Record<BillableInterval, string | undefined>>;
  addonPrices: Record<Exclude<PaidFeatureCode, "CORE_PLUS">, string | undefined>;
};

export const stripePriceMap: StripePriceMap = {
  tierPrices: {
    CORE: {
      MONTHLY: env.STRIPE_PRICE_CORE_MONTHLY,
      YEARLY: env.STRIPE_PRICE_CORE_YEARLY,
    },
    PLUS: {
      MONTHLY: env.STRIPE_PRICE_PLUS_MONTHLY,
      YEARLY: env.STRIPE_PRICE_PLUS_YEARLY,
    },
    ELITE: {
      MONTHLY: env.STRIPE_PRICE_ELITE_MONTHLY,
      YEARLY: env.STRIPE_PRICE_ELITE_YEARLY,
    },
    INFINITE: {
      MONTHLY: env.STRIPE_PRICE_INFINITE_MONTHLY,
      YEARLY: env.STRIPE_PRICE_INFINITE_YEARLY,
    },
  },
  addonPrices: {
    FORGE_BOOST_PACK: env.STRIPE_PRICE_FORGE_BOOST_PACK,
    CREATOR_CAMPAIGN_SLOT: env.STRIPE_PRICE_CREATOR_CAMPAIGN_SLOT,
    EVENT_TICKET_PASS: env.STRIPE_PRICE_EVENT_TICKET_PASS,
    TEAM_BRANDING_KIT: env.STRIPE_PRICE_TEAM_BRANDING_KIT,
    ADVANCED_MODERATION_AI: env.STRIPE_PRICE_ADVANCED_MODERATION_AI,
  },
};

export function getTierPriceId(tier: BillableTier, interval: BillableInterval): string | null {
  return stripePriceMap.tierPrices[tier][interval] ?? null;
}

export function getAddonPriceId(featureCode: Exclude<PaidFeatureCode, "CORE_PLUS">): string | null {
  return stripePriceMap.addonPrices[featureCode] ?? null;
}

export function resolveTierFromPriceId(priceId: string): BillableTier | null {
  for (const [tier, intervals] of Object.entries(stripePriceMap.tierPrices) as Array<[
    BillableTier,
    Record<BillableInterval, string | undefined>,
  ]>) {
    if (intervals.MONTHLY === priceId || intervals.YEARLY === priceId) {
      return tier;
    }
  }
  return null;
}

export function resolveIntervalFromPriceId(priceId: string): BillableInterval | null {
  for (const intervals of Object.values(stripePriceMap.tierPrices)) {
    if (intervals.MONTHLY === priceId) return "MONTHLY";
    if (intervals.YEARLY === priceId) return "YEARLY";
  }
  return null;
}

export function resolveFeatureFromPriceId(priceId: string): PaidFeatureCode | null {
  if (resolveTierFromPriceId(priceId)) {
    return "CORE_PLUS";
  }

  for (const [featureCode, mappedPrice] of Object.entries(stripePriceMap.addonPrices) as Array<[
    Exclude<PaidFeatureCode, "CORE_PLUS">,
    string | undefined,
  ]>) {
    if (mappedPrice === priceId) {
      return featureCode;
    }
  }

  return null;
}
