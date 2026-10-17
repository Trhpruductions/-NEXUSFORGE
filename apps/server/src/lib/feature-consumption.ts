import { prisma } from "./prisma.js";

/** Add-ons that are used up one unit at a time. Each purchase adds units to the entitlement's quantity. */
export type ConsumableFeatureCode = "FORGE_BOOST_PACK" | "CREATOR_CAMPAIGN_SLOT" | "EVENT_TICKET_PASS";

export type ConsumptionResult = { consumed: number; remaining: number };

/**
 * Takes `quantity` units off an add-on, or refuses. The check and the decrement are one conditional UPDATE, so two
 * requests at the same moment can't both use the last unit, and the balance never goes below zero. Returns null when
 * the entitlement is missing, inactive, expired, or has fewer units than requested.
 */
export async function consumeFeatureQuantity(userId: string, featureCode: ConsumableFeatureCode, quantity: number, now = new Date()): Promise<ConsumptionResult | null> {
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.featureEntitlement.updateMany({
      where: {
        userId,
        featureCode,
        active: true,
        quantity: { gte: quantity },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: { quantity: { decrement: quantity } },
    });
    if (updated.count !== 1) return null;
    const row = await tx.featureEntitlement.findUnique({
      where: { userId_featureCode: { userId, featureCode } },
      select: { quantity: true },
    });
    return { consumed: quantity, remaining: row?.quantity ?? 0 };
  });
}
