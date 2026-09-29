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

/** Decommissioning a given rig can only ever refund once. */
export function rigDecommissionReference(userId: string, rigId: string): string {
  return reference("rig-decommission", userId, rigId);
}
