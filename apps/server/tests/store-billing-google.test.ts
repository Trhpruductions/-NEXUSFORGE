import test from "node:test";
import assert from "node:assert/strict";
import { verify as verifyRsa } from "node:crypto";
import { signServiceAccountAssertion, verifyGooglePurchase, type GoogleConfig } from "../src/lib/store-billing/google.js";
import { StoreVerifyError } from "../src/lib/store-billing/types.js";
import { jsonResponse, makeRsaServiceKey } from "./helpers/store-fixtures.js";

// The Google adapter is tested against mocked Google Play responses. No network.

const NOW = new Date("2026-10-16T12:00:00Z");
const PACKAGE = "com.nfgcord.app";
const SUBSCRIPTION_PRODUCT = "nfg.coreplus.plus.monthly";
const ADDON_PRODUCT = "nfg.addon.forge_boost_pack";
const TOKEN = "purchase-token-abc";
const ANDROID = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.nfgcord.app/purchases";

const serviceKey = makeRsaServiceKey();
const config: GoogleConfig = {
  packageName: PACKAGE,
  serviceAccountEmail: "billing@test-project.iam.gserviceaccount.com",
  privateKeyPem: serviceKey.privateKeyPem,
};

type Call = { url: string; init?: RequestInit };

/** Routes the token exchange and Play API calls to canned answers, and records every call. */
function fakePlay(answers: { subscription?: unknown; product?: unknown; subscriptionStatus?: number; productStatus?: number; tokenStatus?: number }) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === "https://oauth2.googleapis.com/token") {
      return answers.tokenStatus && answers.tokenStatus !== 200
        ? jsonResponse({ error: "invalid_grant" }, answers.tokenStatus)
        : jsonResponse({ access_token: "test-access-token", expires_in: 3600 });
    }
    if (url.includes("/subscriptionsv2/") || url.includes("/subscriptions/")) {
      return jsonResponse(answers.subscription ?? {}, answers.subscriptionStatus ?? 200);
    }
    return jsonResponse(answers.product ?? {}, answers.productStatus ?? 200);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function refusedWith(promise: Promise<unknown>, code: string) {
  return assert.rejects(promise, (error: unknown) => error instanceof StoreVerifyError && error.code === code);
}

function activeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    startTime: "2026-10-01T00:00:00Z",
    latestOrderId: "GPA.1111-2222-3333-44444",
    lineItems: [{ productId: SUBSCRIPTION_PRODUCT, expiryTime: "2026-11-01T00:00:00Z" }],
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    externalAccountIdentifiers: { obfuscatedExternalAccountId: "user-1" },
    ...overrides,
  };
}

test("the service-account assertion is an RS256 JWT for the Android publisher scope, signed by the service key", () => {
  const assertion = signServiceAccountAssertion(config, Math.floor(NOW.getTime() / 1000));
  const [header, body, signature] = assertion.split(".");
  assert.equal(JSON.parse(Buffer.from(header, "base64url").toString("utf8")).alg, "RS256");
  const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  assert.equal(claims.iss, config.serviceAccountEmail);
  assert.equal(claims.scope, "https://www.googleapis.com/auth/androidpublisher");
  assert.equal(claims.aud, "https://oauth2.googleapis.com/token");
  assert.ok(verifyRsa("RSA-SHA256", Buffer.from(`${header}.${body}`), serviceKey.publicKeyPem, Buffer.from(signature, "base64url")));
});

test("an active Google subscription is accepted, with its order id and the user's account", async () => {
  const { fetchImpl, calls } = fakePlay({ subscription: activeSubscription() });
  const { purchase, finish } = await verifyGooglePurchase({ productId: SUBSCRIPTION_PRODUCT, purchaseToken: TOKEN, config, fetchImpl, now: NOW });

  assert.equal(purchase.provider, "GOOGLE");
  assert.equal(purchase.status, "ACTIVE");
  assert.equal(purchase.transactionId, "GPA.1111-2222-3333-44444");
  assert.equal(purchase.accountToken, "user-1");
  assert.equal(purchase.environment, "PRODUCTION");
  assert.deepEqual(purchase.grant, { kind: "SUBSCRIPTION", tier: "PLUS" });
  assert.equal(finish, undefined, "an already acknowledged subscription needs no further call");

  const playCall = calls.find((call) => call.url.includes("subscriptionsv2"));
  assert.ok(playCall, "the subscription must be checked with Google Play");
  assert.equal(playCall.url, `${ANDROID}/subscriptionsv2/tokens/${TOKEN}`);
  assert.equal((playCall.init?.headers as Record<string, string>).Authorization, "Bearer test-access-token");
});

test("a subscription Google has not acknowledged is finished by acknowledging it, after the grant", async () => {
  const { fetchImpl, calls } = fakePlay({
    subscription: activeSubscription({ acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING" }),
  });
  const { finish } = await verifyGooglePurchase({ productId: SUBSCRIPTION_PRODUCT, purchaseToken: TOKEN, config, fetchImpl, now: NOW });
  assert.equal(typeof finish, "function");

  await finish?.();
  const acknowledge = calls[calls.length - 1];
  assert.equal(acknowledge.url, `${ANDROID}/subscriptions/${SUBSCRIPTION_PRODUCT}/tokens/${TOKEN}:acknowledge`);
  assert.equal(acknowledge.init?.method, "POST");
});

test("a subscription that is on hold, paused or pending is not granted", async () => {
  for (const state of ["SUBSCRIPTION_STATE_ON_HOLD", "SUBSCRIPTION_STATE_PAUSED", "SUBSCRIPTION_STATE_PENDING"]) {
    const { fetchImpl } = fakePlay({ subscription: activeSubscription({ subscriptionState: state }) });
    await refusedWith(verifyGooglePurchase({ productId: SUBSCRIPTION_PRODUCT, purchaseToken: TOKEN, config, fetchImpl, now: NOW }), "INVALID_PURCHASE");
  }
});

test("a cancelled subscription keeps its access until the expiry date, then reads as expired", async () => {
  const stillPaid = fakePlay({ subscription: activeSubscription({ subscriptionState: "SUBSCRIPTION_STATE_CANCELED" }) });
  const paid = await verifyGooglePurchase({ productId: SUBSCRIPTION_PRODUCT, purchaseToken: TOKEN, config, fetchImpl: stillPaid.fetchImpl, now: NOW });
  assert.equal(paid.purchase.status, "ACTIVE");

  const lapsed = fakePlay({ subscription: activeSubscription({ subscriptionState: "SUBSCRIPTION_STATE_CANCELED", lineItems: [{ productId: SUBSCRIPTION_PRODUCT, expiryTime: "2026-10-10T00:00:00Z" }] }) });
  const ended = await verifyGooglePurchase({ productId: SUBSCRIPTION_PRODUCT, purchaseToken: TOKEN, config, fetchImpl: lapsed.fetchImpl, now: NOW });
  assert.equal(ended.purchase.status, "EXPIRED");
});

test("a test purchase from Google is recorded as a sandbox purchase", async () => {
  const { fetchImpl } = fakePlay({ subscription: activeSubscription({ testPurchase: {} }) });
  const { purchase } = await verifyGooglePurchase({ productId: SUBSCRIPTION_PRODUCT, purchaseToken: TOKEN, config, fetchImpl, now: NOW });
  assert.equal(purchase.environment, "SANDBOX");
});

test("a Google answer that names a different product than the one requested is refused", async () => {
  const { fetchImpl } = fakePlay({ subscription: activeSubscription({ lineItems: [{ productId: "nfg.coreplus.elite.monthly" }] }) });
  await refusedWith(verifyGooglePurchase({ productId: SUBSCRIPTION_PRODUCT, purchaseToken: TOKEN, config, fetchImpl, now: NOW }), "INVALID_PURCHASE");
});

test("an add-on bought once is granted once: a completed one-time purchase is accepted and consumed afterwards", async () => {
  const { fetchImpl, calls } = fakePlay({
    product: { purchaseState: 0, purchaseTimeMillis: String(NOW.getTime() - 60_000), orderId: "GPA.9999-0001", obfuscatedExternalAccountId: "user-1", consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED" },
  });
  const { purchase, finish } = await verifyGooglePurchase({ productId: ADDON_PRODUCT, purchaseToken: TOKEN, config, fetchImpl, now: NOW });

  assert.deepEqual(purchase.grant, { kind: "ADDON", featureCode: "FORGE_BOOST_PACK" });
  assert.equal(purchase.transactionId, "GPA.9999-0001");
  assert.equal(purchase.status, "ACTIVE");

  await finish?.();
  assert.equal(calls[calls.length - 1].url, `${ANDROID}/products/${ADDON_PRODUCT}/tokens/${TOKEN}:consume`);
});

test("an add-on purchase that is cancelled or pending is not granted", async () => {
  for (const purchaseState of [1, 2]) {
    const { fetchImpl } = fakePlay({ product: { purchaseState, orderId: "GPA.9999-0002" } });
    await refusedWith(verifyGooglePurchase({ productId: ADDON_PRODUCT, purchaseToken: TOKEN, config, fetchImpl, now: NOW }), "INVALID_PURCHASE");
  }
});

test("an unknown product is refused before any call to Google Play", async () => {
  const { fetchImpl, calls } = fakePlay({});
  await refusedWith(verifyGooglePurchase({ productId: "com.free.stuff", purchaseToken: TOKEN, config, fetchImpl, now: NOW }), "UNKNOWN_PRODUCT");
  assert.equal(calls.length, 0);
});

test("a purchase token Google does not know is reported as not found", async () => {
  const { fetchImpl } = fakePlay({ subscriptionStatus: 404 });
  await refusedWith(verifyGooglePurchase({ productId: SUBSCRIPTION_PRODUCT, purchaseToken: TOKEN, config, fetchImpl, now: NOW }), "NOT_FOUND");
});

test("a purchase token Google rejects as malformed is refused as an invalid purchase", async () => {
  const { fetchImpl } = fakePlay({ subscriptionStatus: 400 });
  await refusedWith(verifyGooglePurchase({ productId: SUBSCRIPTION_PRODUCT, purchaseToken: TOKEN, config, fetchImpl, now: NOW }), "INVALID_PURCHASE");
});

test("a failure to sign in to Google is reported as the store being unavailable", async () => {
  const { fetchImpl } = fakePlay({ tokenStatus: 401 });
  await refusedWith(verifyGooglePurchase({ productId: SUBSCRIPTION_PRODUCT, purchaseToken: TOKEN, config, fetchImpl, now: NOW }), "STORE_UNAVAILABLE");
});

test("a Google outage on the purchase check is reported as the store being unavailable", async () => {
  const { fetchImpl } = fakePlay({ subscriptionStatus: 503, subscription: {} });
  await refusedWith(verifyGooglePurchase({ productId: SUBSCRIPTION_PRODUCT, purchaseToken: TOKEN, config, fetchImpl, now: NOW }), "STORE_UNAVAILABLE");
});
