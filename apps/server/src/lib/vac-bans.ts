/**
 * The VAC ban system for Nexus Forge Gaming.
 *
 * A VAC ban is a platform-level ban stored as an AccountSuspension with kind VAC, so it is enforced exactly like a
 * staff suspension (sign-in, sessions, API, live connections). This module adds:
 *  - automatic escalation: when platform staff have upheld enough reports against an account, the account gets a
 *    VAC ban that staff must confirm (1 day, then 7 days, then 30 days; automatic bans are never permanent);
 *  - a staff queue to confirm or lift bans;
 *  - an appeal the banned person can send without signing in, using their password.
 *
 * Detection: Nexus Forge has no client-side anti-cheat. VAC bans come from decisions that staff have already made on
 * reports. Forge moderators and forge owners can't trigger them, so one forge can't ban someone across the platform.
 */
import { prisma } from "./prisma.js";
import { currentSuspension, suspendAccount } from "./account-suspension.js";
import {
  dominantVacCategory,
  vacAutomaticDays,
  vacCategoryForReportReason,
  VAC_AUTO_UPHELD_REPORTS,
  VAC_AUTO_WINDOW_DAYS,
  VAC_APPEAL_MAX,
  VAC_APPEAL_MIN,
  type VacCategory,
} from "./account-suspension-rules.js";
import { resolveEffectiveRole, hasModeratorAccess, type AppRole } from "./app-roles.js";
import { comparePassword } from "./password.js";
import { sendEmail } from "./delivery.js";
import { env } from "../config/env.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export type IssueVacInput = {
  actorId: string;
  userId: string;
  category: VacCategory;
  days: number | null;
  reason: string;
  evidence: string | null;
  automatic: boolean;
};

/** Issues a VAC ban. Automatic bans wait for a staff decision in the review queue. */
export async function issueVacBan(input: IssueVacInput) {
  return suspendAccount({
    actorId: input.actorId,
    userId: input.userId,
    reason: input.reason,
    days: input.days,
    kind: "VAC",
    source: input.automatic ? "AUTO" : "STAFF",
    category: input.category,
    evidence: input.evidence,
    needsReview: input.automatic,
  });
}

/** Staff accounts (any role above the basic user) are never banned automatically. */
export function isStaffAccount(user: { appRole: string | null; isAdmin: boolean }) {
  return resolveEffectiveRole(user.appRole as AppRole | null, user.isAdmin) !== "USER";
}

/**
 * Checks whether an account has earned an automatic VAC ban, and issues one if so. Called after platform staff
 * resolve a report against a message or DM sent by this account.
 */
export async function considerAutomaticBan(input: { userId: string; triggeredById: string; now?: Date }) {
  const now = input.now ?? new Date();
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { appRole: true, isAdmin: true, deletedAt: true },
  });
  if (!user || user.deletedAt || isStaffAccount(user)) return null;
  if (await currentSuspension(input.userId)) return null;

  // Each ban needs fresh evidence: only reports handled after the account's last VAC ban, inside the window, count.
  const lastVac = await prisma.accountSuspension.findFirst({
    where: { userId: input.userId, kind: "VAC" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const windowStart = new Date(now.getTime() - VAC_AUTO_WINDOW_DAYS * DAY_MS);
  const since = lastVac && lastVac.createdAt > windowStart ? lastVac.createdAt : windowStart;

  const reports = await prisma.messageReport.findMany({
    where: { authorId: input.userId, status: "RESOLVED", handledAt: { gte: since } },
    select: { id: true, reason: true, handledById: true },
    orderBy: { handledAt: "asc" },
    take: 200,
  });
  const handlerIds = [...new Set(reports.map((report) => report.handledById).filter((id): id is string => Boolean(id)))];
  const handlers = handlerIds.length
    ? await prisma.user.findMany({ where: { id: { in: handlerIds } }, select: { id: true, appRole: true, isAdmin: true } })
    : [];
  const platformStaff = new Set(handlers.filter((handler) => hasModeratorAccess(handler.appRole as AppRole | null, handler.isAdmin)).map((handler) => handler.id));
  const upheld = reports.filter((report) => report.handledById && platformStaff.has(report.handledById));
  if (upheld.length < VAC_AUTO_UPHELD_REPORTS) return null;

  const priorVacBans = await prisma.accountSuspension.count({ where: { userId: input.userId, kind: "VAC" } });
  const days = vacAutomaticDays(priorVacBans);
  const category = dominantVacCategory(upheld.map((report) => vacCategoryForReportReason(report.reason)));
  const ids = upheld.slice(0, 10).map((report) => report.id).join(", ");
  const evidence = `${upheld.length} reports upheld by staff since ${since.toISOString()}. Report IDs: ${ids}. Automatic ban ${priorVacBans + 1}, ${days} days.`;
  const reason = `Automatic ban: ${upheld.length} reports upheld by staff (${category.toLowerCase()}).`;

  return issueVacBan({
    actorId: input.triggeredById,
    userId: input.userId,
    category,
    days,
    reason,
    evidence,
    automatic: true,
  });
}

/** Active VAC bans for the staff queue. Bans waiting for review come first. */
export async function listVacBans() {
  return prisma.accountSuspension.findMany({
    where: { kind: "VAC", liftedAt: null, OR: [{ until: null }, { until: { gt: new Date() } }] },
    orderBy: [{ needsReview: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      userId: true,
      reason: true,
      category: true,
      source: true,
      evidence: true,
      until: true,
      createdAt: true,
      needsReview: true,
      appealedAt: true,
      appealNote: true,
      user: { select: { username: true } },
    },
  });
}

/** Staff agree with an automatic ban. Returns false if the ban is not active. */
export async function confirmVacBan(banId: string) {
  const result = await prisma.accountSuspension.updateMany({
    where: { id: banId, kind: "VAC", liftedAt: null },
    data: { needsReview: false },
  });
  return result.count > 0;
}

/** The user a VAC ban applies to, for role checks. Null if the ban is not an active VAC ban. */
export async function vacBanTargetUserId(banId: string) {
  const row = await prisma.accountSuspension.findFirst({
    where: { id: banId, kind: "VAC", liftedAt: null },
    select: { userId: true },
  });
  return row?.userId ?? null;
}

export const APPEAL_REPLY = "If this account has a ban, your appeal has been sent to our team. We reply by email.";

/**
 * A banned person's appeal, sent without signing in. The reply is the same whatever happens, so it never shows
 * whether an account exists or is banned. An appeal can be sent once per ban.
 */
export async function submitVacAppeal(input: { email: string; password: string; note: string }) {
  const note = input.note.trim();
  if (note.length < VAC_APPEAL_MIN || note.length > VAC_APPEAL_MAX) return { sent: false };
  const user = await prisma.user.findUnique({
    where: { email: input.email.trim().toLowerCase() },
    select: { id: true, username: true, password: true, deletedAt: true },
  });
  if (!user || user.deletedAt) return { sent: false };
  if (!(await comparePassword(input.password, user.password))) return { sent: false };

  const ban = await currentSuspension(user.id);
  if (!ban || ban.kind !== "VAC" || ban.appealedAt) return { sent: false };

  await prisma.accountSuspension.update({ where: { id: ban.id }, data: { appealedAt: new Date(), appealNote: note } });
  if (env.SUPPORT_EMAIL) {
    void sendEmail(
      env.SUPPORT_EMAIL,
      `VAC ban appeal from ${user.username}`,
      `User ID: ${user.id}\nBan ID: ${ban.id}\nCategory: ${ban.category ?? "unknown"}\n\nAppeal:\n${note}\n`,
    ).catch((error) => console.error("[VAC] appeal email failed", error));
  }
  return { sent: true };
}
