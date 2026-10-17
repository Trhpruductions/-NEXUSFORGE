// Quiet hours: a daily window, in the user's own time zone, when notifications still land
// in the inbox but don't push to devices or play a sound.

export type QuietHours = { enabled: boolean; start: string; end: string; timeZone: string };

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeZone(zone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function minutesOf(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Minutes since local midnight in `timeZone`. */
function localMinutes(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function isQuietNow(quiet: Partial<QuietHours> | null | undefined, now = new Date()) {
  if (!quiet?.enabled || !quiet.start || !quiet.end || !HHMM.test(quiet.start) || !HHMM.test(quiet.end)) return false;
  const zone = quiet.timeZone && isValidTimeZone(quiet.timeZone) ? quiet.timeZone : "UTC";
  const current = localMinutes(now, zone);
  const start = minutesOf(quiet.start);
  const end = minutesOf(quiet.end);
  if (start === end) return false;
  // Same-day window (13:00-17:00) or one that wraps past midnight (22:00-08:00).
  return start < end ? current >= start && current < end : current >= start || current < end;
}
