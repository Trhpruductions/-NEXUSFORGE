import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "./prisma.js";
import { hashPassword } from "./password.js";
import { sendEmail } from "./delivery.js";
import { deleteDocument } from "./age-verification.js";
import { disconnectUserSockets } from "./realtime.js";

/**
 * Account deletion, Discord-style: the user asks, every session is signed out, and the
 * account is wiped after a grace period unless they sign back in and cancel.
 *
 * "Wiped" means anonymised rather than the row being dropped. Their chat messages stay
 * in the channels and DMs they were part of (shown as a deleted user) so other people's
 * conversations still make sense, and coin ledgers stay balanced; everything that
 * identifies them, and everything only they would want, is removed.
 */

export const DELETION_GRACE_DAYS = 14;
const SWEEP_MS = 60 * 60_000;

export type DeletionBlocker = { kind: "forges" | "bots" | "billing"; message: string; items: Array<{ id: string; name: string }> };

/** Things that must be handed over or ended first, so deleting one account can't break other people's servers. */
export async function deletionBlockers(userId: string): Promise<DeletionBlocker[]> {
  const [forges, bots, billing] = await Promise.all([
    prisma.forge.findMany({ where: { ownerId: userId }, select: { id: true, name: true } }),
    prisma.botApp.findMany({ where: { ownerId: userId }, select: { id: true, name: true } }),
    prisma.billingSubscription.findMany({ where: { userId, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } }, select: { id: true, tier: true } }).catch(() => []),
  ]);
  const blockers: DeletionBlocker[] = [];
  if (forges.length) blockers.push({ kind: "forges", message: "Transfer ownership of these forges, or delete them, first.", items: forges });
  if (bots.length) blockers.push({ kind: "bots", message: "Delete the bot apps you own first (Developer portal).", items: bots });
  if (billing.length) {
    blockers.push({ kind: "billing", message: "Cancel your active subscription first.", items: billing.map((sub) => ({ id: sub.id, name: String(sub.tier) })) });
  }
  return blockers;
}

export async function scheduleDeletion(userId: string) {
  const now = new Date();
  const scheduledFor = new Date(now.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60_000);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { deletionRequestedAt: now, deletionScheduledFor: scheduledFor },
    select: { email: true, username: true },
  });
  // Sign out everywhere: the next sign-in is the moment to change your mind.
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
  void disconnectUserSockets(userId, { reason: "account_deletion_scheduled" }).catch((error) => console.error("[DELETION] socket revocation failed", error));
  void sendEmail(
    user.email,
    "Your Nexus Forge Gaming account is scheduled for deletion",
    [
      `Hi ${user.username},`,
      "",
      `Your account is scheduled to be deleted on ${scheduledFor.toUTCString()}.`,
      "You've been signed out on every device.",
      "",
      "Changed your mind? Sign in before then and choose \"Keep my account\".",
      "If you didn't ask for this, sign in now, cancel it, and change your password.",
    ].join("\n"),
  ).catch(() => undefined);
  return scheduledFor;
}

export async function cancelDeletion(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { deletionRequestedAt: null, deletionScheduledFor: null } });
}

/** Carries out the deletion. Safe to call twice. */
export async function anonymizeUser(userId: string) {
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { deletedAt: true, email: true, username: true } });
  if (!existing || existing.deletedAt) return;
  const tag = randomBytes(4).toString("hex");
  const now = new Date();

  // ID-verification photos are normally deleted once reviewed; remove any still waiting
  // for review, and the verification records themselves.
  const verifications = await prisma.ageVerification.findMany({ where: { userId }, select: { documentPath: true, selfiePath: true } });
  for (const entry of verifications) {
    await deleteDocument(entry.documentPath);
    if (entry.selfiePath) await deleteDocument(entry.selfiePath);
  }
  await prisma.ageVerification.deleteMany({ where: { userId } });

  await prisma.$transaction([
    // Sessions, codes and keys: nothing left that can act as them.
    prisma.refreshToken.deleteMany({ where: { userId } }),
    prisma.verificationCode.deleteMany({ where: { userId } }),
    prisma.pushSubscription.deleteMany({ where: { userId } }),
    prisma.webhookSubscription.deleteMany({ where: { userId } }),
    prisma.oAuthClient.deleteMany({ where: { userId } }),
    // Social graph and personal state.
    prisma.friend.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } }),
    prisma.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } }),
    prisma.forgeMember.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.channelReadState.deleteMany({ where: { userId } }),
    prisma.avatarPreset.deleteMany({ where: { userId } }),
    prisma.postLike.deleteMany({ where: { userId } }),
    prisma.savedMessage.deleteMany({ where: { userId } }),
    prisma.discordLinkCode.deleteMany({ where: { userId } }),
    // Notes they wrote, and other people's notes about an account that no longer exists.
    prisma.userNote.deleteMany({ where: { OR: [{ authorId: userId }, { targetId: userId }] } }),
    // Their own feed posts and comments are profile content, not conversation: removed.
    prisma.postComment.deleteMany({ where: { authorId: userId } }),
    prisma.post.deleteMany({ where: { authorId: userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        username: `deleted_user_${tag}`,
        email: `deleted+${randomUUID()}@deleted.invalid`,
        password: await hashPassword(randomBytes(32).toString("hex")),
        avatar: null,
        discordUserId: null,
        discordLinkedAt: null,
        banner: null,
        bio: null,
        displayName: null,
        clanTag: null,
        status: "OFFLINE",
        chosenStatus: "OFFLINE",
        currentActivity: null,
        activityDetails: null,
        activityType: null,
        activityStatus: null,
        activityMetadata: undefined,
        socialLinks: undefined,
        avatarConfig: undefined,
        loadout: undefined,
        loadoutPresets: undefined,
        privacySettings: undefined,
        preferences: undefined,
        isCreator: false,
        isFeatured: false,
        creatorStatus: "OFFLINE",
        livePlatform: null,
        liveStreamTitle: null,
        liveStreamUrl: null,
        liveGameCategory: null,
        liveViewerCount: 0,
        liveStartedAt: null,
        phoneNumber: null,
        phoneVerified: false,
        twoFactorEnabled: false,
        twoFactorChannels: [],
        totpSecretEnc: null,
        totpPendingEnc: null,
        totpEnabledAt: null,
        totpLastStep: null,
        totpRecoveryHashes: [],
        emailVerifyToken: null,
        emailVerifyExpires: null,
        resetToken: null,
        resetTokenExpires: null,
        birthdate: null,
        deletedAt: now,
        deletionScheduledFor: null,
      },
    }),
  ]);
  // Json columns can't be set to SQL NULL through `undefined`; clear them explicitly.
  await prisma.$executeRaw`UPDATE "User" SET "activityMetadata" = NULL, "socialLinks" = NULL, "avatarConfig" = NULL, "loadout" = NULL, "loadoutPresets" = NULL, "privacySettings" = NULL, "preferences" = NULL WHERE "id" = ${userId}`;

  void sendEmail(
    existing.email,
    "Your Nexus Forge Gaming account has been deleted",
    `Hi ${existing.username},\n\nAs you asked, your Nexus Forge Gaming account has now been deleted. Messages you sent in servers and DMs remain, shown as from a deleted user.\n`,
  ).catch(() => undefined);
  console.log(`[ACCOUNT] user ${userId} anonymised`);
}

/** Hourly: carry out deletions whose grace period has ended. */
export function startDeletionSweeper() {
  const tick = async () => {
    try {
      const due = await prisma.user.findMany({
        where: { deletedAt: null, deletionScheduledFor: { lte: new Date() } },
        select: { id: true },
        take: 50,
      });
      for (const { id } of due) {
        // Re-check at the last moment: a blocker (say, a newly created forge) means wait.
        if ((await deletionBlockers(id)).length) continue;
        await anonymizeUser(id).catch((error) => console.error("[ACCOUNT] anonymise failed", id, error));
      }
    } catch (error) {
      console.error("[ACCOUNT] deletion sweep failed", error);
    }
  };
  void tick();
  return setInterval(tick, SWEEP_MS);
}
