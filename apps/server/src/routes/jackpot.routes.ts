import { Router } from "express";
import { z } from "zod";
import { InsufficientBalanceError } from "../lib/economy-authority.js";
import {
  buyTickets,
  ensureOpenRound,
  JACKPOT_SLUG,
  JackpotError,
  MAX_TICKETS_PER_PLAYER,
  MIN_PLAYERS,
  serializeRound,
} from "../lib/jackpot.js";
import { prisma } from "../lib/prisma.js";
import { requireCsrf } from "../middleware/csrf.js";
import { economyRateLimit } from "../middleware/economy-rate-limit.js";

const router = Router();

const winnerSelect = { id: true, username: true, displayName: true, avatar: true } as const;

/** The open round, your tickets in it, and the last few results. */
router.get("/current", async (req, res) => {
  const round = await ensureOpenRound();
  const [mine, players, recent] = await Promise.all([
    prisma.jackpotEntry.aggregate({ where: { roundId: round.id, userId: req.user!.id }, _sum: { tickets: true } }),
    prisma.jackpotEntry.findMany({ where: { roundId: round.id }, distinct: ["userId"], select: { userId: true } }),
    prisma.jackpotRound.findMany({
      where: { slug: JACKPOT_SLUG, status: { not: "OPEN" } },
      orderBy: { number: "desc" },
      take: 5,
      include: { winner: { select: winnerSelect } },
    }),
  ]);
  res.json({
    round: serializeRound(round),
    myTickets: mine._sum.tickets ?? 0,
    playerCount: players.length,
    rules: { maxTicketsPerPlayer: MAX_TICKETS_PER_PLAYER, minPlayers: MIN_PLAYERS },
    recent: recent.map(serializeRound),
  });
});

/** Past rounds with the revealed seed, so anyone can re-check a draw. */
router.get("/history", async (_req, res) => {
  const rounds = await prisma.jackpotRound.findMany({
    where: { slug: JACKPOT_SLUG, status: { not: "OPEN" } },
    orderBy: { number: "desc" },
    take: 20,
    include: { winner: { select: winnerSelect } },
  });
  res.json({ rounds: rounds.map(serializeRound) });
});

const buySchema = z.object({
  count: z.number().int().min(1).max(MAX_TICKETS_PER_PLAYER),
  idempotencyKey: z.string().uuid(),
});

router.post("/tickets", requireCsrf, economyRateLimit, async (req, res) => {
  const parsed = buySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: `Buy between 1 and ${MAX_TICKETS_PER_PLAYER} tickets.` });
    return;
  }
  try {
    const result = await buyTickets({ userId: req.user!.id, count: parsed.data.count, idempotencyKey: parsed.data.idempotencyKey });
    res.json({ ok: true, round: serializeRound(result.round), myTickets: result.ticketsHeld, balance: result.balance.toString() });
  } catch (error) {
    if (error instanceof JackpotError) {
      res.status(error.code === "DUPLICATE" ? 409 : 400).json({ error: error.message, code: error.code });
      return;
    }
    if (error instanceof InsufficientBalanceError) {
      res.status(402).json({ error: "Not enough Vexora Coins.", code: "INSUFFICIENT" });
      return;
    }
    console.error("[JACKPOT_BUY_ERROR]", { userId: req.user!.id, error });
    res.status(500).json({ error: "Those tickets could not be bought. No coins were taken." });
  }
});

export default router;
