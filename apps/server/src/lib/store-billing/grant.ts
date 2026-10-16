import { createHash } from "node:crypto";
import { prisma } from "../prisma.js";
import { adjustAddon, setStorePurchaseStatus, syncStorePremium } from "./lifecycle.js";
import { StoreVerifyError, type VerifiedStorePurchase } from "./types.js";

// Grants a verified store purchase the same way the Stripe checkout does: a Core+ subscription sets the user's plan,
// an add-on adds to their entitlement. The purchase record and the grant are written in one transaction, so either
// both are saved or neither is, and a retry applies the purchase cleanly.

export function receiptHashOf(receipt: string): string {
  return createHash("sha256").update(receipt).digest("hex");
}

/**
 * A store transaction seen before. For the same account it is a retry: if it was refunded or lapsed and the store
 * now says it is active again, it is reinstated; otherwise nothing changes. For another account it is already
 * claimed, and is refused.
 */
async function resolveExisting(
  existing: { id: string; userId: string; provider: string; transactionId: string; status: string },
  purchase: VerifiedStorePurchase,
  userId: string,
): Promise<"applied" | "duplicate"> {
  if (existing.userId !== userId) throw new StoreVerifyError("CLAIMED", "This purchase is already linked to another account");
  if (existing.status === "ACTIVE") return "duplicate";
  const result = await setStorePurchaseStatus({
    provider: purchase.provider,
    transactionId: purchase.transactionId,
    status: "ACTIVE",
    expiresAt: purchase.expiresAt,
  });
  return result === "changed" ? "applied" : "duplicate";
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
  const existing = await prisma.storePurchase.findUnique({ where: transactionKey, select: { id: true, userId: true, provider: true, transactionId: true, status: true } });
  if (existing) return resolveExisting(existing, purchase, userId);

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
        await syncStorePremium(tx, userId, new Date());
        await tx.user.updateMany({ where: { id: userId, lifetimeMember: false }, data: { corePlusActivatedAt: new Date() } });
      } else {
        await adjustAddon(tx, userId, grant.featureCode, 1, purchase.provider);
      }
    });
  } catch (error) {
    // Two deliveries at the same moment: the other one recorded it first.
    if ((error as { code?: string }).code === "P2002") {
      const recorded = await prisma.storePurchase.findUnique({ where: transactionKey, select: { id: true, userId: true, provider: true, transactionId: true, status: true } });
      if (recorded) return resolveExisting(recorded, purchase, userId);
    }
    throw error;
  }
  return "applied";
}
