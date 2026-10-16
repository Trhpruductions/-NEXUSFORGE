import test from "node:test";
import assert from "node:assert/strict";
import { purchaseFromApplePayload, verifySignedTransaction } from "../src/lib/store-billing/apple.js";
import { decodeDeveloperNotification } from "../src/lib/store-billing/google-notifications.js";
import { StoreVerifyError } from "../src/lib/store-billing/types.js";
import { makeAppleTestChain, signAppleTransaction } from "./helpers/store-fixtures.js";

// Malformed or mismatched input is refused with a clear error, never a server crash.

const BUNDLE = "com.nfgcord.app";
const chain = makeAppleTestChain("Hardening Apple");
// The test certificates are valid from the moment they are generated, so "now" is taken after them.
const NOW = new Date(Date.now() + 1000);

function refusedWith(run: () => unknown, code: string, pattern?: RegExp) {
  assert.throws(run, (error: unknown) => {
    if (!(error instanceof StoreVerifyError) || error.code !== code) return false;
    return pattern ? pattern.test(error.message) : true;
  });
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    transactionId: "H-1",
    originalTransactionId: "H-1",
    bundleId: BUNDLE,
    productId: "nfg.coreplus.plus.monthly",
    environment: "Sandbox",
    type: "Auto-Renewable Subscription",
    purchaseDate: NOW.getTime() - 60_000,
    expiresDate: NOW.getTime() + 30 * 86_400_000,
    ...overrides,
  };
}

const expected = { transactionId: "H-1", bundleId: BUNDLE, now: NOW };

test("a string that is not a signed transaction is refused as an invalid purchase", () => {
  refusedWith(() => verifySignedTransaction("not-a-jws", chain.rootPem, NOW), "INVALID_PURCHASE");
  refusedWith(() => verifySignedTransaction("", chain.rootPem, NOW), "INVALID_PURCHASE");
});

test("a signed transaction whose header is not valid JSON is refused, not a crash", () => {
  const body = Buffer.from(JSON.stringify(payload())).toString("base64url");
  refusedWith(() => verifySignedTransaction(`${Buffer.from("{not json").toString("base64url")}.${body}.c2ln`, chain.rootPem, NOW), "INVALID_PURCHASE");
});

test("a signed transaction whose certificate chain is not a list of certificates is refused", () => {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", x5c: ["not-base64-der", 7] })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload())).toString("base64url");
  refusedWith(() => verifySignedTransaction(`${header}.${body}.c2ln`, chain.rootPem, NOW), "INVALID_PURCHASE");
});

test("a valid signed transaction still decodes after the hardening", () => {
  const jws = signAppleTransaction(chain, payload());
  assert.equal(verifySignedTransaction(jws, chain.rootPem, NOW).transactionId, "H-1");
});

test("a Core+ product sold as a consumable is refused: the store type must match what we grant", () => {
  refusedWith(() => purchaseFromApplePayload(payload({ type: "Consumable" }), expected), "INVALID_PURCHASE", /not a subscription/);
});

test("an add-on sold as an auto-renewing subscription is refused", () => {
  refusedWith(
    () => purchaseFromApplePayload(payload({ productId: "nfg.addon.forge_boost_pack", type: "Auto-Renewable Subscription" }), expected),
    "INVALID_PURCHASE",
    /not an add-on/,
  );
});

test("an add-on sold as a consumable is accepted", () => {
  const purchase = purchaseFromApplePayload(payload({ productId: "nfg.addon.forge_boost_pack", type: "Consumable" }), expected);
  assert.deepEqual(purchase.grant, { kind: "ADDON", featureCode: "FORGE_BOOST_PACK" });
});

test("a Google notification whose data is not base64 JSON is refused", () => {
  assert.throws(() => decodeDeveloperNotification({ message: { data: Buffer.from("{oops").toString("base64") } }), (error: unknown) => error instanceof StoreVerifyError && error.code === "INVALID_PURCHASE");
  assert.throws(() => decodeDeveloperNotification({ message: { data: 12 } }), (error: unknown) => error instanceof StoreVerifyError && error.code === "INVALID_PURCHASE");
  assert.throws(() => decodeDeveloperNotification(null), (error: unknown) => error instanceof StoreVerifyError && error.code === "INVALID_PURCHASE");
});

test("a well-formed Google notification decodes to its contents", () => {
  const data = Buffer.from(JSON.stringify({ packageName: BUNDLE, testNotification: { version: "1.0" } })).toString("base64");
  assert.deepEqual(decodeDeveloperNotification({ message: { data } }), { packageName: BUNDLE, testNotification: { version: "1.0" } });
});
