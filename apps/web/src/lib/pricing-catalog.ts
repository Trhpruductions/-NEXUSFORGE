import type { PaidFeatureCode } from "@/lib/api";

export type CorePlusTier = "CORE" | "PLUS" | "ELITE" | "INFINITE";

export const CORE_PLUS_TIER_PRICING: Record<CorePlusTier, { label: string; monthly: string; yearly: string; yearlySavings: string }> = {
  CORE: {
    label: "Starter Core",
    monthly: "$3.99",
    yearly: "$39",
    yearlySavings: "Save 18%",
  },
  PLUS: {
    label: "Plus Command",
    monthly: "$9.99",
    yearly: "$99",
    yearlySavings: "Save 17%",
  },
  ELITE: {
    label: "Elite Creator",
    monthly: "$19.99",
    yearly: "$199",
    yearlySavings: "Save 17%",
  },
  INFINITE: {
    label: "Infinite League",
    monthly: "$39.99",
    yearly: "$399",
    yearlySavings: "Save 17%",
  },
};

export const CORE_PLUS_TIER_DISPLAY_LABELS: Record<CorePlusTier, string> = {
  CORE: CORE_PLUS_TIER_PRICING.CORE.label,
  PLUS: CORE_PLUS_TIER_PRICING.PLUS.label,
  ELITE: CORE_PLUS_TIER_PRICING.ELITE.label,
  INFINITE: CORE_PLUS_TIER_PRICING.INFINITE.label,
};

export const PAID_FEATURE_DISPLAY_LABELS: Record<PaidFeatureCode, string> = {
  CORE_PLUS: "Core+ subscription",
  FORGE_BOOST_PACK: "Forge Boost Packs",
  CREATOR_CAMPAIGN_SLOT: "Creator Campaign Slot",
  EVENT_TICKET_PASS: "Event Ticket Pass",
  TEAM_BRANDING_KIT: "Team Branding Kit",
  ADVANCED_MODERATION_AI: "Advanced Moderation AI",
};

export const PAID_FEATURE_PRICE_LABELS: Record<PaidFeatureCode, string> = {
  CORE_PLUS: "Tier-based monthly or yearly",
  FORGE_BOOST_PACK: "$3 / $8 / $19",
  CREATOR_CAMPAIGN_SLOT: "$29 per campaign",
  EVENT_TICKET_PASS: "$2 to $9 per event",
  TEAM_BRANDING_KIT: "$12 one-time",
  ADVANCED_MODERATION_AI: "$9 per forge / month",
};