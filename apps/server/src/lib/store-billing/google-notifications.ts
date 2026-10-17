import { prisma } from "../prisma.js";
import { verifyGooglePurchase, type GoogleConfig } from "./google.js";
import { applyStorePurchase } from "./grant.js";
import { setStorePurchaseStatus } from "./lifecycle.js";
import { StoreVerifyError } from "./types.js";

// Google Play sends real-time developer notifications through Pub/Sub. A notification only says that something changed,
// so the server asks Google for the purchase's current state and acts on that answer, never on the message's contents.

type FetchLike = typeof fetch;

type DeveloperNotification = {
  packageName?: string;
  testNotification?: unknown;
  subscriptionNotification?: { purchaseToken?: string; subscriptionId?: string };
  voidedPurchaseNotification?: { orderId?: string; purchaseToken?: string; productType?: number };
};

export type GoogleOutcome = "granted" | "duplicate" | "status-updated" | "test" | "ignored";

/** Reads the developer notification out of a Pub/Sub push envelope. Anything malformed is refused. */
export function decodeDeveloperNotification(envelope: unknown): DeveloperNotification {
  const data = (envelope as { message?: { data?: unknown } } | null)?.message?.data;
  if (typeof data !== "string") throw new StoreVerifyError("INVALID_PURCHASE", "Notification has no message data");
  try {
    return JSON.parse(Buffer.from(data, "base64").toString("utf8")) as DeveloperNotification;
  } catch {
    throw new StoreVerifyError("INVALID_PURCHASE", "Notification data is not valid");
  }
}

export async function handleGoogleNotification(input: {
  envelope: unknown;
  config: GoogleConfig;
  now: Date;
  fetchImpl?: FetchLike;
}): Promise<{ outcome: GoogleOutcome; kind: string }> {
  const note = decodeDeveloperNotification(input.envelope);
  if (note.packageName !== input.config.packageName) return { outcome: "ignored", kind: "package" };
  if (note.testNotification !== undefined) return { outcome: "test", kind: "test" };

  if (note.subscriptionNotification) {
    const { purchaseToken, subscriptionId } = note.subscriptionNotification;
    if (!purchaseToken || !subscriptionId) throw new StoreVerifyError("INVALID_PURCHASE", "Subscription notification is incomplete");

    let verification;
    try {
      verification = await verifyGooglePurchase({ productId: subscriptionId, purchaseToken, config: input.config, fetchImpl: input.fetchImpl, now: input.now });
    } catch (error) {
      // Not a state we act on (on hold, unknown product, no record). Acknowledge the message so Google does not resend it.
      if (error instanceof StoreVerifyError && ["INVALID_PURCHASE", "UNKNOWN_PRODUCT", "NOT_FOUND"].includes(error.code)) {
        return { outcome: "ignored", kind: "subscription" };
      }
      throw error;
    }

    const { purchase, finish } = verification;
    if (purchase.status !== "ACTIVE") {
      const changed = await setStorePurchaseStatus({ provider: "GOOGLE", transactionId: purchase.transactionId, status: purchase.status, now: input.now });
      return { outcome: changed === "changed" ? "status-updated" : "ignored", kind: "subscription" };
    }

    const userId = purchase.accountToken;
    if (!userId || !(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
      return { outcome: "ignored", kind: "subscription" };
    }
    const outcome = await applyStorePurchase({ userId, purchase, receipt: purchaseToken });
    // Google refunds a subscription that is not acknowledged within three days; a failure here is retried on the next notification.
    await finish?.().catch((error: unknown) => {
      console.error("google acknowledgement failed", error instanceof Error ? error.message : error);
    });
    return { outcome: outcome === "applied" ? "granted" : "duplicate", kind: "subscription" };
  }

  if (note.voidedPurchaseNotification) {
    // A refund or cancellation by Google: the voided order is no longer paid for.
    const orderId = note.voidedPurchaseNotification.orderId;
    if (!orderId) return { outcome: "ignored", kind: "voided" };
    const changed = await setStorePurchaseStatus({ provider: "GOOGLE", transactionId: orderId, status: "REVOKED", now: input.now });
    return { outcome: changed === "changed" ? "status-updated" : "ignored", kind: "voided" };
  }

  return { outcome: "ignored", kind: "other" };
}
