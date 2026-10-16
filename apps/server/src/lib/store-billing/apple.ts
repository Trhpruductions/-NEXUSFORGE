import { createPrivateKey, createSign, verify as verifySignature, X509Certificate } from "node:crypto";
import { grantForProduct } from "./catalog.js";
import { StoreVerifyError, type StoreVerification, type VerifiedStorePurchase } from "./types.js";

// The server asks Apple about the transaction by its ID, then checks Apple's signed answer. The client's own copy of
// the receipt is never trusted on its own.

export type AppleConfig = {
  issuerId: string;
  keyId: string;
  privateKeyPem: string;
  bundleId: string;
  /** Apple Root CA certificate (PEM). Every signed transaction must chain to it. */
  rootCertPem: string;
};

type FetchLike = typeof fetch;

const HOSTS = {
  PRODUCTION: "https://api.storekit.itunes.apple.com",
  SANDBOX: "https://api.storekit-sandbox.itunes.apple.com",
} as const;

// Apple answers this when a transaction exists, but in the other environment.
const WRONG_ENVIRONMENT_CODE = 4040010;

/** The App Store Server API bearer token: an ES256 JWT signed with the in-app purchase key. */
export function signAppleBearer(config: AppleConfig, nowSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: config.keyId, typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: config.issuerId, iat: nowSeconds, exp: nowSeconds + 300, aud: "appstoreconnect-v1", bid: config.bundleId }),
  ).toString("base64url");
  const input = `${header}.${payload}`;
  const signature = createSign("SHA256")
    .update(input)
    .sign({ key: createPrivateKey(config.privateKeyPem), dsaEncoding: "ieee-p1363" })
    .toString("base64url");
  return `${input}.${signature}`;
}

/**
 * Checks a StoreKit signed transaction. Its x5c certificate chain must lead to the pinned Apple root, every
 * certificate must be inside its validity period, and the ES256 signature must match the leaf certificate.
 * Returns the decoded payload only when all of that holds.
 */
export function verifySignedTransaction(jws: string, rootCertPem: string, now: Date): Record<string, unknown> {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new StoreVerifyError("INVALID_PURCHASE", "Apple returned a malformed transaction");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as { alg?: string; x5c?: string[] };
  if (header.alg !== "ES256" || !Array.isArray(header.x5c) || header.x5c.length < 2) {
    throw new StoreVerifyError("INVALID_PURCHASE", "Apple transaction is not signed as expected");
  }

  const chain = header.x5c.map((der) => new X509Certificate(Buffer.from(der, "base64")));
  for (let i = 0; i < chain.length - 1; i++) {
    if (!chain[i].checkIssued(chain[i + 1]) || !chain[i].verify(chain[i + 1].publicKey)) {
      throw new StoreVerifyError("INVALID_PURCHASE", "Apple certificate chain is broken");
    }
  }

  const pinned = new X509Certificate(rootCertPem);
  const top = chain[chain.length - 1];
  const anchored = top.fingerprint256 === pinned.fingerprint256 || (top.checkIssued(pinned) && top.verify(pinned.publicKey));
  if (!anchored) throw new StoreVerifyError("INVALID_PURCHASE", "Apple certificate chain does not lead to the pinned root");
  for (const cert of chain) {
    if (now < new Date(cert.validFrom) || now > new Date(cert.validTo)) {
      throw new StoreVerifyError("INVALID_PURCHASE", "Apple certificate is outside its validity period");
    }
  }

  const signed = verifySignature(
    "sha256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    { key: chain[0].publicKey, dsaEncoding: "ieee-p1363" },
    Buffer.from(parts[2], "base64url"),
  );
  if (!signed) throw new StoreVerifyError("INVALID_PURCHASE", "Apple transaction signature is invalid");

  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
}

type ApplePayload = {
  transactionId?: string;
  originalTransactionId?: string;
  bundleId?: string;
  productId?: string;
  environment?: string;
  purchaseDate?: number;
  expiresDate?: number;
  revocationDate?: number | null;
  appAccountToken?: string;
};

/** Turns a verified Apple payload into a purchase, refusing anything that is not ours or not for this transaction. */
export function purchaseFromApplePayload(
  payload: ApplePayload,
  expected: { transactionId: string; bundleId: string; now: Date },
): VerifiedStorePurchase {
  if (payload.bundleId !== expected.bundleId) throw new StoreVerifyError("INVALID_PURCHASE", "This purchase is for a different app");
  if (payload.transactionId !== expected.transactionId) {
    throw new StoreVerifyError("INVALID_PURCHASE", "Apple returned a different transaction than the one requested");
  }
  const grant = grantForProduct(payload.productId ?? "");
  if (!grant) throw new StoreVerifyError("UNKNOWN_PRODUCT", "This product is not sold in the app");
  if (payload.purchaseDate === undefined) throw new StoreVerifyError("INVALID_PURCHASE", "Apple transaction has no purchase date");

  const environment = payload.environment === "Sandbox" ? "SANDBOX" : payload.environment === "Production" ? "PRODUCTION" : null;
  if (!environment) throw new StoreVerifyError("INVALID_PURCHASE", "Apple transaction has an unknown environment");

  const status =
    payload.revocationDate != null
      ? "REVOKED"
      : payload.expiresDate !== undefined && payload.expiresDate <= expected.now.getTime()
        ? "EXPIRED"
        : "ACTIVE";

  return {
    provider: "APPLE",
    productId: payload.productId ?? "",
    transactionId: expected.transactionId,
    originalTransactionId: payload.originalTransactionId ?? null,
    environment,
    status,
    purchasedAt: new Date(payload.purchaseDate),
    expiresAt: payload.expiresDate !== undefined ? new Date(payload.expiresDate) : null,
    accountToken: payload.appAccountToken ?? null,
    grant,
  };
}

async function lookUpTransaction(fetchImpl: FetchLike, host: string, transactionId: string, bearer: string) {
  let response: Response;
  try {
    response = await fetchImpl(`${host}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
  } catch {
    throw new StoreVerifyError("STORE_UNAVAILABLE", "Apple could not be reached");
  }
  const body = (await response.json().catch(() => null)) as { signedTransactionInfo?: unknown; errorCode?: number } | null;
  return { status: response.status, body };
}

/** Asks Apple about one transaction and returns it only when Apple's signed answer checks out. */
export async function verifyAppleTransaction(input: {
  transactionId: string;
  config: AppleConfig;
  fetchImpl?: FetchLike;
  now?: Date;
}): Promise<StoreVerification> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = input.now ?? new Date();
  const bearer = signAppleBearer(input.config, Math.floor(now.getTime() / 1000));

  let lookup = await lookUpTransaction(fetchImpl, HOSTS.PRODUCTION, input.transactionId, bearer);
  if (lookup.status === 404 && lookup.body?.errorCode === WRONG_ENVIRONMENT_CODE) {
    lookup = await lookUpTransaction(fetchImpl, HOSTS.SANDBOX, input.transactionId, bearer);
  }
  if (lookup.status === 404) throw new StoreVerifyError("NOT_FOUND", "Apple has no record of this transaction");
  if (lookup.status !== 200 || typeof lookup.body?.signedTransactionInfo !== "string") {
    throw new StoreVerifyError("STORE_UNAVAILABLE", `Apple could not confirm the purchase (HTTP ${lookup.status})`);
  }

  const payload = verifySignedTransaction(lookup.body.signedTransactionInfo, input.config.rootCertPem, now) as ApplePayload;
  const purchase = purchaseFromApplePayload(payload, { transactionId: input.transactionId, bundleId: input.config.bundleId, now });
  return { purchase };
}
