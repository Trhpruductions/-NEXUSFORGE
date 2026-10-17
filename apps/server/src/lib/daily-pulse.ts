import fs from "node:fs";
import path from "node:path";
import { prisma } from "./prisma.js";
import { env } from "../config/env.js";
import { reportDiscordHealth } from "./discord-bot.js";
import { composePulse, type PulseStats } from "./daily-pulse-format.js";

/**
 * Daily beta pulse: one Discord post every morning (DISCORD_PULSE_HOUR, default 9 local time)
 * with what happened in the last 24 hours and what needs a look. Posted to #app-health.
 *
 * A marker file (var/daily-pulse.json) remembers the last day posted, so a restart never
 * double-posts, and a day missed because the server was down is posted as soon as it's back.
 */

const MARKER_FILE = path.resolve(process.cwd(), "var", "daily-pulse.json");

export async function collectPulseStats(since: Date): Promise<PulseStats> {
  const [
    newUsers,
    newVerified,
    totalUsers,
    activeUsers,
    messages,
    directMessages,
    newForges,
    totalForges,
    payments,
    paidActive,
    lifetime,
    problemNew,
    problemOpen,
    ticketsNew,
    ticketsWaiting,
    errors,
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { createdAt: { gte: since }, emailVerified: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { lastSeenAt: { gte: since } } }),
    prisma.message.count({ where: { createdAt: { gte: since } } }),
    prisma.directMessage.count({ where: { createdAt: { gte: since } } }),
    prisma.forge.count({ where: { createdAt: { gte: since } } }),
    prisma.forge.count(),
    prisma.paymentTransaction.aggregate({ where: { createdAt: { gte: since }, status: "SUCCEEDED" }, _count: { _all: true }, _sum: { amountCents: true } }),
    prisma.billingSubscription.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { lifetimeMember: true } }),
    prisma.problemReport.count({ where: { createdAt: { gte: since } } }),
    prisma.problemReport.count({ where: { status: "OPEN" } }),
    prisma.supportTicket.count({ where: { createdAt: { gte: since } } }),
    prisma.supportTicket.count({ where: { status: "OPEN" } }),
    prisma.errorEvent.findMany({ where: { lastSeenAt: { gte: since } }, select: { count: true } }),
  ]);

  return {
    newUsers,
    newVerified,
    totalUsers,
    activeUsers,
    messages,
    directMessages,
    newForges,
    totalForges,
    payments: payments._count._all,
    paymentCents: payments._sum.amountCents ?? 0,
    paidActive,
    lifetime,
    problemNew,
    problemOpen,
    ticketsNew,
    ticketsWaiting,
    errorGroups: errors.length,
    errorHits: errors.reduce((sum, row) => sum + row.count, 0),
  };
}

function readMarker(): { lastDate?: string } {
  try {
    return JSON.parse(fs.readFileSync(MARKER_FILE, "utf8")) as { lastDate?: string };
  } catch {
    return {};
  }
}

function writeMarker(lastDate: string) {
  try {
    fs.mkdirSync(path.dirname(MARKER_FILE), { recursive: true });
    fs.writeFileSync(MARKER_FILE, JSON.stringify({ lastDate }));
  } catch (error) {
    console.warn("[pulse] couldn't save the marker file:", error instanceof Error ? error.message : String(error));
  }
}

/** Local calendar day, e.g. 2026-10-14 (the PC's time zone). */
function dayKey(date = new Date()) {
  return date.toLocaleDateString("en-CA");
}

function pulseHour() {
  const hour = Number(process.env.DISCORD_PULSE_HOUR ?? 9);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 9;
}

export async function postDailyPulse(): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stats = await collectPulseStats(since);
  const body = composePulse(stats, env.APP_WEB_URL);
  console.log(`[pulse] ${body.replace(/\n/g, " | ")}`);
  await reportDiscordHealth(`[pulse] ${body}`);
  writeMarker(dayKey());
}

let timer: NodeJS.Timeout | null = null;

function scheduleNext() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(pulseHour(), 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  timer = setTimeout(() => {
    void postDailyPulse()
      .catch((error) => console.error("[pulse] failed:", error instanceof Error ? error.message : String(error)))
      .finally(scheduleNext);
  }, next.getTime() - now.getTime());
  timer.unref();
}

/** Starts the schedule; posts today's pulse first if it's past the hour and hasn't gone out. */
export function startDailyPulse() {
  if (String(process.env.DISCORD_PULSE_ENABLED ?? "true").toLowerCase() === "false") return;
  const dueToday = new Date();
  dueToday.setHours(pulseHour(), 0, 0, 0);
  if (new Date() >= dueToday && readMarker().lastDate !== dayKey()) {
    setTimeout(() => void postDailyPulse().catch((error) => console.error("[pulse] failed:", error instanceof Error ? error.message : String(error))), 90_000).unref();
  }
  scheduleNext();
}

export function stopDailyPulse() {
  if (timer) clearTimeout(timer);
  timer = null;
}
