/**
 * Prisma-backed storage for the email pipeline: delivery records, the duplicate check and the
 * optional-mail opt-ins kept in User.preferences.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import type { EmailRecordStore } from "./email-pipeline.js";
import { isOptedIn, withOptIn, type OptionalPreferenceKey } from "./email-policy.js";

export const prismaEmailStore: EmailRecordStore = {
  async create(row) {
    const created = await prisma.emailMessage.create({ data: row, select: { id: true } });
    return created.id;
  },

  async transition(id, from, to, patch = {}) {
    // Conditional on the current status, so two writers cannot both claim the same move.
    const result = await prisma.emailMessage.updateMany({
      where: { id, status: from },
      data: { status: to, ...patch },
    });
    return result.count === 1;
  },

  async findByProviderMessageId(messageId) {
    return prisma.emailMessage.findFirst({
      where: { providerMessageId: messageId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    });
  },

  async latestSendAt({ userId, kind, subject, since }) {
    const row = await prisma.emailMessage.findFirst({
      where: { userId, kind, subject, createdAt: { gte: since }, status: { not: "FAILED" } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    return row?.createdAt ?? null;
  },
};

/** True only when the account exists, is not deleted, and has explicitly opted in. */
export async function userOptedIn(userId: string, key: OptionalPreferenceKey): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true, deletedAt: true } });
  return Boolean(user && !user.deletedAt && isOptedIn(user.preferences, key));
}

/** Sets one optional-mail flag. Returns false when the account does not exist (the caller still answers politely). */
export async function setUserOptIn(userId: string, key: OptionalPreferenceKey, value: boolean): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true, deletedAt: true } });
  if (!user || user.deletedAt) return false;
  await prisma.user.update({
    where: { id: userId },
    data: { preferences: withOptIn(user.preferences, key, value) as Prisma.InputJsonObject },
  });
  return true;
}
