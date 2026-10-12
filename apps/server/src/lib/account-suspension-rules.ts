/** Pure rules for account suspensions (no database), shared by the server and its tests. */

export type ActiveSuspension = { id: string; reason: string; until: Date | null; createdAt: Date };

export const SUSPENSION_REASON_MAX = 500;
export const SUSPENSION_MAX_DAYS = 3650;

/** A suspension is in force until it's lifted or (for a timed one) its end passes. */
export function isSuspensionActive(entry: { until: Date | null; liftedAt: Date | null }, now = new Date()) {
  if (entry.liftedAt) return false;
  return entry.until === null || entry.until.getTime() > now.getTime();
}

/** When a suspension of `days` days (null = until lifted) starting now would end. */
export function suspensionEnd(days: number | null, now = new Date()) {
  return days === null ? null : new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/** The public shape sent to the suspended person and to staff. */
export function describeSuspension(entry: ActiveSuspension) {
  return { reason: entry.reason, until: entry.until ? entry.until.toISOString() : null, since: entry.createdAt.toISOString() };
}

export function suspendedMessage(entry: ActiveSuspension) {
  return entry.until
    ? `This account is suspended until ${entry.until.toUTCString()}.`
    : "This account is suspended.";
}

/** The JSON error body for a request from a suspended account. */
export function suspendedResponse(entry: ActiveSuspension) {
  return { error: suspendedMessage(entry), suspended: describeSuspension(entry) };
}
