import { Prisma } from "@prisma/client";
import { EconomyAuthority } from "./economy-authority.js";
import { transferInReference, transferOutReference } from "./economy-references.js";
import { prisma } from "./prisma.js";

// Player-to-player Vexora Coin (NC) transfers.
//
// Coins can only be earned in-app (they are never sold or cashed out), so the limits
// below exist to stop farm accounts funnelling coins into one account, not to protect
// money. Keep them conservative; raising them is a product decision.
export const TRANSFER_MIN = 10n;
export const TRANSFER_MAX = 50_000n;
export const TRANSFER_DAILY_OUT_CAP = 100_000n;
/** Brand-new accounts cannot send, which takes most of the value out of throwaway farms. */
export const TRANSFER_MIN_ACCOUNT_AGE_MS = 24 * 60 * 60 * 1000;

export type TransferErrorCode =
  | "SELF"
  | "RECIPIENT_NOT_FOUND"
  | "AMOUNT_RANGE"
  | "ACCOUNT_TOO_NEW"
  | "DAILY_CAP"
  | "DUPLICATE";

export class TransferError extends Error {
  constructor(readonly code: TransferErrorCode, message: string) {
    super(message);
    this.name = "TransferError";
  }
}

function startOfUtcDay(now: Date) {
  return new Date(Math.floor(now.getTime() / 86_400_000) * 86_400_000);
}

/** Coins this user has already sent today (UTC). */
export async function sentToday(userId: string, now = new Date(), client: Prisma.TransactionClient = prisma) {
  const result = await client.economyTransaction.aggregate({
    where: { userId, type: "TRANSFER_OUT", timestamp: { gte: startOfUtcDay(now) } },
    _sum: { amount: true },
  });
  // Outgoing rows are negative.
  return -(result._sum.amount ?? 0n);
}

export async function transferCoins(params: {
  senderId: string;
  recipientUsername: string;
  amount: bigint;
  note?: string;
  idempotencyKey: string;
}) {
  const { senderId, amount, idempotencyKey } = params;
  const note = params.note?.trim() || undefined;

  if (amount < TRANSFER_MIN || amount > TRANSFER_MAX) {
    throw new TransferError("AMOUNT_RANGE", `You can send between ${TRANSFER_MIN} and ${TRANSFER_MAX.toLocaleString("en-US")} coins at a time.`);
  }

  const [sender, recipient] = await Promise.all([
    prisma.user.findUnique({ where: { id: senderId }, select: { id: true, username: true, displayName: true, createdAt: true } }),
    prisma.user.findFirst({
      where: { username: { equals: params.recipientUsername.trim().replace(/^@/, ""), mode: "insensitive" } },
      select: { id: true, username: true, displayName: true },
    }),
  ]);
  if (!sender) throw new TransferError("RECIPIENT_NOT_FOUND", "Your account could not be found.");
  if (!recipient) throw new TransferError("RECIPIENT_NOT_FOUND", "No player with that username.");
  if (recipient.id === sender.id) throw new TransferError("SELF", "You can't send coins to yourself.");
  if (Date.now() - sender.createdAt.getTime() < TRANSFER_MIN_ACCOUNT_AGE_MS) {
    throw new TransferError("ACCOUNT_TOO_NEW", "New accounts can send coins after their first day.");
  }

  const shared = { note, idempotencyKey, senderId: sender.id, recipientId: recipient.id };

  try {
    const senderAccount = await EconomyAuthority.serializable(async (tx, retryCount) => {
      // Checked inside the transaction so two sends racing each other can't both
      // squeeze under the cap.
      const already = await sentToday(sender.id, new Date(), tx);
      if (already + amount > TRANSFER_DAILY_OUT_CAP) {
        const left = TRANSFER_DAILY_OUT_CAP - already;
        throw new TransferError(
          "DAILY_CAP",
          left > 0n ? `Daily sending limit reached. You can send ${left.toLocaleString("en-US")} more today.` : "Daily sending limit reached. It resets at 00:00 UTC.",
        );
      }

      const out = await EconomyAuthority.applyChange(tx, {
        userId: sender.id,
        amount: -amount,
        currencyType: "NC",
        type: "TRANSFER_OUT",
        reason: `Sent to @${recipient.username}`,
        referenceId: transferOutReference(sender.id, idempotencyKey),
        metadata: { ...shared, counterpartyUsername: recipient.username },
      }, retryCount);
      await EconomyAuthority.applyChange(tx, {
        userId: recipient.id,
        amount,
        currencyType: "NC",
        type: "TRANSFER_IN",
        reason: `Received from @${sender.username}`,
        referenceId: transferInReference(recipient.id, sender.id, idempotencyKey),
        metadata: { ...shared, counterpartyUsername: sender.username },
      }, retryCount);
      return out;
    });

    return { balance: senderAccount.balance as bigint, sender, recipient, amount, note };
  } catch (error) {
    // The unique referenceId is the double-send guard.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new TransferError("DUPLICATE", "That transfer was already sent.");
    }
    throw error;
  }
}
