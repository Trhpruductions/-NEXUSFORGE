import { Router, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { comparePassword } from "../lib/password.js";
import { cancelDeletion, deletionBlockers, DELETION_GRACE_DAYS, scheduleDeletion } from "../lib/account-deletion.js";
import { confirmCurrentPassword, PASSWORD_REQUIRED } from "../lib/reauth.js";
import { duplicateWaitSeconds, sendTemplateEmail } from "../lib/delivery.js";
import { confirmEmailChange, requestEmailChange, type EmailChangeDeps } from "../lib/email-change.js";
import { emailContextFromEnv, renderCodeEmail } from "../lib/email-templates.js";
import { issueCode, RESEND_COOLDOWN_MS, verifyCode } from "../lib/verification.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { accountOrIpKey } from "../middleware/rate-limit.js";
import { REFRESH_COOKIE_NAME } from "./auth.routes.js";

/** Account deletion and "download my data". Mounted at /api/account. */
export const accountRouter = Router();

accountRouter.use(requireAuth);
accountRouter.use(requireCsrf);

const deleteSchema = z.object({ password: z.string().min(1).max(200) });

accountRouter.get("/deletion", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { deletionScheduledFor: true, deletionRequestedAt: true } });
  res.json({
    scheduledFor: user?.deletionScheduledFor ?? null,
    requestedAt: user?.deletionRequestedAt ?? null,
    graceDays: DELETION_GRACE_DAYS,
    blockers: await deletionBlockers(req.user!.id),
  });
});

accountRouter.post("/deletion", async (req, res) => {
  const parsed = deleteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter your password to confirm" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { password: true, deletedAt: true } });
  if (!user || user.deletedAt) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  if (!(await comparePassword(parsed.data.password, user.password))) {
    res.status(403).json({ error: "That password isn't right" });
    return;
  }
  const blockers = await deletionBlockers(req.user!.id);
  if (blockers.length) {
    res.status(409).json({ error: blockers[0].message, blockers });
    return;
  }
  const scheduledFor = await scheduleDeletion(req.user!.id);
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/" });
  res.json({ ok: true, scheduledFor });
});

accountRouter.delete("/deletion", async (req, res) => {
  await cancelDeletion(req.user!.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Data export: one JSON file with everything the account holds. Streamed, because a
// long-time member can have tens of thousands of messages.
// ---------------------------------------------------------------------------

const lastExport = new Map<string, number>();
const EXPORT_COOLDOWN_MS = 10 * 60_000;
const BATCH = 1000;

function writeJson(res: Response, value: unknown) {
  return res.write(JSON.stringify(value, null, 2));
}

/** Writes `"key": [ ...rows ]` page by page so memory stays flat. */
async function writeBatched(res: Response, key: string, fetchPage: (cursor?: string) => Promise<Array<{ id: string }>>) {
  res.write(`,\n"${key}": [`);
  let cursor: string | undefined;
  let first = true;
  for (;;) {
    const rows = await fetchPage(cursor);
    for (const row of rows) {
      res.write(`${first ? "\n" : ",\n"}${JSON.stringify(row)}`);
      first = false;
    }
    if (rows.length < BATCH) break;
    cursor = rows[rows.length - 1].id;
  }
  res.write("\n]");
}

accountRouter.get("/export", async (req, res) => {
  const userId = req.user!.id;
  const last = lastExport.get(userId) ?? 0;
  if (Date.now() - last < EXPORT_COOLDOWN_MS) {
    const wait = Math.ceil((last + EXPORT_COOLDOWN_MS - Date.now()) / 60_000);
    res.status(429).json({ error: `You can download your data again in ${wait} minute${wait === 1 ? "" : "s"}.` });
    return;
  }
  lastExport.set(userId, Date.now());

  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, username: true, email: true, displayName: true, avatar: true, banner: true, bio: true, clanTag: true,
      createdAt: true, emailVerified: true, phoneNumber: true, phoneVerified: true, twoFactorEnabled: true, twoFactorChannels: true,
      birthdate: true, ageVerificationLevel: true, ageVerifiedAt: true, premium: true, premiumTier: true, appRole: true,
      chosenStatus: true, socialLinks: true, privacySettings: true, preferences: true, avatarConfig: true, loadout: true, loadoutPresets: true,
      dailyStreak: true, lastDailyClaimAt: true, reputation: true, deletionScheduledFor: true,
    },
  });
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const [memberships, friends, follows, sessions, coinAccounts, cosmetics, medals, events, tickets, devices, notifications, notes, saved] = await Promise.all([
    prisma.forgeMember.findMany({ where: { userId }, select: { nickname: true, joinedAt: true, forge: { select: { id: true, name: true } }, roleLinks: { select: { role: { select: { name: true } } } } } }),
    prisma.friend.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      select: { status: true, createdAt: true, blockedById: true, sender: { select: { id: true, username: true } }, receiver: { select: { id: true, username: true } } },
    }),
    prisma.follow.findMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] }, select: { createdAt: true, follower: { select: { username: true } }, following: { select: { username: true } } } }),
    prisma.refreshToken.findMany({ where: { userId }, select: { signedInAt: true, lastUsedAt: true, deviceLabel: true, userAgent: true, ipPrefix: true, revokedAt: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.economyAccount.findMany({ where: { userId }, select: { currencyType: true, balance: true, frozenBalance: true, lifetimeEarnings: true } }),
    prisma.userCosmetic.findMany({ where: { userId }, select: { acquiredAt: true, item: { select: { name: true } } } }).catch(() => []),
    prisma.userMedal.findMany({ where: { userId }, select: { grantedAt: true, medal: { select: { name: true } } } }).catch(() => []),
    prisma.eventParticipant.findMany({ where: { userId }, select: { status: true, createdAt: true, event: { select: { id: true, title: true, startsAt: true } } } }),
    prisma.supportTicket.findMany({ where: { userId }, select: { number: true, subject: true, category: true, status: true, createdAt: true, messages: { select: { fromStaff: true, body: true, createdAt: true }, orderBy: { createdAt: "asc" } } } }),
    prisma.pushSubscription.findMany({ where: { userId }, select: { deviceName: true, platform: true, createdAt: true } }),
    prisma.notification.findMany({ where: { userId }, select: { type: true, title: true, body: true, read: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1000 }),
    // Notes you wrote (not other people's notes about you: those are theirs).
    prisma.userNote.findMany({ where: { authorId: userId }, select: { note: true, updatedAt: true, target: { select: { username: true } } } }),
    prisma.savedMessage.findMany({ where: { userId }, select: { createdAt: true, messageId: true, dmMessageId: true }, orderBy: { createdAt: "desc" } }),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="vexora-data-${account.username}-${stamp}.json"`);
  res.setHeader("Cache-Control", "no-store");

  res.write("{\n\"about\": ");
  writeJson(res, {
    exportedAt: new Date().toISOString(),
    note: "Everything Nexus Forge Gaming holds for your account. Passwords, session tokens and secrets are never included.",
  });
  res.write(",\n\"account\": ");
  writeJson(res, account);
  res.write(",\n\"forges\": ");
  writeJson(res, memberships.map((entry) => ({ forgeId: entry.forge.id, forge: entry.forge.name, nickname: entry.nickname, joinedAt: entry.joinedAt, roles: entry.roleLinks.map((link) => link.role.name) })));
  res.write(",\n\"friends\": ");
  writeJson(res, friends.map((entry) => {
    const other = entry.sender.id === userId ? entry.receiver : entry.sender;
    return { username: other.username, status: entry.status, direction: entry.sender.id === userId ? "sent" : "received", blockedByYou: entry.blockedById === userId, since: entry.createdAt };
  }));
  res.write(",\n\"follows\": ");
  writeJson(res, follows.map((entry) => ({ follower: entry.follower.username, following: entry.following.username, since: entry.createdAt })));
  res.write(",\n\"sessions\": ");
  writeJson(res, sessions);
  res.write(",\n\"devices\": ");
  writeJson(res, devices);
  res.write(",\n\"coins\": ");
  writeJson(res, coinAccounts);
  res.write(",\n\"cosmetics\": ");
  writeJson(res, cosmetics.map((entry) => ({ item: entry.item?.name ?? null, acquiredAt: entry.acquiredAt })));
  res.write(",\n\"medals\": ");
  writeJson(res, medals.map((entry) => ({ medal: entry.medal?.name ?? null, grantedAt: entry.grantedAt })));
  res.write(",\n\"events\": ");
  writeJson(res, events.map((entry) => ({ eventId: entry.event.id, title: entry.event.title, startsAt: entry.event.startsAt, rsvp: entry.status, at: entry.createdAt })));
  res.write(",\n\"supportTickets\": ");
  writeJson(res, tickets);
  res.write(",\n\"notifications\": ");
  writeJson(res, notifications);
  res.write(",\n\"notesAboutOthers\": ");
  writeJson(res, notes.map((entry) => ({ about: entry.target.username, note: entry.note, updatedAt: entry.updatedAt })));
  res.write(",\n\"savedMessages\": ");
  writeJson(res, saved.map((entry) => ({ savedAt: entry.createdAt, channelMessageId: entry.messageId, directMessageId: entry.dmMessageId })));

  try {
    await writeBatched(
      res,
      "coinTransactions",
      (cursor) => prisma.economyTransaction.findMany({ where: { userId }, orderBy: { id: "asc" }, take: BATCH, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, amount: true, type: true, reason: true, balanceAfter: true, createdAt: true } }),
    );
    await writeBatched(
      res,
      "messages",
      (cursor) =>
        prisma.message.findMany({
          where: { authorId: userId },
          orderBy: { id: "asc" },
          take: BATCH,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: { id: true, content: true, attachments: true, edited: true, createdAt: true, channel: { select: { name: true, forge: { select: { name: true } } } } },
        }).then((rows) => rows.map((row) => ({ id: row.id, forge: row.channel.forge.name, channel: row.channel.name, content: row.content, attachments: row.attachments, edited: row.edited, sentAt: row.createdAt }))),
    );
    await writeBatched(
      res,
      "directMessages",
      (cursor) => prisma.directMessage.findMany({ where: { authorId: userId }, orderBy: { id: "asc" }, take: BATCH, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, threadId: true, content: true, attachments: true, createdAt: true } }).then((rows) => rows.map((row) => ({ id: row.id, threadId: row.threadId, content: row.content, attachments: row.attachments, sentAt: row.createdAt }))),
    );
    await writeBatched(
      res,
      "posts",
      (cursor) => prisma.post.findMany({ where: { authorId: userId }, orderBy: { id: "asc" }, take: BATCH, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, kind: true, content: true, mediaUrl: true, tags: true, createdAt: true } }),
    );
    await writeBatched(
      res,
      "postComments",
      (cursor) => prisma.postComment.findMany({ where: { authorId: userId }, orderBy: { id: "asc" }, take: BATCH, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, postId: true, content: true, createdAt: true } }),
    );
    res.end("\n}\n");
  } catch (error) {
    // Headers are already sent; end the stream so the file is visibly truncated rather than hanging.
    console.error("[ACCOUNT] export failed", error);
    res.end("\n]\n}\n");
  }
});

// ---------------------------------------------------------------------------
// Email change. A 6-digit code goes to the NEW address before anything changes; the OLD address
// gets a security notice once it has. The password is checked on every request (lib/reauth.ts).
// ---------------------------------------------------------------------------

const emailChangeRequestLimit = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  keyGenerator: accountOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "You've asked for too many email changes. Try again later." },
});

const emailChangeConfirmLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  keyGenerator: accountOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes." },
});

const newEmailSchema = z.object({ newEmail: z.string().trim().toLowerCase().min(3).max(254).email() });
const emailCodeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") });

const emailChangeDeps: EmailChangeDeps = {
  async findAccount(userId) {
    return prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true, username: true, email: true } });
  },
  async isEmailTaken(email, exceptUserId) {
    const taken = await prisma.user.findFirst({ where: { email, id: { not: exceptUserId } }, select: { id: true } });
    return Boolean(taken);
  },
  async cooldownSeconds(userId) {
    // Two clocks: the code helper's resend cooldown, and the duplicate window for the same email kind.
    const latest = await prisma.verificationCode.findFirst({
      where: { userId, channel: "EMAIL", purpose: "CHANGE_EMAIL", consumedAt: null },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const codeWait = latest ? Math.ceil((latest.createdAt.getTime() + RESEND_COOLDOWN_MS - Date.now()) / 1000) : 0;
    const subject = renderCodeEmail("CHANGE_EMAIL", "000000", emailContextFromEnv()).rendered.subject;
    const mailWait = await duplicateWaitSeconds(userId, "email-change-requested", subject);
    return Math.max(0, codeWait, mailWait);
  },
  async issueCode({ userId, target }) {
    const result = await issueCode({ userId, channel: "EMAIL", purpose: "CHANGE_EMAIL", target });
    if (!result.ok) console.error("[ACCOUNT] email change code not sent:", result.error ?? "unknown");
    return result;
  },
  async checkCode({ userId, code }) {
    const result = await verifyCode({ userId, purpose: "CHANGE_EMAIL", code, channel: "EMAIL" });
    return result.ok ? { ok: true, target: result.target } : { ok: false, error: result.error, attemptsLeft: result.attemptsLeft };
  },
  async applyEmail({ userId, email }) {
    try {
      // Verified on purpose: the code proved control of the new address. Any reset link sent to the old one stops working.
      await prisma.user.update({
        where: { id: userId },
        data: { email, emailVerified: true, emailVerifyToken: null, emailVerifyExpires: null, resetToken: null, resetTokenExpires: null },
        select: { id: true },
      });
      return { ok: true } as const;
    } catch (error) {
      // Two requests raced for the same address: the unique constraint picks one, and the other is told it is taken.
      if ((error as { code?: string }).code === "P2002") return { ok: false, reason: "taken" } as const;
      throw error;
    }
  },
  notifyOldAddress({ userId, to, username, newEmailMasked, at }) {
    void sendTemplateEmail("email-changed", to, { username, newEmailMasked, when: at.toUTCString() }, { userId }).catch((error) =>
      console.error("[ACCOUNT] email-changed notice failed", error),
    );
  },
};

accountRouter.post("/email/change", emailChangeRequestLimit, async (req, res) => {
  const parsed = newEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email address" });
    return;
  }
  if (!(await confirmCurrentPassword(req.user!.id, req.body?.password))) {
    res.status(403).json(PASSWORD_REQUIRED);
    return;
  }
  const result = await requestEmailChange(emailChangeDeps, { userId: req.user!.id, newEmail: parsed.data.newEmail });
  res.status(result.status).json(result.body);
});

accountRouter.post("/email/confirm", emailChangeConfirmLimit, async (req, res) => {
  const parsed = emailCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter the 6-digit code" });
    return;
  }
  const result = await confirmEmailChange(emailChangeDeps, { userId: req.user!.id, code: parsed.data.code });
  res.status(result.status).json(result.body);
});
