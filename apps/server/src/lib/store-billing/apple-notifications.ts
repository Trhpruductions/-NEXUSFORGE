import { prisma } from "../prisma.js";
import { purchaseFromApplePayload, signAppleBearer, verifySignedTransaction, type AppleConfig } from "./apple.js";
import { applyStorePurchase } from "./grant.js";
import { setStorePurchaseStatus } from "./lifecycle.js";
import { StoreVerifyError, type VerifiedStorePurchase } from "./types.js";

// Apple tells the server about renewals, refunds and expiries as signed notifications, and the server can also ask
// Apple for a subscription's current state. Both checks use the same signature checks as a client purchase.

type FetchLike = typeof fetch;

type ApplePayload = Parameters<typeof purchaseFromApplePayload>[0] & { bundleId?: string; transactionId?: string };

export type AppleOutcome = "granted" | "duplicate" | "status-updated" | "ignored";

const HOSTS = {
  PRODUCTION: "https://api.storekit.itunes.apple.com",
  SANDBOX: "https://api.storekit-sandbox.itunes.apple.com",
} as const;
const WRONG_ENVIRONMENT_CODE = 4040010;

/**
 * Applies one signed Apple transaction. An active one is granted (a renewal, or a reversed refund reinstated). Any other
 * is recorded with its status. Transactions for products we do not sell, or for accounts that do not exist here, are ignored.
 */
export async function applySignedAppleTransaction(input: {
  signedTransactionInfo: string;
  config: AppleConfig;
  now: Date;
}): Promise<AppleOutcome> {
  const payload = verifySignedTransaction(input.signedTransactionInfo, input.config.rootCertPem, input.now) as ApplePayload;
  if (payload.bundleId !== input.config.bundleId) throw new StoreVerifyError("INVALID_PURCHASE", "This purchase is for a different app");
  if (typeof payload.transactionId !== "string") throw new StoreVerifyError("INVALID_PURCHASE", "Apple transaction has no id");

  let purchase: VerifiedStorePurchase;
  try {
    purchase = purchaseFromApplePayload(payload, { transactionId: payload.transactionId, bundleId: input.config.bundleId, now: input.now });
  } catch (error) {
    // A product we do not sell, or one of the wrong type, is not ours to grant. Ignore it rather than ask Apple to resend.
    if (error instanceof StoreVerifyError && (error.code === "UNKNOWN_PRODUCT" || error.code === "INVALID_PURCHASE")) return "ignored";
    throw error;
  }

  if (purchase.status !== "ACTIVE") {
    const changed = await setStorePurchaseStatus({ provider: "APPLE", transactionId: purchase.transactionId, status: purchase.status, now: input.now });
    return changed === "changed" ? "status-updated" : "ignored";
  }

  const userId = purchase.accountToken;
  if (!userId || !(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) return "ignored";
  const outcome = await applyStorePurchase({ userId, purchase, receipt: purchase.transactionId });
  return outcome === "applied" ? "granted" : "duplicate";
}

/**
 * Handles one App Store Server Notification (V2). The notification is only trusted once its signature checks out,
 * and the transaction inside it is checked the same way.
 */
export async function handleAppleNotification(input: {
  signedPayload: string;
  config: AppleConfig;
  now: Date;
}): Promise<{ outcome: AppleOutcome; type: string }> {
  const notification = verifySignedTransaction(input.signedPayload, input.config.rootCertPem, input.now) as {
    notificationType?: string;
    data?: { bundleId?: string; signedTransactionInfo?: unknown };
  };
  const type = notification.notificationType ?? "";
  if (notification.data?.bundleId !== undefined && notification.data.bundleId !== input.config.bundleId) {
    throw new StoreVerifyError("INVALID_PURCHASE", "This notification is for a different app");
  }

  // Some notifications carry no transaction (Apple sends these for some renewal and preference events).
  const transactionJws = notification.data?.signedTransactionInfo;
  if (typeof transactionJws !== "string") return { outcome: "ignored", type };

  switch (type) {
    case "SUBSCRIBED":
    case "DID_RENEW":
    case "REFUND_REVERSED":
      return { outcome: await applySignedAppleTransaction({ signedTransactionInfo: transactionJws, config: input.config, now: input.now }), type };
    case "EXPIRED":
    case "GRACE_PERIOD_EXPIRED":
    case "REFUND":
    case "REVOKE": {
      const payload = verifySignedTransaction(transactionJws, input.config.rootCertPem, input.now) as ApplePayload;
      if (typeof payload.transactionId !== "string") return { outcome: "ignored", type };
      const status = type === "EXPIRED" || type === "GRACE_PERIOD_EXPIRED" ? "EXPIRED" : "REVOKED";
      const changed = await setStorePurchaseStatus({ provider: "APPLE", transactionId: payload.transactionId, status, now: input.now });
      return { outcome: changed === "changed" ? "status-updated" : "ignored", type };
    }
    default:
      return { outcome: "ignored", type };
  }
}

export type AppleSubscriptionState =
  | { state: "ACTIVE"; transactionId: string; signedTransactionInfo: string }
  | { state: "EXPIRED" | "REVOKED" | "UNKNOWN" };

async function getStatuses(fetchImpl: FetchLike, host: string, originalTransactionId: string, bearer: string) {
  let response: Response;
  try {
    response = await fetchImpl(`${host}/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
  } catch {
    throw new StoreVerifyError("STORE_UNAVAILABLE", "Apple could not be reached");
  }
  const body = (await response.json().catch(() => null)) as { data?: { lastTransactions?: { status?: number; signedTransactionInfo?: unknown }[] }[]; errorCode?: number } | null;
  return { status: response.status, body };
}

/**
 * Asks Apple for the current state of a subscription, from any of its original transaction ids. Status codes:
 * 1 active, 4 in the billing grace period (still paid), 2 expired, 5 revoked. Anything else (such as 3, billing
 * retry) is treated as not paid.
 */
export async function fetchAppleSubscriptionState(input: {
  config: AppleConfig;
  originalTransactionId: string;
  now: Date;
  fetchImpl?: FetchLike;
}): Promise<AppleSubscriptionState> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const bearer = signAppleBearer(input.config, Math.floor(input.now.getTime() / 1000));

  let lookup = await getStatuses(fetchImpl, HOSTS.PRODUCTION, input.originalTransactionId, bearer);
  if (lookup.status === 404 && lookup.body?.errorCode === WRONG_ENVIRONMENT_CODE) {
    lookup = await getStatuses(fetchImpl, HOSTS.SANDBOX, input.originalTransactionId, bearer);
  }
  if (lookup.status === 404) return { state: "UNKNOWN" };
  if (lookup.status !== 200) throw new StoreVerifyError("STORE_UNAVAILABLE", `Apple could not report the subscription (HTTP ${lookup.status})`);

  const entries = (lookup.body?.data ?? []).flatMap((group) => group.lastTransactions ?? []);
  const paid = entries.filter((entry) => (entry.status === 1 || entry.status === 4) && typeof entry.signedTransactionInfo === "string");
  let best: { transactionId: string; signedTransactionInfo: string; expiresDate: number } | null = null;
  for (const entry of paid) {
    const jws = entry.signedTransactionInfo as string;
    const payload = verifySignedTransaction(jws, input.config.rootCertPem, input.now) as { transactionId?: string; expiresDate?: number };
    if (typeof payload.transactionId !== "string" || payload.expiresDate === undefined) continue;
    if (payload.expiresDate > input.now.getTime() && (!best || payload.expiresDate > best.expiresDate)) {
      best = { transactionId: payload.transactionId, signedTransactionInfo: jws, expiresDate: payload.expiresDate };
    }
  }
  if (best) return { state: "ACTIVE", transactionId: best.transactionId, signedTransactionInfo: best.signedTransactionInfo };
  if (entries.some((entry) => entry.status === 5)) return { state: "REVOKED" };
  if (entries.some((entry) => entry.status === 2)) return { state: "EXPIRED" };
  return { state: "UNKNOWN" };
}
