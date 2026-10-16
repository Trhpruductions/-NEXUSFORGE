/** Pure rules for account suspensions and VAC bans (no database), shared by the server and its tests. */

export type SuspensionKind = "STAFF" | "VAC";
export type VacCategory = "SCAM" | "HARASSMENT" | "SPAM" | "EXPLOIT" | "OTHER";

export type ActiveSuspension = {
  id: string;
  reason: string;
  until: Date | null;
  createdAt: Date;
  kind?: SuspensionKind;
  category?: string | null;
  appealedAt?: Date | null;
};

export const SUSPENSION_REASON_MAX = 500;
export const SUSPENSION_MAX_DAYS = 3650;

export const VAC_CATEGORIES: readonly VacCategory[] = ["SCAM", "HARASSMENT", "SPAM", "EXPLOIT", "OTHER"];
export const VAC_EVIDENCE_MAX = 1000;
export const VAC_APPEAL_MIN = 10;
export const VAC_APPEAL_MAX = 1000;

/** Upheld reports (resolved by platform staff) that trigger an automatic VAC ban. */
export const VAC_AUTO_UPHELD_REPORTS = 3;
/** Upheld reports only count inside this window, and only after the account's last VAC ban. */
export const VAC_AUTO_WINDOW_DAYS = 30;
/**
 * Automatic ban length, by how many VAC bans the account already has. The last step applies from then on.
 * Automatic bans are never permanent; staff can make a ban permanent.
 */
export const VAC_AUTO_LADDER_DAYS = [1, 7, 30] as const;

export function vacAutomaticDays(priorVacBans: number): number {
  const index = Math.min(Math.max(priorVacBans, 0), VAC_AUTO_LADDER_DAYS.length - 1);
  return VAC_AUTO_LADDER_DAYS[index];
}

/** Maps a message report reason to a VAC category. Unknown reasons fall back to OTHER. */
export function vacCategoryForReportReason(reason: string): VacCategory {
  switch (reason) {
    case "SCAM":
      return "SCAM";
    case "SPAM":
      return "SPAM";
    case "HARASSMENT":
    case "HATE":
    case "SEXUAL":
    case "VIOLENCE":
    case "SELF_HARM":
      return "HARASSMENT";
    default:
      return "OTHER";
  }
}

/** The category that appears most often. A tie goes to the earlier category in VAC_CATEGORIES. */
export function dominantVacCategory(categories: readonly VacCategory[]): VacCategory {
  if (categories.length === 0) return "OTHER";
  let best: VacCategory = "OTHER";
  let bestCount = -1;
  for (const category of VAC_CATEGORIES) {
    const count = categories.filter((item) => item === category).length;
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}

/** A suspension is in force until it's lifted or (for a timed one) its end passes. */
export function isSuspensionActive(entry: { until: Date | null; liftedAt: Date | null }, now = new Date()) {
  if (entry.liftedAt) return false;
  return entry.until === null || entry.until.getTime() > now.getTime();
}

/** When a suspension of `days` days (null = until lifted) starting now would end. */
export function suspensionEnd(days: number | null, now = new Date()) {
  return days === null ? null : new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * The public shape sent to the suspended person and to staff. Staff suspensions keep their original three fields.
 * VAC bans add the kind, the category and whether an appeal was sent.
 */
export function describeSuspension(entry: ActiveSuspension): {
  reason: string;
  until: string | null;
  since: string;
  kind?: "VAC";
  category?: string | null;
  appealed?: boolean;
} {
  const base = {
    reason: entry.reason,
    until: entry.until ? entry.until.toISOString() : null,
    since: entry.createdAt.toISOString(),
  };
  if (entry.kind !== "VAC") return base;
  return { ...base, kind: "VAC" as const, category: entry.category ?? null, appealed: Boolean(entry.appealedAt) };
}

export function suspendedMessage(entry: ActiveSuspension) {
  if (entry.kind === "VAC") {
    const when = entry.until ? `until ${entry.until.toUTCString()}` : "until Nexus Forge staff review it";
    return `Your account is banned from Nexus Forge Gaming ${when}. You can appeal this ban.`;
  }
  return entry.until ? `This account is suspended until ${entry.until.toUTCString()}.` : "This account is suspended.";
}

/** The JSON error body for a request from a suspended or banned account. */
export function suspendedResponse(entry: ActiveSuspension) {
  return { error: suspendedMessage(entry), suspended: describeSuspension(entry) };
}
