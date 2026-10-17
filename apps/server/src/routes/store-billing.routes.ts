import { createHash, timingSafeEqual } from "node:crypto";
import type { Response } from "express";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env.js";
import { accountOrIpKey } from "../middleware/rate-limit.js";
import { requireAuth } from "../middleware/auth.js";
import { verifyAppleTransaction } from "../lib/store-billing/apple.js";
import { handleAppleNotification } from "../lib/store-billing/apple-notifications.js";
import { appleConfig, googleConfig } from "../lib/store-billing/config.js";
import { verifyGooglePurchase } from "../lib/store-billing/google.js";
import { handleGoogleNotification } from "../lib/store-billing/google-notifications.js";
import { applyStorePurchase } from "../lib/store-billing/grant.js";
import { StoreVerifyError, type StoreVerification } from "../lib/store-billing/types.js";

// POST /api/billing/store/verify: the app sends the store purchase it just made, and the server checks it with the
// store itself before granting anything. Apple: send the transactionId. Google: send the productId and purchaseToken.
//
// POST /api/billing/store/apple/notifications: Apple's App Store Server Notifications (V2). Trusted only once signed.
// POST /api/billing/store/google/notifications?token=...: Google Play's Pub/Sub push. Needs the shared token.
export const storeBillingRouter = Router();

const verifySchema = z.object({
  provider: z.enum(["APPLE", "GOOGLE", "MICROSOFT", "AMAZON"]),
  transactionId: z.string().min(1).max(120).optional(),
  productId: z.string().min(1).max(120).optional(),
  purchaseToken: z.string().min(1).max(4096).optional(),
});

// Each check calls a store, so it is limited per account.
const storeVerifyRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: accountOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many store purchase checks. Slow down." },
});

const STATUS_BY_CODE = {
  NOT_CONFIGURED: 503,
  UNKNOWN_PRODUCT: 422,
  INVALID_PURCHASE: 422,
  ACCOUNT_MISMATCH: 403,
  CLAIMED: 409,
  NOT_FOUND: 404,
  STORE_UNAVAILABLE: 502,
} as const;

/** Sends a store error with the status its code maps to. Store outages and configuration gaps are not described in detail. */
function sendStoreError(res: Response, error: unknown, label: string): void {
  if (error instanceof StoreVerifyError) {
    const status = STATUS_BY_CODE[error.code];
    res.status(status).json({
      error: status >= 500 ? "The store could not be reached. Try again shortly." : error.message,
      code: error.code,
    });
    return;
  }
  console.error(`store ${label} failed`, error);
  res.status(500).json({ error: "Store purchase could not be processed" });
}

/** Compares the shared token without leaking its length or content through timing. */
function tokenMatches(given: string, expected: string): boolean {
  if (given.length === 0) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

async function verifyWithStore(body: z.infer<typeof verifySchema>): Promise<StoreVerification> {
  if (body.provider === "APPLE") {
    const config = appleConfig();
    if (!config) throw new StoreVerifyError("NOT_CONFIGURED", "Apple purchases are not set up on this server yet");
    if (!body.transactionId) throw new StoreVerifyError("INVALID_PURCHASE", "transactionId is required for Apple purchases");
    return verifyAppleTransaction({ transactionId: body.transactionId, config });
  }
  if (body.provider === "GOOGLE") {
    const config = googleConfig();
    if (!config) throw new StoreVerifyError("NOT_CONFIGURED", "Google Play purchases are not set up on this server yet");
    if (!body.productId || !body.purchaseToken) {
      throw new StoreVerifyError("INVALID_PURCHASE", "productId and purchaseToken are required for Google Play purchases");
    }
    return verifyGooglePurchase({ productId: body.productId, purchaseToken: body.purchaseToken, config });
  }
  throw new StoreVerifyError("NOT_CONFIGURED", `${body.provider === "MICROSOFT" ? "Microsoft Store" : "Amazon"} purchases are not set up yet`);
}

storeBillingRouter.post("/store/verify", requireAuth, storeVerifyRateLimit, async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid store purchase request" });
    return;
  }

  try {
    const verification = await verifyWithStore(parsed.data);
    const receipt = parsed.data.purchaseToken ?? parsed.data.transactionId ?? "";
    const outcome = await applyStorePurchase({ userId: req.user!.id, purchase: verification.purchase, receipt });
    // Tell the store it was delivered. Best effort: a failure here is retried the next time this purchase is verified.
    await verification.finish?.().catch((error: unknown) => {
      console.error("store delivery acknowledgement failed", verification.purchase.provider, error instanceof Error ? error.message : error);
    });
    res.json({
      status: outcome,
      productId: verification.purchase.productId,
      expiresAt: verification.purchase.expiresAt,
      environment: verification.purchase.environment,
    });
  } catch (error) {
    sendStoreError(res, error, "purchase verification");
  }
});

storeBillingRouter.post("/store/apple/notifications", async (req, res) => {
  const config = appleConfig();
  if (!config) {
    res.status(503).json({ error: "Apple purchases are not set up on this server yet" });
    return;
  }
  const signedPayload = (req.body as { signedPayload?: unknown } | undefined)?.signedPayload;
  if (typeof signedPayload !== "string") {
    res.status(400).json({ error: "signedPayload is required" });
    return;
  }
  try {
    const result = await handleAppleNotification({ signedPayload, config, now: new Date() });
    res.json({ received: true, type: result.type, outcome: result.outcome });
  } catch (error) {
    sendStoreError(res, error, "Apple notification");
  }
});

storeBillingRouter.post("/store/google/notifications", async (req, res) => {
  const expected = env.GOOGLE_RTDN_TOKEN;
  const config = googleConfig();
  if (!expected || !config) {
    res.status(503).json({ error: "Google Play notifications are not set up on this server yet" });
    return;
  }
  const given = typeof req.query.token === "string" ? req.query.token : "";
  if (!tokenMatches(given, expected)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await handleGoogleNotification({ envelope: req.body, config, now: new Date() });
    res.json({ received: true, kind: result.kind, outcome: result.outcome });
  } catch (error) {
    if (error instanceof StoreVerifyError && error.code === "INVALID_PURCHASE") {
      res.status(400).json({ error: error.message, code: error.code });
      return;
    }
    sendStoreError(res, error, "Google notification");
  }
});
