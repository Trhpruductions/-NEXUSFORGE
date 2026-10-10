import type { Prisma } from "@prisma/client";

// An event only flips to COMPLETED when a tournament champion is recorded, so an
// abandoned tournament would otherwise stay "LIVE" forever. Treat a LIVE event as
// running only until its endsAt, or for this long after it started when it has none.
export const LIVE_EVENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** LIVE events that are actually still running at `now`. */
export function runningLiveEventWhere(now: Date): Prisma.EventWhereInput {
  return {
    status: "LIVE",
    OR: [
      { endsAt: { gt: now } },
      { endsAt: null, startsAt: { gte: new Date(now.getTime() - LIVE_EVENT_MAX_AGE_MS) } },
    ],
  };
}

/** LIVE events whose time has passed without anyone completing them. */
export function staleLiveEventWhere(now: Date): Prisma.EventWhereInput {
  return {
    status: "LIVE",
    OR: [
      { endsAt: { lte: now } },
      { endsAt: null, startsAt: { lt: new Date(now.getTime() - LIVE_EVENT_MAX_AGE_MS) } },
    ],
  };
}
