import { prisma } from "./prisma.js";
import { cheapestTierWith, limitsFor, PLANS, upgradeRequired } from "./plans.js";

/** Plan limits for a user id (one small query). */
export async function limitsForUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { premium: true, premiumTier: true } });
  return limitsFor(user ?? { premium: false, premiumTier: "NONE" });
}

/**
 * Message length check shared by channels and DMs (send and edit). Only messages longer
 * than the free limit cost a lookup. Returns a 402 body, or null when it's allowed.
 */
export async function messageLengthProblem(userId: string, content: string) {
  if (content.length <= PLANS.NONE.messageLength) return null;
  const limits = await limitsForUser(userId);
  if (content.length <= limits.messageLength) return null;
  return upgradeRequired(
    `Messages can be up to ${limits.messageLength.toLocaleString()} characters on your plan. Core+ raises it to ${PLANS.CORE.messageLength.toLocaleString()}.`,
    "MESSAGE_LENGTH",
    cheapestTierWith((plan) => plan.messageLength >= content.length),
  );
}

/** Joining or creating one more server. Returns a 402 body, or null when it's allowed. */
export async function serverLimitProblem(userId: string) {
  const [limits, count] = await Promise.all([limitsForUser(userId), prisma.forgeMember.count({ where: { userId } })]);
  if (count < limits.maxServers) return null;
  return upgradeRequired(
    `You're in ${count} servers, the most your plan allows. Leave one, or upgrade to join more.`,
    "SERVER_LIMIT",
    cheapestTierWith((plan) => plan.maxServers > count),
  );
}
