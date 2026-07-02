import { Router } from "express";
import { CryptoAuthority } from "../lib/crypto-authority.js";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";

const router = Router();

const swapSchema = z.object({
  fromSymbol: z.string(),
  toSymbol: z.string(),
  amount: z.string().transform(v => BigInt(v)),
});

/**
 * @route GET /api/crypto/assets
 * @desc Get all industrial tradeable assets
 */
router.get("/assets", requireAuth, async (req, res) => {
  try {
    const assets = await CryptoAuthority.listAssets();
    res.json({ assets });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/crypto/swap
 * @desc Execute an industrial asset swap
 */
router.post("/swap", requireAuth, async (req, res) => {
  try {
    const { fromSymbol, toSymbol, amount } = swapSchema.parse(req.body);
    
    // Industrial safety: prevent negative swaps
    if (amount <= 0n) {
      return res.status(400).json({ error: "Swap amount must be greater than zero pulse units." });
    }

    const result = await CryptoAuthority.executeIndustrialSwap({
      userId: req.user!.id,
      fromSymbol,
      toSymbol,
      amount,
    });
    res.json(result);
  } catch (error: any) {
    console.error(`[CRYPTO_SWAP_ERROR] User=${req.user!.id} Error=${error.message}`);
    res.status(400).json({ error: error.message });
  }
});


export default router;
