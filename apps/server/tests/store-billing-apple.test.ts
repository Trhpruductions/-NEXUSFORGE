import test from "node:test";
import assert from "node:assert/strict";
import { verify as verifyJwtSignature } from "node:crypto";
import {
  purchaseFromApplePayload,
  signAppleBearer,
  verifyAppleTransaction,
  verifySignedTransaction,
  type AppleConfig,
} from "../src/lib/store-billing/apple.js";
import { StoreVerifyError } from "../src/lib/store-billing/types.js";
import { jsonResponse, makeAppleTestChain, makeEcApiKey, signAppleTransaction } from "./helpers/store-fixtures.js";

// The Apple adapter is tested against a real (test-only) certificate chain and mocked App Store responses. No network.

const BUNDLE = "com.nfgcord.app";
const PRODUCTION_HOST = "https://api.storekit.itunes.apple.com";
const SANDBOX_HOST = "https://api.storekit-sandbox.itunes.apple.com";

const chain = makeAppleTestChain("Test Apple");
const otherChain = makeAppleTestChain("Other Apple");
const apiKey = makeEcApiKey();
// The test certificates are valid from the moment they are generated, so "now" is taken after they exist.
const NOW = new Date(Date.now() + 1000);

const config: AppleConfig = {
  issuerId: "test-issuer",
  keyId: "TESTKEY123",
  privateKeyPem: apiKey.privateKeyPem,
  bundleId: BUNDLE,
  rootCertPem: chain.rootPem,
};

function transactionPayload(overrides: Record<string, unknown> = {}) {
  return {
    transactionId: "2000000111",
    originalTransactionId: "2000000100",
    bundleId: BUNDLE,
    productId: "nfg.coreplus.plus.monthly",
    environment: "Production",
    purchaseDate: NOW.getTime() - 60_000,
    expiresDate: NOW.getTime() + 30 * 86_400_000,
    appAccountToken: "user-1",
    ...overrides,
  };
}

function fakeFetch(handler: (url: string) => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

async function refusedWith(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => error instanceof StoreVerifyError && error.code === code);
}

test("a signed, active subscription from Apple is accepted and maps to its Core+ tier", async () => {
  const jws = signAppleTransaction(chain, transactionPayload());
  const { fetchImpl, calls } = fakeFetch((url) => {
    assert.ok(url.startsWith(`${PRODUCTION_HOST}/inApps/v1/transactions/2000000111`));
    return jsonResponse({ signedTransactionInfo: jws });
  });

  const { purchase, finish } = await verifyAppleTransaction({ transactionId: "2000000111", config, fetchImpl, now: NOW });

  assert.equal(calls.length, 1);
  assert.equal(purchase.provider, "APPLE");
  assert.equal(purchase.status, "ACTIVE");
  assert.equal(purchase.environment, "PRODUCTION");
  assert.equal(purchase.accountToken, "user-1");
  assert.deepEqual(purchase.grant, { kind: "SUBSCRIPTION", tier: "PLUS" });
  assert.equal(finish, undefined, "Apple needs no server call to finish a purchase; the app finishes it");
});

test("a transaction that exists only in the sandbox is looked up there and recorded as a sandbox purchase", async () => {
  const jws = signAppleTransaction(chain, transactionPayload({ environment: "Sandbox" }));
  const { fetchImpl, calls } = fakeFetch((url) => {
    if (url.startsWith(PRODUCTION_HOST)) return jsonResponse({ errorCode: 4040010 }, 404);
    return jsonResponse({ signedTransactionInfo: jws });
  });

  const { purchase } = await verifyAppleTransaction({ transactionId: "2000000111", config, fetchImpl, now: NOW });

  assert.deepEqual(calls.map((call) => call.url.split("/inApps")[0]), [PRODUCTION_HOST, SANDBOX_HOST]);
  assert.equal(purchase.environment, "SANDBOX");
});

test("a transaction Apple has no record of is refused as not found", async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse({ errorCode: 4040001 }, 404));
  await refusedWith(verifyAppleTransaction({ transactionId: "2000000111", config, fetchImpl, now: NOW }), "NOT_FOUND");
});

test("an Apple outage is reported as the store being unavailable, not as a bad purchase", async () => {
  const { fetchImpl } = fakeFetch(() => jsonResponse({}, 500));
  await refusedWith(verifyAppleTransaction({ transactionId: "2000000111", config, fetchImpl, now: NOW }), "STORE_UNAVAILABLE");
});

test("a network failure reaching Apple is reported as the store being unavailable", async () => {
  const fetchImpl = (async () => {
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch;
  await refusedWith(verifyAppleTransaction({ transactionId: "2000000111", config, fetchImpl, now: NOW }), "STORE_UNAVAILABLE");
});

test("a transaction whose payload was changed after signing is refused", () => {
  const jws = signAppleTransaction(chain, transactionPayload());
  const [header, , signature] = jws.split(".");
  const forged = Buffer.from(JSON.stringify(transactionPayload({ productId: "nfg.coreplus.infinite.yearly" }))).toString("base64url");
  assert.throws(() => verifySignedTransaction(`${header}.${forged}.${signature}`, chain.rootPem, NOW), (error: unknown) => {
    return error instanceof StoreVerifyError && error.code === "INVALID_PURCHASE" && /signature is invalid/.test(error.message);
  });
});

test("a transaction signed under a chain that does not lead to the pinned Apple root is refused", () => {
  const jws = signAppleTransaction(otherChain, transactionPayload());
  assert.throws(() => verifySignedTransaction(jws, chain.rootPem, NOW), /does not lead to the pinned root/);
});

test("a transaction whose certificates are outside their validity period is refused", () => {
  const jws = signAppleTransaction(chain, transactionPayload());
  const farFuture = new Date("2100-01-01T00:00:00Z");
  assert.throws(() => verifySignedTransaction(jws, chain.rootPem, farFuture), /outside its validity period/);
});

test("the signed transaction is decoded when it checks out", () => {
  const jws = signAppleTransaction(chain, transactionPayload());
  const payload = verifySignedTransaction(jws, chain.rootPem, NOW);
  assert.equal(payload.productId, "nfg.coreplus.plus.monthly");
});

test("a transaction for another app is refused", () => {
  assert.throws(
    () => purchaseFromApplePayload(transactionPayload({ bundleId: "com.someone.else" }), { transactionId: "2000000111", bundleId: BUNDLE, now: NOW }),
    /different app/,
  );
});

test("Apple answering with a different transaction than the one asked for is refused", () => {
  assert.throws(
    () => purchaseFromApplePayload(transactionPayload({ transactionId: "9999" }), { transactionId: "2000000111", bundleId: BUNDLE, now: NOW }),
    /different transaction/,
  );
});

test("a product that is not sold in the app is refused as unknown", () => {
  assert.throws(
    () => purchaseFromApplePayload(transactionPayload({ productId: "com.free.stuff" }), { transactionId: "2000000111", bundleId: BUNDLE, now: NOW }),
    (error: unknown) => error instanceof StoreVerifyError && error.code === "UNKNOWN_PRODUCT",
  );
});

test("a refunded (revoked) purchase is reported as revoked", () => {
  const purchase = purchaseFromApplePayload(transactionPayload({ revocationDate: NOW.getTime() - 1000 }), {
    transactionId: "2000000111",
    bundleId: BUNDLE,
    now: NOW,
  });
  assert.equal(purchase.status, "REVOKED");
});

test("a subscription past its expiry date is reported as expired", () => {
  const purchase = purchaseFromApplePayload(transactionPayload({ expiresDate: NOW.getTime() - 1000 }), {
    transactionId: "2000000111",
    bundleId: BUNDLE,
    now: NOW,
  });
  assert.equal(purchase.status, "EXPIRED");
});

test("the bearer token is an ES256 JWT with the key id, issuer and bundle id, signed by the server's key", () => {
  const token = signAppleBearer(config, Math.floor(NOW.getTime() / 1000));
  const [header, body, signature] = token.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString("utf8")), { alg: "ES256", kid: "TESTKEY123", typ: "JWT" });
  const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  assert.equal(claims.iss, "test-issuer");
  assert.equal(claims.bid, BUNDLE);
  assert.equal(claims.aud, "appstoreconnect-v1");
  const valid = verifyJwtSignature("sha256", Buffer.from(`${header}.${body}`), { key: apiKey.publicKeyPem, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url"));
  assert.ok(valid, "the bearer token signature must verify with the server's public key");
});
