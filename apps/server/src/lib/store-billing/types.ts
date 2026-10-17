import type { PaidFeatureCode } from "@prisma/client";

export type StoreProvider = "APPLE" | "GOOGLE" | "MICROSOFT" | "AMAZON";

export type StoreProductGrant =
  | { kind: "SUBSCRIPTION"; tier: "CORE" | "PLUS" | "ELITE" | "INFINITE" }
  | { kind: "ADDON"; featureCode: PaidFeatureCode };

/** A store purchase the store has confirmed, after its signature or server lookup has been checked. */
export type VerifiedStorePurchase = {
  provider: StoreProvider;
  productId: string;
  transactionId: string;
  originalTransactionId: string | null;
  environment: "SANDBOX" | "PRODUCTION";
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  purchasedAt: Date;
  expiresAt: Date | null;
  /** The account the purchase was made under, as the store recorded it. It must be the signed-in user's id. */
  accountToken: string | null;
  grant: StoreProductGrant;
};

export type StoreErrorCode =
  | "NOT_CONFIGURED"
  | "UNKNOWN_PRODUCT"
  | "INVALID_PURCHASE"
  | "ACCOUNT_MISMATCH"
  | "CLAIMED"
  | "NOT_FOUND"
  | "STORE_UNAVAILABLE";

export class StoreVerifyError extends Error {
  constructor(
    readonly code: StoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StoreVerifyError";
  }
}

/** What a store adapter returns: the verified purchase, and a best-effort step that tells the store it was delivered. */
export type StoreVerification = {
  purchase: VerifiedStorePurchase;
  finish?: () => Promise<void>;
};
