/**
 * Housekeeping: deletes rows that are no longer useful so tables don't grow forever.
 * Runs shortly after start and then every 6 hours. Each step is independent; one failing
 * doesn't stop the others.
 *
 * Retention:
 * - sign-in and verification codes, OAuth codes: 1 day after they expire
 * - session tokens: 1 day after expiry, or 7 days after being revoked (every refresh
 *   revokes the old token, so these pile up fast)
 * - notifications: read ones after 90 days, unread ones after 1 year
 * - admin audit log and activity log: 1 year
 */
import { prisma } from "./prisma.js";

const DAY = 24 * 60 * 60 * 1000;
const EVERY_MS = 6 * 60 * 60 * 1000;

function ago(days: number) {
  return new Date(Date.now() - days * DAY);
}

export async function runCleanup() {
  const steps: Array<[string, () => Promise<{ count: number }>]> = [
    ["verification codes", () => prisma.verificationCode.deleteMany({ where: { expiresAt: { lt: ago(1) } } })],
    ["OAuth codes", () => prisma.oAuthAuthorizationCode.deleteMany({ where: { expiresAt: { lt: ago(1) } } })],
    ["session tokens", () => prisma.refreshToken.deleteMany({ where: { OR: [{ expiresAt: { lt: ago(1) } }, { revokedAt: { lt: ago(7) } }] } })],
    ["read notifications", () => prisma.notification.deleteMany({ where: { read: true, createdAt: { lt: ago(90) } } })],
    ["old notifications", () => prisma.notification.deleteMany({ where: { createdAt: { lt: ago(365) } } })],
    ["audit log", () => prisma.auditLog.deleteMany({ where: { createdAt: { lt: ago(365) } } })],
    ["activity log", () => prisma.userActivity.deleteMany({ where: { createdAt: { lt: ago(365) } } })],
  ];
  const removed: Record<string, number> = {};
  for (const [name, step] of steps) {
    try {
      const result = await step();
      if (result.count) removed[name] = result.count;
    } catch (error) {
      console.error(`[cleanup] ${name} failed:`, error instanceof Error ? error.message : error);
    }
  }
  if (Object.keys(removed).length) console.log("[cleanup] removed", removed);
  return removed;
}

let timer: NodeJS.Timeout | null = null;

export function startCleanup() {
  if (timer) return;
  setTimeout(() => void runCleanup(), 60_000).unref();
  timer = setInterval(() => void runCleanup(), EVERY_MS);
  timer.unref();
}
