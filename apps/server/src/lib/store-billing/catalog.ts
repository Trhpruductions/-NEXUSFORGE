import type { StoreProductGrant } from "./types.js";

// The store product IDs, shared by Apple and Google. They must match the products created in App Store Connect and
// Google Play Console. Until those exist these are placeholders, and a purchase for an ID not listed here is refused.
const TIERS = ["CORE", "PLUS", "ELITE", "INFINITE"] as const;
const INTERVALS = ["monthly", "yearly"] as const;
const ADDONS = [
  "FORGE_BOOST_PACK",
  "CREATOR_CAMPAIGN_SLOT",
  "EVENT_TICKET_PASS",
  "TEAM_BRANDING_KIT",
  "ADVANCED_MODERATION_AI",
] as const;

const CATALOG = new Map<string, StoreProductGrant>();
for (const tier of TIERS) {
  for (const interval of INTERVALS) {
    CATALOG.set(`nfg.coreplus.${tier.toLowerCase()}.${interval}`, { kind: "SUBSCRIPTION", tier });
  }
}
for (const featureCode of ADDONS) {
  CATALOG.set(`nfg.addon.${featureCode.toLowerCase()}`, { kind: "ADDON", featureCode });
}

/** What a store product grants, or null when the product is not one we sell. */
export function grantForProduct(productId: string): StoreProductGrant | null {
  return CATALOG.get(productId) ?? null;
}

/** Every product ID this server will grant. Tests and store setup read this list. */
export function catalogProductIds(): string[] {
  return [...CATALOG.keys()];
}
