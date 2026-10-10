/**
 * Reference ids for economy transactions.
 *
 * EconomyTransaction.referenceId is globally unique, which makes it a duplicate guard: a
 * second transaction carrying the same reference is rejected by the database. That only
 * works as intended when the reference identifies one payout to one person. A reference
 * built from the item or the calendar day alone collides across accounts, so the first
 * person through the door consumes it and everybody after them is refused.
 *
 * Every builder here therefore includes the user id. Add new payout kinds to this module
 * rather than inlining a template string at the call site.
 */

const SEPARATOR = ":";

function reference(kind: string, userId: string, ...parts: Array<string | number>): string {
  return [kind, userId, ...parts.map(String)].join(SEPARATOR);
}

/** One daily claim per account per UTC day. */
export function dailyClaimReference(userId: string, utcDay: number): string {
  return reference("daily", userId, utcDay);
}

/** One welcome bonus per account. */
export function welcomeBonusReference(userId: string): string {
  return reference("welcome", userId);
}

/** One payout per account per achievement. */
export function achievementReference(userId: string, medalKey: string): string {
  return reference("achievement", userId, medalKey);
}

/** One purchase per account per cosmetic; owning two of the same item is not a thing. */
export function cosmeticPurchaseReference(userId: string, itemId: string): string {
  return reference("cosmetic", userId, itemId);
}

/** Rigs are bought repeatedly, so this carries a per-purchase id rather than the tier. */
export function rigPurchaseReference(userId: string, purchaseId: string): string {
  return reference("rig-purchase", userId, purchaseId);
}

/**
 * A coin transfer writes two ledger rows, one per account. Both carry the sender's
 * idempotency key, so a retried or double-clicked send is rejected instead of paid twice.
 */
export function transferOutReference(senderId: string, idempotencyKey: string): string {
  return reference("transfer-out", senderId, idempotencyKey);
}

export function transferInReference(recipientId: string, senderId: string, idempotencyKey: string): string {
  return reference("transfer-in", recipientId, senderId, idempotencyKey);
}

/** A ticket purchase; the client's idempotency key stops a double-click buying twice. */
export function jackpotTicketReference(userId: string, roundId: string, idempotencyKey: string): string {
  return reference("jackpot-ticket", userId, roundId, idempotencyKey);
}

/** A round pays out once. */
export function jackpotWinReference(userId: string, roundId: string): string {
  return reference("jackpot-win", userId, roundId);
}

/** Each ticket purchase in a cancelled round is refunded once. */
export function jackpotRefundReference(userId: string, entryId: string): string {
  return reference("jackpot-refund", userId, entryId);
}

/** Decommissioning a given rig can only ever refund once. */
export function rigDecommissionReference(userId: string, rigId: string): string {
  return reference("rig-decommission", userId, rigId);
}
