import { Router } from "express";
import { CryptoAuthority } from "../lib/crypto-authority.js";
import { InsufficientBalanceError } from "../lib/economy-authority.js";
import { requireAge, requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { economyRateLimit } from "../middleware/economy-rate-limit.js";
import { z } from "zod";

const router = Router();

// Same gate as the other coin features (economy, mining, jackpot get it where index.ts mounts
// them): a signed-in adult. This router is mounted without it, so the router applies it itself.
router.use(requireAuth, requireAge);

const SWAP_SYMBOLS = ["NF_ETH", "NF_BTC", "FORGE"] as const;

const swapSchema = z
  .object({
    fromSymbol: z.enum(SWAP_SYMBOLS),
    toSymbol: z.enum(SWAP_SYMBOLS),
    // Whole units as digits only, so BigInt() can't throw on "1.5" or "abc".
    amount: z.string().regex(/^\d{1,18}$/).transform((v) => BigInt(v)),
  })
  .refine((swap) => swap.fromSymbol !== swap.toSymbol, { message: "Pick two different assets" });

/**
 * @route GET /api/crypto/assets
 * @desc Get all industrial tradeable assets
 */
router.get("/assets", async (req, res) => {
  try {
    const assets = await CryptoAuthority.listAssets();
    res.json({ assets });
  } catch (error) {
    console.error("[CRYPTO_ASSETS_ERROR]", { userId: req.user!.id, error });
    res.status(500).json({ error: "Assets could not be loaded. Please try again." });
  }
});

/**
 * @route POST /api/crypto/swap
 * @desc Execute an industrial asset swap
 */
router.post("/swap", requireCsrf, economyRateLimit, async (req, res) => {
  const parsed = swapSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: `Choose two different assets (${SWAP_SYMBOLS.join(", ")}) and a whole-number amount.` });
    return;
  }
  const { fromSymbol, toSymbol, amount } = parsed.data;

  // Industrial safety: prevent negative swaps
  if (amount <= 0n) {
    return res.status(400).json({ error: "Swap amount must be greater than zero pulse units." });
  }

  try {
    const result = await CryptoAuthority.executeIndustrialSwap({
      userId: req.user!.id,
      fromSymbol,
      toSymbol,
      amount,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      res.status(402).json({ error: `Not enough ${fromSymbol}.`, code: "INSUFFICIENT" });
      return;
    }
    if (error instanceof Error && error.message === "That amount is too small to swap.") {
      res.status(400).json({ error: error.message });
      return;
    }
    // The full error stays in the log; it used to be sent back as is.
    console.error("[CRYPTO_SWAP_ERROR]", { userId: req.user!.id, error });
    res.status(500).json({ error: "The swap could not be completed. Nothing was exchanged." });
  }
});


export default router;
