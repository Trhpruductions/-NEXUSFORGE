import { prisma } from "./prisma.js";
import { EconomyAuthority } from "./economy-authority.js";

/** Coin rewards that keep a new account moving: welcome bonus, daily claim, achievement payouts. */
export const WELCOME_BONUS = 1000n;
export const DAILY_BASE = 250n;
export const DAILY_STREAK_STEP = 25n;
export const DAILY_STREAK_CAP = 30;
export const ACHIEVEMENT_REWARD = 100n;

function utcDay(date: Date) {
  return Math.floor(date.getTime() / 86_400_000);
}

export function dailyAmountFor(streak: number) {
  return DAILY_BASE + DAILY_STREAK_STEP * BigInt(Math.min(streak, DAILY_STREAK_CAP));
}

export async function dailyStatus(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastDailyClaimAt: true, dailyStreak: true } });
  const today = utcDay(new Date());
  const lastDay = user?.lastDailyClaimAt ? utcDay(user.lastDailyClaimAt) : null;
  const claimedToday = lastDay === today;
  // A streak continues only if yesterday was claimed.
  const streak = lastDay === today || lastDay === today - 1 ? user?.dailyStreak ?? 0 : 0;
  const nextStreak = claimedToday ? streak : streak + 1;
  const nextResetAt = new Date((today + 1) * 86_400_000);
  return { claimedToday, streak, nextAmount: dailyAmountFor(nextStreak), nextResetAt, lastClaimAt: user?.lastDailyClaimAt ?? null };
}

export async function claimDaily(userId: string) {
  const status = await dailyStatus(userId);
  if (status.claimedToday) return { ok: false as const, status };
  const streak = status.streak + 1;
  const amount = dailyAmountFor(streak);
  await prisma.user.update({ where: { id: userId }, data: { lastDailyClaimAt: new Date(), dailyStreak: streak } });
  await EconomyAuthority.adjustBalance({ userId, amount, currencyType: "NC", reason: `Daily reward (day ${streak})`, referenceId: `daily:${utcDay(new Date())}` });
  return { ok: true as const, amount, streak, status: await dailyStatus(userId) };
}

export async function grantWelcomeBonus(userId: string) {
  await EconomyAuthority.adjustBalance({ userId, amount: WELCOME_BONUS, currencyType: "NC", reason: "Welcome to Vexora", referenceId: `welcome:${userId}` });
}

export async function grantAchievementReward(userId: string, medalKey: string) {
  await EconomyAuthority.adjustBalance({ userId, amount: ACHIEVEMENT_REWARD, currencyType: "NC", reason: `Achievement: ${medalKey}`, referenceId: `achievement:${medalKey}` });
}
