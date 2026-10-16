import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { verifyAppleTransaction } from "../lib/store-billing/apple.js";
import { appleConfig, googleConfig } from "../lib/store-billing/config.js";
import { verifyGooglePurchase } from "../lib/store-billing/google.js";
import { applyStorePurchase } from "../lib/store-billing/grant.js";
import { StoreVerifyError, type StoreVerification } from "../lib/store-billing/types.js";

// POST /api/billing/store/verify: the app sends the store purchase it just made, and the server checks it with the
// store itself before granting anything. Apple: send the transactionId. Google: send the productId and purchaseToken.
export const storeBillingRouter = Router();

const verifySchema = z.object({
  provider: z.enum(["APPLE", "GOOGLE", "MICROSOFT", "AMAZON"]),
  transactionId: z.string().min(1).max(120).optional(),
  productId: z.string().min(1).max(120).optional(),
  purchaseToken: z.string().min(1).max(4096).optional(),
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

storeBillingRouter.post("/store/verify", requireAuth, async (req, res) => {
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
    if (error instanceof StoreVerifyError) {
      const status = STATUS_BY_CODE[error.code];
      // Store outages and configuration gaps are not described to the client in detail.
      res.status(status).json({
        error: status >= 500 ? "The store could not be reached. Try again shortly." : error.message,
        code: error.code,
      });
      return;
    }
    console.error("store purchase verification failed", error);
    res.status(500).json({ error: "Store purchase could not be verified" });
  }
});
