import { createHash, createHmac, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { EconomyAuthority } from "./economy-authority.js";
import { jackpotRefundReference, jackpotTicketReference, jackpotWinReference } from "./economy-references.js";
import { createNotification } from "./notifications.js";
import { prisma } from "./prisma.js";

// Hourly Nexus Forge Coin jackpot.
//
// Nexus Forge Coins are earn-only: they are never sold for money and can't be cashed out.
// That is what keeps this a game rather than real-money gambling. If coins ever become
// purchasable or redeemable, this feature needs a legal review before that ships.
//
// The pot is a small seed plus every ticket sold. The winner takes the pot minus the
// rake; the rake is simply not paid out, which takes coins out of circulation.

export const JACKPOT_SLUG = "vexora";
export const TICKET_PRICE = 50n;
export const ROUND_SEED = 1_000n;
export const RAKE_BPS = 500; // 5%
export const ROUND_DURATION_MS = 60 * 60 * 1000;
export const MAX_TICKETS_PER_PLAYER = 100;
/** Fewer distinct players than this and the round is refunded instead of drawn. */
export const MIN_PLAYERS = 2;

export type JackpotErrorCode = "NO_ROUND" | "CLOSED" | "COUNT_RANGE" | "PLAYER_CAP" | "DUPLICATE";

export class JackpotError extends Error {
  constructor(readonly code: JackpotErrorCode, message: string) {
    super(message);
    this.name = "JackpotError";
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * The winning ticket, fixed by the seed committed to when the round opened. Exported so
 * the verification shown to players and the draw itself can never disagree.
 */
export function winningTicketFor(serverSeed: string, roundId: string, totalTickets: number) {
  const digest = createHmac("sha256", serverSeed).update(roundId).digest("hex");
  return Number(BigInt(`0x${digest}`) % BigInt(totalTickets));
}

export function payoutFor(pot: bigint, rakeBps: number) {
  return pot - (pot * BigInt(rakeBps)) / 10_000n;
}

/** The open round, creating the next one if there isn't one. */
export async function ensureOpenRound(now = new Date()) {
  const open = await prisma.jackpotRound.findFirst({ where: { slug: JACKPOT_SLUG, status: "OPEN" }, orderBy: { number: "desc" } });
  if (open) return open;

  const last = await prisma.jackpotRound.findFirst({ where: { slug: JACKPOT_SLUG }, orderBy: { number: "desc" }, select: { number: true } });
  const serverSeed = randomBytes(32).toString("hex");
  try {
    return await prisma.jackpotRound.create({
      data: {
        slug: JACKPOT_SLUG,
        number: (last?.number ?? 0) + 1,
        ticketPrice: TICKET_PRICE,
        seedAmount: ROUND_SEED,
        pot: ROUND_SEED,
        rakeBps: RAKE_BPS,
        opensAt: now,
        closesAt: new Date(now.getTime() + ROUND_DURATION_MS),
        serverSeed,
        serverSeedHash: sha256(serverSeed),
      },
    });
  } catch (error) {
    // Two callers raced to open the same round number; the other one won.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.jackpotRound.findFirstOrThrow({ where: { slug: JACKPOT_SLUG, status: "OPEN" }, orderBy: { number: "desc" } });
    }
    throw error;
  }
}

export async function buyTickets(params: { userId: string; count: number; idempotencyKey: string }) {
  const { userId, count, idempotencyKey } = params;
  if (!Number.isInteger(count) || count < 1 || count > MAX_TICKETS_PER_PLAYER) {
    throw new JackpotError("COUNT_RANGE", `Buy between 1 and ${MAX_TICKETS_PER_PLAYER} tickets.`);
  }
  const round = await ensureOpenRound();

  try {
    return await EconomyAuthority.serializable(async (tx, retryCount) => {
      const current = await tx.jackpotRound.findUnique({ where: { id: round.id } });
      if (!current) throw new JackpotError("NO_ROUND", "No jackpot round is open.");
      if (current.status !== "OPEN" || current.closesAt.getTime() <= Date.now()) {
        throw new JackpotError("CLOSED", "This round just closed. The next one opens in a moment.");
      }

      const owned = await tx.jackpotEntry.aggregate({ where: { roundId: current.id, userId }, _sum: { tickets: true } });
      const already = owned._sum.tickets ?? 0;
      if (already + count > MAX_TICKETS_PER_PLAYER) {
        const left = MAX_TICKETS_PER_PLAYER - already;
        throw new JackpotError("PLAYER_CAP", left > 0 ? `You can buy ${left} more ticket${left === 1 ? "" : "s"} this round.` : `You already hold the maximum of ${MAX_TICKETS_PER_PLAYER} tickets this round.`);
      }

      const cost = current.ticketPrice * BigInt(count);
      const account = await EconomyAuthority.applyChange(tx, {
        userId,
        amount: -cost,
        currencyType: "NC",
        type: "JACKPOT_TICKET",
        reason: `Jackpot #${current.number}: ${count} ticket${count === 1 ? "" : "s"}`,
        referenceId: jackpotTicketReference(userId, current.id, idempotencyKey),
        metadata: { roundId: current.id, roundNumber: current.number, tickets: count },
      }, retryCount);

      // Reserve the ticket numbers with the round's own counter (an atomic increment, and only while
      // the round is still open), then number the entry from what that increment returned. Numbering
      // it from the totalTickets read earlier let two simultaneous buyers get the same numbers.
      const reserved = await tx.jackpotRound.updateMany({
        where: { id: current.id, status: "OPEN", closesAt: { gt: new Date() } },
        data: { totalTickets: { increment: count }, pot: { increment: cost } },
      });
      if (reserved.count !== 1) throw new JackpotError("CLOSED", "This round just closed. The next one opens in a moment.");
      const updated = await tx.jackpotRound.findUniqueOrThrow({ where: { id: current.id } });
      const entry = await tx.jackpotEntry.create({
        data: { roundId: current.id, userId, tickets: count, firstTicket: updated.totalTickets - count, amountPaid: cost },
      });
      return { round: updated, entry, balance: account.balance as bigint, ticketsHeld: already + count };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new JackpotError("DUPLICATE", "Those tickets were already bought.");
    }
    throw error;
  }
}

type SettleOutcome =
  | { kind: "skipped" }
  | { kind: "refunded"; roundNumber: number; players: string[] }
  | { kind: "won"; roundNumber: number; winnerId: string; payout: bigint; players: string[] };

/** Draws (or refunds) one closed round. Safe to call twice: the second call sees it settled. */
export async function settleRound(roundId: string, now = new Date()): Promise<SettleOutcome> {
  return EconomyAuthority.serializable(async (tx, retryCount) => {
    const round = await tx.jackpotRound.findUnique({ where: { id: roundId }, include: { entries: { orderBy: { firstTicket: "asc" } } } });
    if (!round || round.status !== "OPEN" || round.closesAt > now) return { kind: "skipped" } as const;

    const players = [...new Set(round.entries.map((entry) => entry.userId))];

    if (players.length < MIN_PLAYERS) {
      for (const entry of round.entries) {
        await EconomyAuthority.applyChange(tx, {
          userId: entry.userId,
          amount: entry.amountPaid,
          currencyType: "NC",
          type: "JACKPOT_REFUND",
          reason: `Jackpot #${round.number} refunded (not enough players)`,
          referenceId: jackpotRefundReference(entry.userId, entry.id),
          metadata: { roundId: round.id, roundNumber: round.number },
        }, retryCount);
      }
      await tx.jackpotRound.update({ where: { id: round.id }, data: { status: "REFUNDED", drawnAt: now } });
      return { kind: "refunded", roundNumber: round.number, players } as const;
    }

    const winningTicket = winningTicketFor(round.serverSeed, round.id, round.totalTickets);
    const winningEntry = round.entries.find((entry) => winningTicket >= entry.firstTicket && winningTicket < entry.firstTicket + entry.tickets);
    if (!winningEntry) throw new Error(`Jackpot #${round.number}: no entry holds ticket ${winningTicket} of ${round.totalTickets}`);

    const payout = payoutFor(round.pot, round.rakeBps);
    await EconomyAuthority.applyChange(tx, {
      userId: winningEntry.userId,
      amount: payout,
      currencyType: "NC",
      type: "JACKPOT_WIN",
      reason: `Won Jackpot #${round.number}`,
      referenceId: jackpotWinReference(winningEntry.userId, round.id),
      metadata: { roundId: round.id, roundNumber: round.number, winningTicket, totalTickets: round.totalTickets },
    }, retryCount);
    await tx.jackpotRound.update({
      where: { id: round.id },
      data: { status: "SETTLED", drawnAt: now, winningTicket, payout, winnerId: winningEntry.userId },
    });
    return { kind: "won", roundNumber: round.number, winnerId: winningEntry.userId, payout, players } as const;
  });
}

async function announce(outcome: SettleOutcome) {
  if (outcome.kind === "refunded") {
    await Promise.all(outcome.players.map((userId) =>
      createNotification({ userId, type: "SYSTEM", title: `Jackpot #${outcome.roundNumber} refunded`, body: "Not enough players joined, so your tickets were refunded.", data: { kind: "jackpot" } }).catch(() => undefined),
    ));
  } else if (outcome.kind === "won") {
    await Promise.all(outcome.players.map((userId) =>
      createNotification(userId === outcome.winnerId
        ? { userId, type: "SYSTEM", title: `You won Jackpot #${outcome.roundNumber}!`, body: `${outcome.payout.toLocaleString("en-US")} Nexus Forge Coins are in your wallet.`, data: { kind: "jackpot" } }
        : { userId, type: "SYSTEM", title: `Jackpot #${outcome.roundNumber} drawn`, body: "Not this time. A new round is open now.", data: { kind: "jackpot" } }).catch(() => undefined),
    ));
  }
}

/** Settles every round whose time is up, then makes sure the next one is open. */
export async function runJackpotTick(now = new Date()) {
  const due = await prisma.jackpotRound.findMany({ where: { slug: JACKPOT_SLUG, status: "OPEN", closesAt: { lte: now } }, select: { id: true } });
  for (const { id } of due) {
    const outcome = await settleRound(id, now);
    void announce(outcome);
  }
  await ensureOpenRound(now);
}

/** Public view of a round. The server seed stays secret until the draw. */
export function serializeRound(round: {
  id: string; number: number; status: string; ticketPrice: bigint; seedAmount: bigint; pot: bigint; rakeBps: number; totalTickets: number;
  opensAt: Date; closesAt: Date; serverSeedHash: string; serverSeed: string; drawnAt: Date | null; winningTicket: number | null; payout: bigint | null;
  winner?: { id: string; username: string; displayName: string | null; avatar: string | null } | null;
}) {
  const revealed = round.status !== "OPEN";
  return {
    id: round.id,
    number: round.number,
    status: round.status,
    ticketPrice: round.ticketPrice.toString(),
    seedAmount: round.seedAmount.toString(),
    pot: round.pot.toString(),
    projectedPayout: payoutFor(round.pot, round.rakeBps).toString(),
    rakeBps: round.rakeBps,
    totalTickets: round.totalTickets,
    opensAt: round.opensAt,
    closesAt: round.closesAt,
    serverSeedHash: round.serverSeedHash,
    serverSeed: revealed ? round.serverSeed : null,
    drawnAt: round.drawnAt,
    winningTicket: round.winningTicket,
    payout: round.payout?.toString() ?? null,
    winner: round.winner ?? null,
  };
}
