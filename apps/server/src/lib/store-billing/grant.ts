import { createHash } from "node:crypto";
import { prisma } from "../prisma.js";
import { StoreVerifyError, type VerifiedStorePurchase } from "./types.js";

// Grants a verified store purchase the same way the Stripe checkout does: a Core+ subscription sets the user's plan,
// an add-on adds to their entitlement. The purchase record and the grant are written in one transaction, so either
// both are saved or neither is, and a retry applies the purchase cleanly.

function boostLevelFor(tier: "CORE" | "PLUS" | "ELITE" | "INFINITE"): number {
  return tier === "INFINITE" ? 5 : tier === "ELITE" ? 3 : tier === "PLUS" ? 2 : 1;
}

export function receiptHashOf(receipt: string): string {
  return createHash("sha256").update(receipt).digest("hex");
}

// The same store transaction for the same account is a retry, and is not granted again. For another account it is
// already claimed, and is refused.
function existingResult(ownerId: string, userId: string): "duplicate" {
  if (ownerId === userId) return "duplicate";
  throw new StoreVerifyError("CLAIMED", "This purchase is already linked to another account");
}

export async function applyStorePurchase(input: {
  userId: string;
  purchase: VerifiedStorePurchase;
  receipt: string;
}): Promise<"applied" | "duplicate"> {
  const { userId, purchase } = input;
  if (purchase.status === "REVOKED") throw new StoreVerifyError("INVALID_PURCHASE", "This purchase was refunded or revoked");
  if (purchase.status !== "ACTIVE") throw new StoreVerifyError("INVALID_PURCHASE", "This purchase has expired");
  // The purchase must have been made while signed in as this user. The app sends the user's id as the purchase's account token.
  if (purchase.accountToken !== userId) throw new StoreVerifyError("ACCOUNT_MISMATCH", "This purchase was not made under your account");

  const transactionKey = { provider_transactionId: { provider: purchase.provider, transactionId: purchase.transactionId } };
  const existing = await prisma.storePurchase.findUnique({ where: transactionKey, select: { userId: true } });
  if (existing) return existingResult(existing.userId, userId);

  const { grant } = purchase;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.storePurchase.create({
        data: {
          userId,
          provider: purchase.provider,
          productId: purchase.productId,
          transactionId: purchase.transactionId,
          originalTransactionId: purchase.originalTransactionId,
          tier: grant.kind === "SUBSCRIPTION" ? grant.tier : null,
          featureCode: grant.kind === "ADDON" ? grant.featureCode : null,
          status: purchase.status,
          environment: purchase.environment,
          purchasedAt: purchase.purchasedAt,
          expiresAt: purchase.expiresAt,
          receiptHash: receiptHashOf(input.receipt),
        },
      });

      if (grant.kind === "SUBSCRIPTION") {
        // Lifetime members keep their granted tier; a purchase never changes it.
        await tx.user.updateMany({
          where: { id: userId, lifetimeMember: false },
          data: {
            premium: true,
            premiumTier: grant.tier,
            corePlusActivatedAt: new Date(),
            corePlusBoostLevel: boostLevelFor(grant.tier),
          },
        });
      } else {
        await tx.featureEntitlement.upsert({
          where: { userId_featureCode: { userId, featureCode: grant.featureCode } },
          update: { active: true, quantity: { increment: 1 } },
          create: { userId, featureCode: grant.featureCode, source: purchase.provider, active: true, quantity: 1 },
        });
      }
    });
  } catch (error) {
    // Two deliveries at the same moment: the other one recorded it first.
    if ((error as { code?: string }).code === "P2002") {
      const recorded = await prisma.storePurchase.findUnique({ where: transactionKey, select: { userId: true } });
      if (recorded) return existingResult(recorded.userId, userId);
    }
    throw error;
  }
  return "applied";
}
