/**
 * Platform-level account suspensions, applied by Vexora staff (not forge moderators).
 *
 * Each suspension is a row in AccountSuspension (kept as history for appeals). A
 * suspended account can't sign in, refresh its session, call the API or open a live
 * connection until the suspension ends or is lifted. Active suspensions are also kept in
 * memory so every request can be checked without a database round trip; this process is
 * the only API server, and every change goes through suspendAccount / liftSuspension.
 */
import { prisma } from "./prisma.js";
import { getIo } from "./realtime.js";
import { sendEmail } from "./delivery.js";
import { describeSuspension, isSuspensionActive, suspensionEnd, type ActiveSuspension } from "./account-suspension-rules.js";

export * from "./account-suspension-rules.js";

const active = new Map<string, ActiveSuspension>();

export async function loadActiveSuspensions() {
  const rows = await prisma.accountSuspension.findMany({
    where: { liftedAt: null, OR: [{ until: null }, { until: { gt: new Date() } }] },
    orderBy: { createdAt: "asc" },
  });
  active.clear();
  for (const row of rows) active.set(row.userId, { id: row.id, reason: row.reason, until: row.until, createdAt: row.createdAt });
}

/** Fast check used on every request and socket connection. */
export function cachedSuspension(userId: string): ActiveSuspension | null {
  const entry = active.get(userId);
  if (!entry) return null;
  if (!isSuspensionActive({ until: entry.until, liftedAt: null })) {
    active.delete(userId);
    return null;
  }
  return entry;
}

/** Authoritative check straight from the database (sign-in and session refresh). */
export async function currentSuspension(userId: string): Promise<ActiveSuspension | null> {
  const row = await prisma.accountSuspension.findFirst({
    where: { userId, liftedAt: null, OR: [{ until: null }, { until: { gt: new Date() } }] },
    orderBy: { createdAt: "desc" },
  });
  if (!row) {
    active.delete(userId);
    return null;
  }
  const entry = { id: row.id, reason: row.reason, until: row.until, createdAt: row.createdAt };
  active.set(userId, entry);
  return entry;
}

export async function suspendAccount(input: { actorId: string; userId: string; reason: string; days: number | null }) {
  const now = new Date();
  const until = suspensionEnd(input.days, now);
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true, username: true, deletedAt: true } });
  if (!user || user.deletedAt) return null;

  const row = await prisma.$transaction(async (tx) => {
    // A new suspension replaces any current one, so there's only ever one in force.
    await tx.accountSuspension.updateMany({
      where: { userId: input.userId, liftedAt: null },
      data: { liftedAt: now, liftedById: input.actorId, liftNote: "Replaced by a new suspension" },
    });
    const created = await tx.accountSuspension.create({
      data: { userId: input.userId, actorId: input.actorId, reason: input.reason, until },
    });
    // Sign them out everywhere.
    await tx.refreshToken.updateMany({ where: { userId: input.userId, revokedAt: null }, data: { revokedAt: now } });
    return created;
  });
  const entry = { id: row.id, reason: row.reason, until: row.until, createdAt: row.createdAt };
  active.set(input.userId, entry);

  // Drop their live connections (voice included); the app shows the suspension screen.
  try {
    const io = getIo();
    io.to(`user:${input.userId}`).emit("account:suspended", describeSuspension(entry));
    setTimeout(() => io.in(`user:${input.userId}`).disconnectSockets(true), 250);
  } catch {
    /* realtime not running (tests) */
  }

  const ends = until ? `It ends on ${until.toUTCString()}.` : "It lasts until Vexora staff lift it.";
  void sendEmail(
    user.email,
    "Your Vexora Gaming account has been suspended",
    `Hi ${user.username},\n\nVexora staff have suspended your account.\n\nReason: ${input.reason}\n\n${ends}\n\nWhile it is suspended you can't sign in or use the app. If you think this was a mistake, you can appeal: the Appeals Policy in the Legal Center explains how.\n\nVexora Gaming`,
  ).catch((error) => console.error("[SUSPENSION] email failed", error));

  return entry;
}

export async function liftSuspension(input: { actorId: string; userId: string; note?: string | null }) {
  const now = new Date();
  const result = await prisma.accountSuspension.updateMany({
    where: { userId: input.userId, liftedAt: null },
    data: { liftedAt: now, liftedById: input.actorId, liftNote: input.note ?? null },
  });
  active.delete(input.userId);
  if (!result.count) return false;

  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true, username: true } });
  if (user) {
    void sendEmail(
      user.email,
      "Your Vexora Gaming account is no longer suspended",
      `Hi ${user.username},\n\nThe suspension on your Vexora account has been lifted, and you can sign in again.\n\nVexora Gaming`,
    ).catch((error) => console.error("[SUSPENSION] email failed", error));
  }
  return true;
}

export function resetSuspensionCacheForTests() {
  active.clear();
}
