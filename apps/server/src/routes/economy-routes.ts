import { Router } from "express";
import { z } from "zod";
import { EconomyAuthority, InsufficientBalanceError } from "../lib/economy-authority.js";
import {
  sentToday,
  transferCoins,
  TransferError,
  TRANSFER_DAILY_OUT_CAP,
  TRANSFER_MAX,
  TRANSFER_MIN,
  TRANSFER_MIN_ACCOUNT_AGE_MS,
} from "../lib/coin-transfers.js";
import { createNotification } from "../lib/notifications.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { requireAdmin } from "../middleware/admin.js";
import { economyRateLimit } from "../middleware/economy-rate-limit.js";
import { claimDaily, dailyStatus } from "../lib/rewards.js";

const router = Router();

// Validation Schemas
const adjustBalanceSchema = z.object({
  amount: z.union([z.string(), z.number(), z.bigint()]),
  currencyType: z.enum(["NC", "FS", "AC", "FR"]),
  reason: z.string().min(3).max(255),
  referenceId: z.string().optional(),
  metadata: z.any().optional(),
});

/** Daily reward status for the signed-in user. */
router.get("/daily/status", requireAuth, async (req, res) => {
  const status = await dailyStatus(req.user!.id);
  res.json({ ...status, nextAmount: status.nextAmount.toString() });
});

/** Claim today's reward (once per UTC day; streaks grow the payout). */
router.post("/daily/claim", requireAuth, economyRateLimit, async (req, res) => {
  const result = await claimDaily(req.user!.id);
  if (!result.ok) {
    res.status(400).json({ error: "Already claimed today. Come back after the reset.", status: { ...result.status, nextAmount: result.status.nextAmount.toString() } });
    return;
  }
  res.json({ ok: true, amount: result.amount.toString(), streak: result.streak, status: { ...result.status, nextAmount: result.status.nextAmount.toString() } });
});

const historyQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  kind: z.enum(["all", "in", "out"]).default("all"),
});

function serializeTransaction(t: { id: string; amount: bigint; type: string; reason: string | null; balanceAfter: bigint | null; timestamp: Date; metadata: unknown }) {
  const meta = (t.metadata ?? {}) as Record<string, unknown>;
  return {
    id: t.id,
    amount: t.amount.toString(),
    type: t.type,
    reason: t.reason,
    balanceAfter: t.balanceAfter?.toString() ?? null,
    timestamp: t.timestamp,
    counterpartyUsername: typeof meta.counterpartyUsername === "string" ? meta.counterpartyUsername : null,
    note: typeof meta.note === "string" ? meta.note : null,
  };
}

/** The signed-in user's coin history, newest first, cursor-paginated. */
router.get("/me/transactions", requireAuth, economyRateLimit, async (req, res) => {
  const parsed = historyQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const { cursor, limit, kind } = parsed.data;
  const rows = await prisma.economyTransaction.findMany({
    where: {
      userId: req.user!.id,
      // Hide the zero-amount row written when an account is first opened.
      amount: kind === "in" ? { gt: 0n } : kind === "out" ? { lt: 0n } : { not: 0n },
      account: { currencyType: "NC" },
    },
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, limit);
  res.json({ transactions: page.map(serializeTransaction), nextCursor: rows.length > limit ? page[page.length - 1].id : null });
});

/** Limits and how much the user can still send today, for the send form. */
router.get("/me/transfer-limits", requireAuth, async (req, res) => {
  const sent = await sentToday(req.user!.id);
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { createdAt: true } });
  const canSendAt = user ? new Date(user.createdAt.getTime() + TRANSFER_MIN_ACCOUNT_AGE_MS) : null;
  res.json({
    min: TRANSFER_MIN.toString(),
    max: TRANSFER_MAX.toString(),
    dailyCap: TRANSFER_DAILY_OUT_CAP.toString(),
    sentToday: sent.toString(),
    remainingToday: (TRANSFER_DAILY_OUT_CAP - sent > 0n ? TRANSFER_DAILY_OUT_CAP - sent : 0n).toString(),
    canSendAt: canSendAt && canSendAt.getTime() > Date.now() ? canSendAt : null,
  });
});

const transferSchema = z.object({
  recipient: z.string().trim().min(1).max(64),
  amount: z.union([z.string().regex(/^\d+$/), z.number().int().positive()]).transform((v) => BigInt(v)),
  note: z.string().trim().max(140).optional(),
  idempotencyKey: z.string().uuid(),
});

/** Send coins to another player by username. */
router.post("/transfer", requireAuth, requireCsrf, economyRateLimit, async (req, res) => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a username and a whole number of coins." });
    return;
  }
  try {
    const result = await transferCoins({
      senderId: req.user!.id,
      recipientUsername: parsed.data.recipient,
      amount: parsed.data.amount,
      note: parsed.data.note,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    void createNotification({
      userId: result.recipient.id,
      type: "SYSTEM",
      title: "You received Nexus Forge Coins",
      body: `@${result.sender.username} sent you ${result.amount.toLocaleString("en-US")} coins${result.note ? `: "${result.note}"` : "."}`,
      data: { kind: "coin-transfer", fromUserId: result.sender.id, amount: result.amount.toString() },
    }).catch(() => undefined);
    res.json({
      ok: true,
      balance: result.balance.toString(),
      recipient: { id: result.recipient.id, username: result.recipient.username, displayName: result.recipient.displayName },
      amount: result.amount.toString(),
    });
  } catch (error) {
    if (error instanceof TransferError) {
      res.status(error.code === "RECIPIENT_NOT_FOUND" ? 404 : error.code === "DUPLICATE" ? 409 : 400).json({ error: error.message, code: error.code });
      return;
    }
    if (error instanceof InsufficientBalanceError) {
      res.status(402).json({ error: "Not enough Nexus Forge Coins.", code: "INSUFFICIENT" });
      return;
    }
    console.error("[ECONOMY_TRANSFER_ERROR]", { userId: req.user!.id, error });
    res.status(500).json({ error: "That transfer could not be completed. No coins were moved." });
  }
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
