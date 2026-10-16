import { createPrivateKey, createSign } from "node:crypto";
import { grantForProduct } from "./catalog.js";
import { StoreVerifyError, type StoreVerification, type VerifiedStorePurchase } from "./types.js";

// The server asks Google Play about the purchase token with its service account. A purchase is granted only when
// Google's own answer says it is paid for. Google requires every purchase to be acknowledged (subscriptions) or
// consumed (add-ons), otherwise it refunds it after three days, so that happens after the grant is saved.

export type GoogleConfig = {
  packageName: string;
  serviceAccountEmail: string;
  /** The service account's private key (PEM). */
  privateKeyPem: string;
};

type FetchLike = typeof fetch;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

/** The signed assertion Google exchanges for an access token (an RS256 JWT for the service account). */
export function signServiceAccountAssertion(config: GoogleConfig, nowSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: config.serviceAccountEmail, scope: SCOPE, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 }),
  ).toString("base64url");
  const input = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(input).sign(createPrivateKey(config.privateKeyPem)).toString("base64url");
  return `${input}.${signature}`;
}

async function storeCall(fetchImpl: FetchLike, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetchImpl(url, init);
  } catch {
    throw new StoreVerifyError("STORE_UNAVAILABLE", "Google Play could not be reached");
  }
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  return (await response.json().catch(() => null)) as Record<string, unknown> | null;
}

async function accessToken(config: GoogleConfig, fetchImpl: FetchLike, now: Date): Promise<string> {
  const assertion = signServiceAccountAssertion(config, Math.floor(now.getTime() / 1000));
  const response = await storeCall(fetchImpl, TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const body = await readJson(response);
  if (!response.ok || typeof body?.access_token !== "string") {
    throw new StoreVerifyError("STORE_UNAVAILABLE", "Google Play sign-in for the store API failed");
  }
  return body.access_token;
}

type SubscriptionV2 = {
  subscriptionState?: string;
  startTime?: string;
  latestOrderId?: string;
  lineItems?: { productId?: string; expiryTime?: string }[];
  acknowledgementState?: string;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  testPurchase?: unknown;
};

type OneTimeProduct = {
  purchaseState?: number;
  purchaseTimeMillis?: string;
  orderId?: string;
  obfuscatedExternalAccountId?: string;
  consumptionState?: string;
  testPurchaseContext?: unknown;
};

const SUBSCRIPTION_PAID_STATES = new Set(["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"]);

/** Turns Google's subscription answer into a purchase. A subscription that is on hold, paused or pending is refused. */
function subscriptionPurchase(sub: SubscriptionV2, input: { productId: string; purchaseToken: string; now: Date }): VerifiedStorePurchase {
  const grant = grantForProduct(input.productId);
  if (!grant) throw new StoreVerifyError("UNKNOWN_PRODUCT", "This product is not sold in the app");
  if (grant.kind !== "SUBSCRIPTION") throw new StoreVerifyError("INVALID_PURCHASE", "This product is not a subscription");

  const item = sub.lineItems?.find((line) => line.productId === input.productId);
  if (!item) throw new StoreVerifyError("INVALID_PURCHASE", "Google returned a different product than the one requested");
  if (!sub.subscriptionState || !(SUBSCRIPTION_PAID_STATES.has(sub.subscriptionState) || sub.subscriptionState === "SUBSCRIPTION_STATE_EXPIRED")) {
    throw new StoreVerifyError("INVALID_PURCHASE", "Google has not confirmed this subscription as active");
  }

  const expiresAt = item.expiryTime ? new Date(item.expiryTime) : null;
  const lapsed = sub.subscriptionState === "SUBSCRIPTION_STATE_EXPIRED" || (expiresAt !== null && expiresAt <= input.now);
  return {
    provider: "GOOGLE",
    productId: input.productId,
    transactionId: sub.latestOrderId ?? input.purchaseToken,
    originalTransactionId: null,
    environment: sub.testPurchase ? "SANDBOX" : "PRODUCTION",
    status: lapsed ? "EXPIRED" : "ACTIVE",
    purchasedAt: sub.startTime ? new Date(sub.startTime) : input.now,
    expiresAt,
    accountToken: sub.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
    grant,
  };
}

/** Turns Google's one-time product answer into a purchase. Only a completed purchase (state 0) is granted. */
function oneTimePurchase(product: OneTimeProduct, input: { productId: string; purchaseToken: string; now: Date }): VerifiedStorePurchase {
  const grant = grantForProduct(input.productId);
  if (!grant) throw new StoreVerifyError("UNKNOWN_PRODUCT", "This product is not sold in the app");
  if (grant.kind !== "ADDON") throw new StoreVerifyError("INVALID_PURCHASE", "This product is not an add-on");
  if (product.purchaseState !== 0) throw new StoreVerifyError("INVALID_PURCHASE", "Google has not confirmed this purchase as complete");

  return {
    provider: "GOOGLE",
    productId: input.productId,
    transactionId: product.orderId ?? input.purchaseToken,
    originalTransactionId: null,
    environment: product.testPurchaseContext ? "SANDBOX" : "PRODUCTION",
    status: "ACTIVE",
    purchasedAt: product.purchaseTimeMillis ? new Date(Number(product.purchaseTimeMillis)) : input.now,
    expiresAt: null,
    accountToken: product.obfuscatedExternalAccountId ?? null,
    grant,
  };
}

/**
 * Asks Google Play about one purchase token. Returns the purchase, and a `finish` step that acknowledges
 * (subscriptions) or consumes (add-ons) it once the grant is saved.
 */
export async function verifyGooglePurchase(input: {
  productId: string;
  purchaseToken: string;
  config: GoogleConfig;
  fetchImpl?: FetchLike;
  now?: Date;
}): Promise<StoreVerification> {
  // Refuse a product we do not sell before spending a call on Google.
  const grant = grantForProduct(input.productId);
  if (!grant) throw new StoreVerifyError("UNKNOWN_PRODUCT", "This product is not sold in the app");

  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? new Date();
  const bearer = await accessToken(input.config, fetchImpl, now);
  const base = `${API}/${encodeURIComponent(input.config.packageName)}/purchases`;
  const token = encodeURIComponent(input.purchaseToken);
  const product = encodeURIComponent(input.productId);

  if (grant.kind === "SUBSCRIPTION") {
    const response = await storeCall(fetchImpl, `${base}/subscriptionsv2/tokens/${token}`, { headers: { Authorization: `Bearer ${bearer}` } });
    if (response.status === 404) throw new StoreVerifyError("NOT_FOUND", "Google Play has no record of this purchase");
    if (response.status === 400) throw new StoreVerifyError("INVALID_PURCHASE", "Google Play rejected this purchase token");
    const sub = (await readJson(response)) as SubscriptionV2 | null;
    if (!response.ok || !sub) throw new StoreVerifyError("STORE_UNAVAILABLE", `Google Play could not confirm the purchase (HTTP ${response.status})`);

    const purchase = subscriptionPurchase(sub, { productId: input.productId, purchaseToken: input.purchaseToken, now });
    const needsAcknowledgement = sub.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING";
    const finish = needsAcknowledgement
      ? () => finishGooglePurchase(fetchImpl, input.config, now, `${base}/subscriptions/${product}/tokens/${token}:acknowledge`)
      : undefined;
    return { purchase, finish };
  }

  const response = await storeCall(fetchImpl, `${base}/products/${product}/tokens/${token}`, { headers: { Authorization: `Bearer ${bearer}` } });
  if (response.status === 404) throw new StoreVerifyError("NOT_FOUND", "Google Play has no record of this purchase");
  if (response.status === 400) throw new StoreVerifyError("INVALID_PURCHASE", "Google Play rejected this purchase token");
  const oneTime = (await readJson(response)) as OneTimeProduct | null;
  if (!response.ok || !oneTime) throw new StoreVerifyError("STORE_UNAVAILABLE", `Google Play could not confirm the purchase (HTTP ${response.status})`);

  const purchase = oneTimePurchase(oneTime, { productId: input.productId, purchaseToken: input.purchaseToken, now });
  const finish =
    oneTime.consumptionState === "CONSUMPTION_STATE_YET_TO_BE_CONSUMED"
      ? () => finishGooglePurchase(fetchImpl, input.config, now, `${base}/products/${product}/tokens/${token}:consume`)
      : undefined;
  return { purchase, finish };
}

async function finishGooglePurchase(fetchImpl: FetchLike, config: GoogleConfig, now: Date, url: string): Promise<void> {
  const bearer = await accessToken(config, fetchImpl, now);
  const response = await storeCall(fetchImpl, url, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) throw new StoreVerifyError("STORE_UNAVAILABLE", `Google Play did not accept the delivery (HTTP ${response.status})`);
}
