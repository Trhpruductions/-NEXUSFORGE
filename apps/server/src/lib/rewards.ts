import { prisma } from "./prisma.js";
import { EconomyAuthority } from "./economy-authority.js";
import { achievementReference, dailyClaimReference, welcomeBonusReference } from "./economy-references.js";

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

/**
 * Claims today's reward. Marking the day claimed and paying out happen in one transaction, and the
 * mark is a conditional write ("only if not claimed today"), so two claims sent at the same moment
 * can't both pay. Before, the status was read first and the payout and the mark were separate
 * writes: a double click reached the payout twice and only the unique ledger reference stopped
 * the second one, as a server error. A failed payout now also rolls back the mark, so the claim
 * stays available.
 */
export async function claimDaily(userId: string) {
  const now = new Date();
  const today = utcDay(now);
  const startOfToday = new Date(today * 86_400_000);
  let paid: { amount: bigint; streak: number } | null = null;
  try {
    paid = await EconomyAuthority.serializable(async (tx, retryCount) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { lastDailyClaimAt: true, dailyStreak: true } });
      if (!user) return null;
      const lastDay = user.lastDailyClaimAt ? utcDay(user.lastDailyClaimAt) : null;
      if (lastDay === today) return null;
      // A streak continues only if yesterday was claimed.
      const streak = (lastDay === today - 1 ? user.dailyStreak : 0) + 1;
      const claimed = await tx.user.updateMany({
        where: { id: userId, OR: [{ lastDailyClaimAt: null }, { lastDailyClaimAt: { lt: startOfToday } }] },
        data: { lastDailyClaimAt: now, dailyStreak: streak },
      });
      if (claimed.count !== 1) return null;
      const amount = dailyAmountFor(streak);
      await EconomyAuthority.applyChange(tx, {
        userId,
        amount,
        currencyType: "NC",
        reason: `Daily reward (day ${streak})`,
        // Still one per account per UTC day: the database's last line of defence.
        referenceId: dailyClaimReference(userId, today),
      }, retryCount);
      return { amount, streak };
    });
  } catch (error) {
    // The ledger reference already exists: today was paid by another request. Not an error.
    if ((error as { code?: string })?.code !== "P2002") throw error;
  }
  const status = await dailyStatus(userId);
  return paid ? { ok: true as const, amount: paid.amount, streak: paid.streak, status } : { ok: false as const, status };
}

export async function grantWelcomeBonus(userId: string) {
  await EconomyAuthority.adjustBalance({ userId, amount: WELCOME_BONUS, currencyType: "NC", reason: "Welcome to Nexus Forge", referenceId: welcomeBonusReference(userId) });
}

export async function grantAchievementReward(userId: string, medalKey: string) {
  await EconomyAuthority.adjustBalance({ userId, amount: ACHIEVEMENT_REWARD, currencyType: "NC", reason: `Achievement: ${medalKey}`, referenceId: achievementReference(userId, medalKey) });
}
