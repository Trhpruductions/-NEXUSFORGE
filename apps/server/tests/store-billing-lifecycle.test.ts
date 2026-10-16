import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import type { AppleConfig } from "../src/lib/store-billing/apple.js";
import { handleAppleNotification } from "../src/lib/store-billing/apple-notifications.js";
import { applyStorePurchase } from "../src/lib/store-billing/grant.js";
import { handleGoogleNotification } from "../src/lib/store-billing/google-notifications.js";
import type { GoogleConfig } from "../src/lib/store-billing/google.js";
import { syncStorePremium } from "../src/lib/store-billing/lifecycle.js";
import { runStoreBillingSweep } from "../src/lib/store-billing/sweep.js";
import { StoreVerifyError, type VerifiedStorePurchase } from "../src/lib/store-billing/types.js";
import { jsonResponse, makeAppleTestChain, makeEcApiKey, makeRsaServiceKey, signAppleTransaction } from "./helpers/store-fixtures.js";
import { assertNotLiveDatabase } from "./helpers/live-database-guard.js";

// Writes test rows, so it must never run against the live database.
assertNotLiveDatabase();

// Test-only keys and chains. Store responses are mocked; nothing goes to Apple or Google.
const RUN = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const BUNDLE = "com.nfgcord.app";
const PLUS = "nfg.coreplus.plus.monthly";
const ELITE = "nfg.coreplus.elite.monthly";
const ADDON = "nfg.addon.forge_boost_pack";
const DAY = 86_400_000;

const chain = makeAppleTestChain(`Lifecycle ${RUN.slice(0, 6)}`);
const otherChain = makeAppleTestChain(`Other ${RUN.slice(0, 6)}`);
const apiKey = makeEcApiKey();
const apple: AppleConfig = { issuerId: "test-issuer", keyId: "TESTKEY", privateKeyPem: apiKey.privateKeyPem, bundleId: BUNDLE, rootCertPem: chain.rootPem };

const serviceKey = makeRsaServiceKey();
const google: GoogleConfig = { packageName: BUNDLE, serviceAccountEmail: "billing@test.iam.gserviceaccount.com", privateKeyPem: serviceKey.privateKeyPem };

const createdUserIds: string[] = [];
let seq = 0;
const tid = (label: string) => `${label}-${RUN}-${++seq}`;

async function makeUser(label: string, extra: { lifetimeMember?: boolean; premiumTier?: "NONE" | "CORE" | "PLUS" | "ELITE" | "INFINITE"; premium?: boolean } = {}) {
  const id = randomUUID();
  createdUserIds.push(id);
  await prisma.user.create({
    data: {
      id,
      username: `lc_${label}_${RUN}`.slice(0, 32),
      email: `lc_${label}_${RUN}@example.com`,
      password: "not-a-login-in-this-test",
      birthdate: new Date("1990-01-01"),
      lifetimeMember: extra.lifetimeMember ?? false,
      premiumTier: extra.premiumTier ?? "NONE",
      premium: extra.premium ?? false,
    },
  });
  return id;
}

async function premiumOf(userId: string) {
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { premium: true, premiumTier: true } });
}

function appleTransaction(userId: string, overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    transactionId: tid("A"),
    originalTransactionId: `orig-${RUN}`,
    bundleId: BUNDLE,
    productId: PLUS,
    environment: "Sandbox",
    type: "Auto-Renewable Subscription",
    purchaseDate: now - 60_000,
    expiresDate: now + 30 * DAY,
    appAccountToken: userId,
    ...overrides,
  };
}

function appleNotification(type: string, transactionJws: string | null, chainToUse = chain) {
  return signAppleTransaction(chainToUse, {
    notificationType: type,
    notificationUUID: randomUUID(),
    data: { bundleId: BUNDLE, environment: "Sandbox", ...(transactionJws ? { signedTransactionInfo: transactionJws } : {}) },
  });
}

function signedTx(payload: Record<string, unknown>, chainToUse = chain) {
  return signAppleTransaction(chainToUse, payload);
}

async function rowStatus(provider: "APPLE" | "GOOGLE", transactionId: string) {
  const row = await prisma.storePurchase.findUnique({ where: { provider_transactionId: { provider, transactionId } }, select: { status: true } });
  return row?.status ?? null;
}

/** A purchase the server has already granted, recorded through the normal grant path. */
async function grantDirectly(userId: string, purchase: Partial<VerifiedStorePurchase> & { provider: "APPLE" | "GOOGLE"; transactionId: string; grant: VerifiedStorePurchase["grant"] }) {
  const full: VerifiedStorePurchase = {
    productId: PLUS,
    originalTransactionId: null,
    environment: "SANDBOX",
    status: "ACTIVE",
    purchasedAt: new Date(Date.now() - 60_000),
    expiresAt: new Date(Date.now() + 30 * DAY),
    accountToken: userId,
    ...purchase,
  };
  return applyStorePurchase({ userId, purchase: full, receipt: full.transactionId });
}

function googleEnvelope(data: Record<string, unknown>) {
  return { message: { data: Buffer.from(JSON.stringify({ packageName: BUNDLE, eventTimeMillis: "1", ...data })).toString("base64"), messageId: "1" }, subscription: "projects/t/subscriptions/s" };
}

/** Google's answer for a subscription, mutable so each test sets the state it needs. */
const googleState: { subscription: Record<string, unknown>; status: number } = { subscription: {}, status: 200 };
const googleFetch = (async (input: string | URL | Request) => {
  const url = String(input);
  if (url === "https://oauth2.googleapis.com/token") return jsonResponse({ access_token: "test-access-token" });
  if (url.includes("/subscriptionsv2/tokens/")) return jsonResponse(googleState.subscription, googleState.status);
  return jsonResponse({});
}) as typeof fetch;

function googleSubscription(userId: string, orderId: string, state = "SUBSCRIPTION_STATE_ACTIVE", expiresAt = Date.now() + 30 * DAY) {
  return {
    subscriptionState: state,
    startTime: new Date(Date.now() - 60_000).toISOString(),
    latestOrderId: orderId,
    lineItems: [{ productId: PLUS, expiryTime: new Date(expiresAt).toISOString() }],
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    externalAccountIdentifiers: { obfuscatedExternalAccountId: userId },
  };
}

/** Apple's status endpoint answer for one subscription, by its original transaction id. */
function appleStatusFetch(answers: Record<string, { status: number; renewalJws?: string }>) {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    const match = /\/inApps\/v1\/subscriptions\/([^/?]+)/.exec(url);
    const answer = match ? answers[decodeURIComponent(match[1])] : undefined;
    if (!answer) return jsonResponse({ errorCode: 4040001 }, 404);
    const lastTransactions = answer.status === 1 || answer.status === 4
      ? [{ status: answer.status, signedTransactionInfo: answer.renewalJws }]
      : [{ status: answer.status }];
    return jsonResponse({ data: [{ lastTransactions }] });
  }) as typeof fetch;
}

async function refusedWith(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => error instanceof StoreVerifyError && error.code === code);
}

after(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

// --- Apple notifications ---

test("an Apple subscription notification grants the Core+ tier it buys", async () => {
  const userId = await makeUser("apple-sub");
  const tx = signedTx(appleTransaction(userId, { productId: PLUS, transactionId: tid("S") }));
  const result = await handleAppleNotification({ signedPayload: appleNotification("SUBSCRIBED", tx), config: apple, now: new Date() });
  assert.equal(result.outcome, "granted");
  assert.deepEqual(await premiumOf(userId), { premium: true, premiumTier: "PLUS" });
});

test("a renewal that Apple announces is granted without the app doing anything", async () => {
  const userId = await makeUser("apple-renew");
  const first = appleTransaction(userId, { productId: PLUS, transactionId: tid("R1") });
  await handleAppleNotification({ signedPayload: appleNotification("SUBSCRIBED", signedTx(first)), config: apple, now: new Date() });

  const renewal = appleTransaction(userId, { productId: ELITE, transactionId: tid("R2"), originalTransactionId: first.originalTransactionId });
  const result = await handleAppleNotification({ signedPayload: appleNotification("DID_RENEW", signedTx(renewal)), config: apple, now: new Date() });
  assert.equal(result.outcome, "granted");
  assert.deepEqual(await premiumOf(userId), { premium: true, premiumTier: "ELITE" });
});

test("when the newer period ends, premium follows the period that is still paid", async () => {
  const userId = await makeUser("apple-fallback");
  const first = appleTransaction(userId, { productId: PLUS, transactionId: tid("F1") });
  const renewal = appleTransaction(userId, { productId: ELITE, transactionId: tid("F2") });
  await handleAppleNotification({ signedPayload: appleNotification("SUBSCRIBED", signedTx(first)), config: apple, now: new Date() });
  await handleAppleNotification({ signedPayload: appleNotification("DID_RENEW", signedTx(renewal)), config: apple, now: new Date() });

  const result = await handleAppleNotification({ signedPayload: appleNotification("EXPIRED", signedTx(renewal)), config: apple, now: new Date() });
  assert.equal(result.outcome, "status-updated");
  assert.equal(await rowStatus("APPLE", renewal.transactionId), "EXPIRED");
  assert.deepEqual(await premiumOf(userId), { premium: true, premiumTier: "PLUS" });
});

test("a refund removes premium, and a reversed refund brings it back", async () => {
  const userId = await makeUser("apple-refund");
  const tx = appleTransaction(userId, { productId: PLUS, transactionId: tid("RF") });
  await handleAppleNotification({ signedPayload: appleNotification("SUBSCRIBED", signedTx(tx)), config: apple, now: new Date() });

  const refunded = await handleAppleNotification({ signedPayload: appleNotification("REFUND", signedTx(tx)), config: apple, now: new Date() });
  assert.equal(refunded.outcome, "status-updated");
  assert.equal(await rowStatus("APPLE", tx.transactionId), "REVOKED");
  assert.deepEqual(await premiumOf(userId), { premium: false, premiumTier: "NONE" });

  const reversed = await handleAppleNotification({ signedPayload: appleNotification("REFUND_REVERSED", signedTx(tx)), config: apple, now: new Date() });
  assert.equal(reversed.outcome, "granted");
  assert.equal(await rowStatus("APPLE", tx.transactionId), "ACTIVE");
  assert.deepEqual(await premiumOf(userId), { premium: true, premiumTier: "PLUS" });
});

test("a refunded add-on gives its unit back, and a reversed refund restores it", async () => {
  const userId = await makeUser("apple-addon");
  const tx = appleTransaction(userId, { productId: ADDON, transactionId: tid("AD"), type: "Consumable" });
  assert.equal(await grantDirectly(userId, { provider: "APPLE", transactionId: tx.transactionId, productId: ADDON, grant: { kind: "ADDON", featureCode: "FORGE_BOOST_PACK" } }), "applied");
  const quantity = async () => (await prisma.featureEntitlement.findUnique({ where: { userId_featureCode: { userId, featureCode: "FORGE_BOOST_PACK" } }, select: { quantity: true } }))?.quantity;
  assert.equal(await quantity(), 1);

  await handleAppleNotification({ signedPayload: appleNotification("REFUND", signedTx(tx)), config: apple, now: new Date() });
  assert.equal(await quantity(), 0);

  await handleAppleNotification({ signedPayload: appleNotification("REFUND_REVERSED", signedTx(tx)), config: apple, now: new Date() });
  assert.equal(await quantity(), 1);
});

test("a refund for a lifetime member leaves their granted tier alone", async () => {
  const userId = await makeUser("apple-lifetime", { lifetimeMember: true, premiumTier: "INFINITE", premium: true });
  const tx = appleTransaction(userId, { productId: PLUS, transactionId: tid("LT") });
  await handleAppleNotification({ signedPayload: appleNotification("SUBSCRIBED", signedTx(tx)), config: apple, now: new Date() });
  await handleAppleNotification({ signedPayload: appleNotification("REFUND", signedTx(tx)), config: apple, now: new Date() });
  assert.deepEqual(await premiumOf(userId), { premium: true, premiumTier: "INFINITE" });
});

test("while a Stripe subscription is still active, a store refund does not change its tier", async () => {
  const userId = await makeUser("apple-stripe", { premium: true, premiumTier: "ELITE" });
  await prisma.billingSubscription.create({
    data: {
      userId,
      providerCustomerId: `cus_${RUN}`,
      providerSubscriptionId: `sub_${RUN}_${++seq}`,
      tier: "ELITE",
      interval: "MONTHLY",
      status: "ACTIVE",
    },
  });
  const tx = appleTransaction(userId, { productId: PLUS, transactionId: tid("ST") });
  await handleAppleNotification({ signedPayload: appleNotification("SUBSCRIBED", signedTx(tx)), config: apple, now: new Date() });
  await handleAppleNotification({ signedPayload: appleNotification("REFUND", signedTx(tx)), config: apple, now: new Date() });
  assert.deepEqual(await premiumOf(userId), { premium: true, premiumTier: "ELITE" });
});

test("once a Stripe subscription ends, a live store subscription's tier applies", async () => {
  const userId = await makeUser("apple-stripe-end", { premium: true, premiumTier: "ELITE" });
  await prisma.billingSubscription.create({
    data: { userId, providerCustomerId: `cus_end_${RUN}`, providerSubscriptionId: `sub_end_${RUN}_${++seq}`, tier: "ELITE", interval: "MONTHLY", status: "CANCELED" },
  });
  await grantDirectly(userId, { provider: "APPLE", transactionId: tid("SE"), grant: { kind: "SUBSCRIPTION", tier: "PLUS" } });
  await syncStorePremium(prisma, userId);
  assert.deepEqual(await premiumOf(userId), { premium: true, premiumTier: "PLUS" });
});

test("a notification for a product we do not sell is ignored and recorded nowhere", async () => {
  const userId = await makeUser("apple-unknown");
  const tx = appleTransaction(userId, { productId: "com.free.stuff", transactionId: tid("UK") });
  const result = await handleAppleNotification({ signedPayload: appleNotification("SUBSCRIBED", signedTx(tx)), config: apple, now: new Date() });
  assert.equal(result.outcome, "ignored");
  assert.equal(await rowStatus("APPLE", tx.transactionId), null);
});

test("a notification for an account that does not exist here is ignored", async () => {
  const tx = appleTransaction(randomUUID(), { transactionId: tid("NU") });
  const result = await handleAppleNotification({ signedPayload: appleNotification("SUBSCRIBED", signedTx(tx)), config: apple, now: new Date() });
  assert.equal(result.outcome, "ignored");
});

test("a notification signed under a chain that is not Apple's is refused", async () => {
  const userId = await makeUser("apple-forged");
  const tx = appleTransaction(userId, { transactionId: tid("FG") });
  await refusedWith(
    handleAppleNotification({ signedPayload: appleNotification("SUBSCRIBED", signedTx(tx, otherChain), otherChain), config: apple, now: new Date() }),
    "INVALID_PURCHASE",
  );
});

test("a notification for another app is refused", async () => {
  const userId = await makeUser("apple-app");
  const tx = appleTransaction(userId, { bundleId: "com.someone.else", transactionId: tid("AP") });
  await refusedWith(
    handleAppleNotification({ signedPayload: appleNotification("SUBSCRIBED", signedTx(tx)), config: apple, now: new Date() }),
    "INVALID_PURCHASE",
  );
});

test("a notification with no transaction in it is acknowledged and ignored", async () => {
  const result = await handleAppleNotification({ signedPayload: appleNotification("PRICE_INCREASE", null), config: apple, now: new Date() });
  assert.equal(result.outcome, "ignored");
  assert.equal(result.type, "PRICE_INCREASE");
});

// --- Google notifications ---

test("a Google renewal notification grants the new period after Google confirms it", async () => {
  const userId = await makeUser("google-renew");
  const order = tid("GPA.R1");
  googleState.status = 200;
  googleState.subscription = googleSubscription(userId, order);
  const result = await handleGoogleNotification({
    envelope: googleEnvelope({ subscriptionNotification: { notificationType: 2, purchaseToken: `tok-${order}`, subscriptionId: PLUS } }),
    config: google,
    now: new Date(),
    fetchImpl: googleFetch,
  });
  assert.equal(result.outcome, "granted");
  assert.equal(await rowStatus("GOOGLE", order), "ACTIVE");
  assert.deepEqual(await premiumOf(userId), { premium: true, premiumTier: "PLUS" });
});

test("a Google expiry notification ends the subscription and removes its premium", async () => {
  const userId = await makeUser("google-expire");
  const order = tid("GPA.E1");
  googleState.status = 200;
  googleState.subscription = googleSubscription(userId, order);
  await handleGoogleNotification({ envelope: googleEnvelope({ subscriptionNotification: { notificationType: 2, purchaseToken: `tok-${order}`, subscriptionId: PLUS } }), config: google, now: new Date(), fetchImpl: googleFetch });

  googleState.subscription = googleSubscription(userId, order, "SUBSCRIPTION_STATE_EXPIRED", Date.now() - DAY);
  const result = await handleGoogleNotification({ envelope: googleEnvelope({ subscriptionNotification: { notificationType: 13, purchaseToken: `tok-${order}`, subscriptionId: PLUS } }), config: google, now: new Date(), fetchImpl: googleFetch });
  assert.equal(result.outcome, "status-updated");
  assert.equal(await rowStatus("GOOGLE", order), "EXPIRED");
  assert.deepEqual(await premiumOf(userId), { premium: false, premiumTier: "NONE" });
});

test("a voided Google purchase revokes that order and removes its premium", async () => {
  const userId = await makeUser("google-void");
  const order = tid("GPA.V1");
  googleState.status = 200;
  googleState.subscription = googleSubscription(userId, order);
  await handleGoogleNotification({ envelope: googleEnvelope({ subscriptionNotification: { notificationType: 2, purchaseToken: `tok-${order}`, subscriptionId: PLUS } }), config: google, now: new Date(), fetchImpl: googleFetch });

  const result = await handleGoogleNotification({
    envelope: googleEnvelope({ voidedPurchaseNotification: { orderId: order, purchaseToken: `tok-${order}`, productType: 1 } }),
    config: google,
    now: new Date(),
    fetchImpl: googleFetch,
  });
  assert.equal(result.outcome, "status-updated");
  assert.equal(await rowStatus("GOOGLE", order), "REVOKED");
  assert.deepEqual(await premiumOf(userId), { premium: false, premiumTier: "NONE" });
});

test("a Google test notification is acknowledged without changing anything", async () => {
  const result = await handleGoogleNotification({ envelope: googleEnvelope({ testNotification: { version: "1.0" } }), config: google, now: new Date(), fetchImpl: googleFetch });
  assert.equal(result.outcome, "test");
});

test("a notification for another package is ignored", async () => {
  const result = await handleGoogleNotification({
    envelope: { message: { data: Buffer.from(JSON.stringify({ packageName: "com.other", subscriptionNotification: { purchaseToken: "x", subscriptionId: PLUS } })).toString("base64") } },
    config: google,
    now: new Date(),
    fetchImpl: googleFetch,
  });
  assert.equal(result.outcome, "ignored");
});

test("a Google subscription on hold is not granted", async () => {
  const userId = await makeUser("google-hold");
  const order = tid("GPA.H1");
  googleState.status = 200;
  googleState.subscription = googleSubscription(userId, order, "SUBSCRIPTION_STATE_ON_HOLD");
  const result = await handleGoogleNotification({ envelope: googleEnvelope({ subscriptionNotification: { notificationType: 5, purchaseToken: `tok-${order}`, subscriptionId: PLUS } }), config: google, now: new Date(), fetchImpl: googleFetch });
  assert.equal(result.outcome, "ignored");
  assert.equal(await rowStatus("GOOGLE", order), null);
});

test("a malformed Google notification is refused", async () => {
  await refusedWith(handleGoogleNotification({ envelope: { message: {} }, config: google, now: new Date(), fetchImpl: googleFetch }), "INVALID_PURCHASE");
});

test("a Google outage is passed back so Google resends the notification", async () => {
  googleState.status = 503;
  googleState.subscription = {};
  await refusedWith(
    handleGoogleNotification({
      envelope: googleEnvelope({ subscriptionNotification: { notificationType: 2, purchaseToken: "tok-outage", subscriptionId: PLUS } }),
      config: google,
      now: new Date(),
      fetchImpl: googleFetch,
    }),
    "STORE_UNAVAILABLE",
  );
  googleState.status = 200;
});

// --- Sweep ---

async function insertLapsedRow(input: { userId: string; provider: "APPLE" | "GOOGLE"; transactionId: string; originalTransactionId?: string; expiresAt: Date }) {
  await prisma.storePurchase.create({
    data: {
      userId: input.userId,
      provider: input.provider,
      productId: PLUS,
      transactionId: input.transactionId,
      originalTransactionId: input.originalTransactionId ?? null,
      tier: "PLUS",
      status: "ACTIVE",
      environment: "SANDBOX",
      purchasedAt: new Date(input.expiresAt.getTime() - 30 * DAY),
      expiresAt: input.expiresAt,
      receiptHash: "0".repeat(64),
    },
  });
}

test("the sweep expires a lapsed Google subscription, but leaves one still inside its one-day grace", async () => {
  const lapsedUser = await makeUser("sweep-lapsed", { premium: true, premiumTier: "PLUS" });
  const graceUser = await makeUser("sweep-grace", { premium: true, premiumTier: "PLUS" });
  const lapsed = tid("SW-L");
  const grace = tid("SW-G");
  await insertLapsedRow({ userId: lapsedUser, provider: "GOOGLE", transactionId: lapsed, expiresAt: new Date(Date.now() - 3 * DAY) });
  await insertLapsedRow({ userId: graceUser, provider: "GOOGLE", transactionId: grace, expiresAt: new Date(Date.now() - 6 * 60 * 60 * 1000) });

  await runStoreBillingSweep({ now: new Date(), appleConfig: null });

  assert.equal(await rowStatus("GOOGLE", lapsed), "EXPIRED");
  assert.equal(await rowStatus("GOOGLE", grace), "ACTIVE");
  assert.deepEqual(await premiumOf(lapsedUser), { premium: false, premiumTier: "NONE" });
  assert.deepEqual(await premiumOf(graceUser), { premium: true, premiumTier: "PLUS" });
});

test("the sweep keeps a lapsed Apple subscription paid when Apple reports a newer active period", async () => {
  const userId = await makeUser("sweep-apple-renew", { premium: true, premiumTier: "PLUS" });
  const original = `orig-renew-${RUN}`;
  const oldTx = tid("SW-OLD");
  const newTx = tid("SW-NEW");
  await insertLapsedRow({ userId, provider: "APPLE", transactionId: oldTx, originalTransactionId: original, expiresAt: new Date(Date.now() - 3 * DAY) });

  const renewalJws = signedTx(appleTransaction(userId, { productId: ELITE, transactionId: newTx, originalTransactionId: original }));
  await runStoreBillingSweep({
    now: new Date(),
    appleConfig: apple,
    fetchImpl: appleStatusFetch({ [original]: { status: 1, renewalJws } }),
  });

  assert.equal(await rowStatus("APPLE", newTx), "ACTIVE");
  assert.equal(await rowStatus("APPLE", oldTx), "EXPIRED");
  assert.deepEqual(await premiumOf(userId), { premium: true, premiumTier: "ELITE" });
});

test("the sweep expires an Apple subscription that Apple reports as expired, and removes its premium", async () => {
  const userId = await makeUser("sweep-apple-expired", { premium: true, premiumTier: "PLUS" });
  const original = `orig-gone-${RUN}`;
  const oldTx = tid("SW-GONE");
  await insertLapsedRow({ userId, provider: "APPLE", transactionId: oldTx, originalTransactionId: original, expiresAt: new Date(Date.now() - 3 * DAY) });

  await runStoreBillingSweep({ now: new Date(), appleConfig: apple, fetchImpl: appleStatusFetch({ [original]: { status: 2 } }) });

  assert.equal(await rowStatus("APPLE", oldTx), "EXPIRED");
  assert.deepEqual(await premiumOf(userId), { premium: false, premiumTier: "NONE" });
});
