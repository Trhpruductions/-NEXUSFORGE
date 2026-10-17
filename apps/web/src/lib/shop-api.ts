import { api, authHeaders, getBillingPlans, getCosmeticCatalog, type CosmeticItem, type PlanInfo } from "./api";

/** One mining rig tier, priced in Nexus Forge Coins. */
export type RigTier = { tier: string; cost: number; hashRate: number; efficiency: number };

export type ShopOverview = {
  /** Null means that section could not be loaded. The rest of the shop still shows. */
  coins: number | null;
  cosmetics: { total: number; owned: number; cheapest: number | null; featured: CosmeticItem[] } | null;
  plans: { enforced: boolean; tiers: PlanInfo[] } | null;
  rigs: RigTier[] | null;
  jackpot: { myTickets: number; playerCount: number } | null;
};

const FEATURED_COUNT = 4;

/**
 * Everything that can be bought, in one call. Each section loads on its own, so a failure in
 * one (say, mining) only hides that section; the rest of the shop keeps working.
 */
export async function getShopOverview(accessToken: string): Promise<ShopOverview> {
  const [catalog, plans, rigs, jackpot] = await Promise.allSettled([
    getCosmeticCatalog(accessToken),
    getBillingPlans(),
    api.get<Array<{ tier: string; cost: string; hashRate: number; efficiency: number }>>("/api/mining/pricing").then((response) => response.data),
    api.get<{ myTickets: number; playerCount: number }>("/api/jackpot/current", { headers: authHeaders(accessToken) }).then((response) => response.data),
  ]);

  const cosmetics = catalog.status === "fulfilled" ? catalog.value : null;
  const notOwned = cosmetics ? cosmetics.items.filter((item) => !item.owned).sort((a, b) => a.priceCoins - b.priceCoins) : [];

  return {
    coins: cosmetics ? cosmetics.coins : null,
    cosmetics: cosmetics
      ? {
          total: cosmetics.items.length,
          owned: cosmetics.items.filter((item) => item.owned).length,
          cheapest: notOwned[0]?.priceCoins ?? null,
          featured: notOwned.slice(0, FEATURED_COUNT),
        }
      : null,
    plans: plans.status === "fulfilled" ? { enforced: plans.value.enforced, tiers: plans.value.plans.filter((plan) => plan.tier !== "NONE") } : null,
    rigs:
      rigs.status === "fulfilled"
        ? rigs.value.map((rig) => ({ tier: rig.tier, cost: Number(rig.cost), hashRate: rig.hashRate, efficiency: rig.efficiency }))
        : null,
    jackpot: jackpot.status === "fulfilled" ? { myTickets: jackpot.value.myTickets, playerCount: jackpot.value.playerCount } : null,
  };
}
