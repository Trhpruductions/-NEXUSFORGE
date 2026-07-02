import { Router } from "express";
import { z } from "zod";
import { EconomyAuthority } from "../lib/economy-authority.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { economyRateLimit } from "../middleware/economy-rate-limit.js";

const router = Router();

// Validation Schemas
const adjustBalanceSchema = z.object({
  amount: z.union([z.string(), z.number(), z.bigint()]),
  currencyType: z.enum(["NC", "FS", "AC", "FR"]),
  reason: z.string().min(3).max(255),
  referenceId: z.string().optional(),
  metadata: z.any().optional(),
});

/**
 * @route GET /api/economy/:userId
 * @desc Get user economy stats
 * @access Private
 */
router.get("/:userId", requireAuth, economyRateLimit, async (req, res) => {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    
    // Users can only view their own stats unless they are admin
    if (req.user?.id !== userId && req.user?.appRole !== "ADMIN") {
      return res.status(403).json({ error: "Access denied" });
    }

    let accounts = await EconomyAuthority.getAllUserAccounts(userId);
    
    // If no accounts exist, initialize basic NC account
    if (accounts.length === 0) {
      const initialAccount = await EconomyAuthority.adjustBalance({
        userId: userId,
        amount: 0n,
        currencyType: "NC",
        reason: "Account Initialization",
      });
      accounts = [initialAccount as any];
    }
    
    const serialized = accounts.map(acc => ({
      ...acc,
      balance: acc.balance.toString(),
      frozenBalance: (acc as any).frozenBalance?.toString() || "0",
      lifetimeEarnings: (acc as any).lifetimeEarnings?.toString() || "0",
      transactions: (acc as any).transactions?.map((t: any) => ({
        ...t,
        amount: t.amount.toString()
      })) || []
    }));

    res.json(serialized);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/economy/:userId/adjust
 * @desc Adjust user balance (Admin only)
 * @access Admin
 */
router.post("/:userId/adjust", requireAuth, requireAdmin, economyRateLimit, async (req, res) => {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const validatedData = adjustBalanceSchema.parse(req.body);
    
    const result = await EconomyAuthority.adjustBalance({
      userId: userId,
      amount: BigInt(validatedData.amount),
      currencyType: validatedData.currencyType,
      reason: validatedData.reason,
      referenceId: validatedData.referenceId,
      metadata: validatedData.metadata,
    });
    
    res.json({
      ...result,
      balance: result.balance.toString(),
      lifetimeEarnings: result.lifetimeEarnings.toString()
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.issues });
    }
    res.status(400).json({ error: error.message });
  }
});

export default router;
