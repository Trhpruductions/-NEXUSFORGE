/**
 * Platform-level account suspensions and VAC bans, applied by Nexus Forge staff or by the VAC escalation rules
 * (vac-bans.ts). Not applied by forge moderators.
 *
 * Each suspension is a row in AccountSuspension (kept as history for appeals). A
 * suspended or banned account can't sign in, refresh its session, call the API or open a live
 * connection until the suspension ends or is lifted. Active suspensions are also kept in
 * memory so every request can be checked without a database round trip; this process is
 * the only API server, and every change goes through suspendAccount / liftSuspension.
 */
import { prisma } from "./prisma.js";
import { getIo } from "./realtime.js";
import { sendEmail } from "./delivery.js";
import { env } from "../config/env.js";
import {
  describeSuspension,
  isSuspensionActive,
  suspensionEnd,
  type ActiveSuspension,
  type SuspensionKind,
  type VacCategory,
} from "./account-suspension-rules.js";

export * from "./account-suspension-rules.js";

const active = new Map<string, ActiveSuspension>();

type SuspensionRow = {
  id: string;
  reason: string;
  until: Date | null;
  createdAt: Date;
  kind: string;
  category: string | null;
  appealedAt: Date | null;
};

function toEntry(row: SuspensionRow): ActiveSuspension {
  return {
    id: row.id,
    reason: row.reason,
    until: row.until,
    createdAt: row.createdAt,
    kind: row.kind === "VAC" ? "VAC" : "STAFF",
    category: row.category ?? null,
    appealedAt: row.appealedAt ?? null,
  };
}

export async function loadActiveSuspensions() {
  const rows = await prisma.accountSuspension.findMany({
    where: { liftedAt: null, OR: [{ until: null }, { until: { gt: new Date() } }] },
    orderBy: { createdAt: "asc" },
  });
  active.clear();
  for (const row of rows) active.set(row.userId, toEntry(row));
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
  const entry = toEntry(row);
  active.set(userId, entry);
  return entry;
}

export type SuspendInput = {
  actorId: string;
  userId: string;
  reason: string;
  days: number | null;
  kind?: SuspensionKind;
  source?: "STAFF" | "AUTO";
  category?: VacCategory | null;
  evidence?: string | null;
  needsReview?: boolean;
};

export async function suspendAccount(input: SuspendInput) {
  const now = new Date();
  const until = suspensionEnd(input.days, now);
  const kind: SuspensionKind = input.kind ?? "STAFF";
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true, username: true, deletedAt: true } });
  if (!user || user.deletedAt) return null;

  const row = await prisma.$transaction(async (tx) => {
    // A new suspension replaces any current one, so there's only ever one in force.
    await tx.accountSuspension.updateMany({
      where: { userId: input.userId, liftedAt: null },
      data: { liftedAt: now, liftedById: input.actorId, liftNote: "Replaced by a new suspension" },
    });
    const created = await tx.accountSuspension.create({
      data: {
        userId: input.userId,
        actorId: input.actorId,
        reason: input.reason,
        until,
        kind,
        source: input.source ?? "STAFF",
        category: kind === "VAC" ? (input.category ?? "OTHER") : null,
        evidence: kind === "VAC" ? (input.evidence ?? null) : null,
        needsReview: input.needsReview ?? false,
      },
    });
    // Sign them out everywhere.
    await tx.refreshToken.updateMany({ where: { userId: input.userId, revokedAt: null }, data: { revokedAt: now } });
    return created;
  });
  const entry = toEntry(row);
  active.set(input.userId, entry);

  // Drop their live connections (voice included); the app shows the suspension or ban screen.
  try {
    const io = getIo();
    io.to(`user:${input.userId}`).emit("account:suspended", describeSuspension(entry));
    setTimeout(() => io.in(`user:${input.userId}`).disconnectSockets(true), 250);
  } catch {
    /* realtime not running (tests) */
  }

  const ends = until ? `It ends on ${until.toUTCString()}.` : "It lasts until Nexus Forge staff review it.";
  const appealUrl = `${env.APP_WEB_URL.replace(/\/+$/, "")}/suspended`;
  const { subject, body } =
    kind === "VAC"
      ? {
          subject: "Your Nexus Forge Gaming account has been banned",
          body: `Hi ${user.username},\n\nNexus Forge staff have banned your account.\n\nReason: ${input.reason}\n\n${ends}\n\nWhile the ban is in place you can't sign in or use the app. If you think this was a mistake, you can appeal at ${appealUrl}.\n\nNexus Forge Gaming`,
        }
      : {
          subject: "Your Nexus Forge Gaming account has been suspended",
          body: `Hi ${user.username},\n\nVexora staff have suspended your account.\n\nReason: ${input.reason}\n\n${ends}\n\nWhile it is suspended you can't sign in or use the app. If you think this was a mistake, you can appeal: the Appeals Policy in the Legal Center explains how.\n\nNexus Forge Gaming`,
        };
  void sendEmail(user.email, subject, body).catch((error) => console.error("[SUSPENSION] email failed", error));

  return entry;
}

export async function liftSuspension(input: { actorId: string; userId: string; note?: string | null }) {
  const now = new Date();
  const current = await prisma.accountSuspension.findFirst({ where: { userId: input.userId, liftedAt: null }, select: { kind: true } });
  const result = await prisma.accountSuspension.updateMany({
    where: { userId: input.userId, liftedAt: null },
    data: { liftedAt: now, liftedById: input.actorId, liftNote: input.note ?? null },
  });
  active.delete(input.userId);
  if (!result.count) return false;

  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true, username: true } });
  if (user) {
    const isBan = current?.kind === "VAC";
    void sendEmail(
      user.email,
      isBan ? "Your Nexus Forge Gaming ban has been lifted" : "Your Nexus Forge Gaming account is no longer suspended",
      isBan
        ? `Hi ${user.username},\n\nThe ban on your Nexus Forge account has been lifted, and you can sign in again.\n\nNexus Forge Gaming`
        : `Hi ${user.username},\n\nThe suspension on your Nexus Forge account has been lifted, and you can sign in again.\n\nNexus Forge Gaming`,
    ).catch((error) => console.error("[SUSPENSION] email failed", error));
  }
  return true;
}

export function resetSuspensionCacheForTests() {
  active.clear();
}
