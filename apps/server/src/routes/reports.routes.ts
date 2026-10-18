import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { createNotification } from "../lib/notifications.js";
import { hasModeratorAccess, moderatorRoleFilter } from "../lib/app-roles.js";
import { getIo } from "../lib/realtime.js";
import { logForgeAction } from "../lib/forge-audit.js";
import { canModerateMember, hasForgePermission, resolveForgeAccess } from "../lib/forge-permissions.js";
import { loadMemberContext, userCanViewChannel } from "../lib/channel-access.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { considerAutomaticBan } from "../lib/vac-bans.js";

/**
 * Reporting a message. Channel messages are reviewed by that forge's moderators
 * (anyone with moderateChat); DMs are reviewed by platform staff. Staff can see both.
 */
export const reportsRouter = Router();

reportsRouter.use(requireAuth);
reportsRouter.use(requireCsrf);

export const reportReasons = ["SPAM", "HARASSMENT", "HATE", "SEXUAL", "VIOLENCE", "SELF_HARM", "SCAM", "OTHER"] as const;
const REPORTS_PER_HOUR = 20;

const createSchema = z.object({
  kind: z.enum(["CHANNEL", "DM"]),
  messageId: z.string().uuid(),
  reason: z.enum(reportReasons),
  details: z.string().trim().max(1000).optional(),
});

const handleSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED", "OPEN"]),
  note: z.string().trim().max(500).optional(),
  /** Also delete the reported message (channel reports: rank rules apply). */
  deleteMessage: z.boolean().optional(),
});

async function isStaff(req: Request) {
  const me = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { isAdmin: true, appRole: true } });
  return Boolean(me && hasModeratorAccess(me.appRole, me.isAdmin));
}

async function staffIds(excludeId: string) {
  const staff = await prisma.user.findMany({
    where: { deletedAt: null, ...moderatorRoleFilter, NOT: { id: excludeId } },
    select: { id: true },
    take: 50,
  });
  return staff.map((member) => member.id);
}

/** Members of a forge who can review its reports (owner + moderateChat), capped. */
async function forgeModeratorIds(forgeId: string, excludeId: string) {
  const forge = await prisma.forge.findUnique({ where: { id: forgeId }, select: { ownerId: true } });
  if (!forge) return [];
  const members = await prisma.forgeMember.findMany({
    where: { forgeId, NOT: { userId: excludeId } },
    select: { userId: true, roleLinks: { select: { role: { select: { id: true, position: true, permissions: true } } } } },
    take: 5000,
  });
  return members
    .filter((member) => hasForgePermission(resolveForgeAccess(forge.ownerId === member.userId, member.roleLinks.map((link) => link.role)), "moderateChat"))
    .map((member) => member.userId)
    .slice(0, 25);
}

reportsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Pick a reason for the report", details: parsed.error.flatten() });
    return;
  }
  const userId = req.user!.id;
  const recent = await prisma.messageReport.count({ where: { reporterId: userId, createdAt: { gt: new Date(Date.now() - 60 * 60_000) } } });
  if (recent >= REPORTS_PER_HOUR) {
    res.status(429).json({ error: "You've sent a lot of reports in the last hour. Try again later." });
    return;
  }

  let snapshot: { authorId: string | null; authorUsername: string | null; content: string; attachments: string[]; forgeId?: string; channelId?: string; threadId?: string };
  if (parsed.data.kind === "CHANNEL") {
    const message = await prisma.message.findUnique({
      where: { id: parsed.data.messageId },
      select: { channelId: true, authorId: true, content: true, attachments: true, author: { select: { username: true } }, channel: { select: { forgeId: true } } },
    });
    // You can only report what you can actually see.
    if (!message || !(await userCanViewChannel(userId, message.channelId)).ok) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    snapshot = { authorId: message.authorId, authorUsername: message.author?.username ?? null, content: message.content, attachments: message.attachments, forgeId: message.channel.forgeId, channelId: message.channelId };
  } else {
    const message = await prisma.directMessage.findUnique({
      where: { id: parsed.data.messageId },
      select: { threadId: true, authorId: true, content: true, attachments: true, author: { select: { username: true } } },
    });
    const participant = message ? await prisma.directMessageParticipant.findUnique({ where: { threadId_userId: { threadId: message.threadId, userId } }, select: { id: true } }) : null;
    if (!message || !participant) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    snapshot = { authorId: message.authorId, authorUsername: message.author?.username ?? null, content: message.content, attachments: message.attachments, threadId: message.threadId };
  }
  if (snapshot.authorId === userId) {
    res.status(400).json({ error: "You can't report your own message" });
    return;
  }

  const existing = await prisma.messageReport.findUnique({ where: { reporterId_messageId: { reporterId: userId, messageId: parsed.data.messageId } }, select: { id: true } });
  if (existing) {
    res.json({ ok: true, reportId: existing.id, duplicate: true });
    return;
  }

  const report = await prisma.messageReport.create({
    data: {
      reporterId: userId,
      kind: parsed.data.kind,
      messageId: parsed.data.messageId,
      forgeId: snapshot.forgeId,
      channelId: snapshot.channelId,
      threadId: snapshot.threadId,
      authorId: snapshot.authorId,
      authorUsername: snapshot.authorUsername,
      contentSnapshot: snapshot.content.slice(0, 4000),
      attachmentsSnapshot: snapshot.attachments,
      reason: parsed.data.reason,
      details: parsed.data.details || null,
    },
  });

  // Tell the reviewers, without naming the reporter.
  const reviewers = parsed.data.kind === "CHANNEL" ? await forgeModeratorIds(snapshot.forgeId!, userId) : await staffIds(userId);
  const forgeName = snapshot.forgeId ? (await prisma.forge.findUnique({ where: { id: snapshot.forgeId }, select: { name: true } }))?.name : null;
  void Promise.allSettled(
    reviewers.map((reviewerId) =>
      createNotification({
        userId: reviewerId,
        type: "SYSTEM",
        title: forgeName ? `New report in ${forgeName}` : "New DM report",
        body: `${parsed.data.reason.toLowerCase().replace("_", " ")} · message by @${snapshot.authorUsername ?? "unknown"}`,
        data: { kind: "report", reportId: report.id, forgeId: snapshot.forgeId ?? null },
      }),
    ),
  );
  if (snapshot.forgeId) {
    try {
      getIo().to(`forge:${snapshot.forgeId}`).emit("forge:reports", { forgeId: snapshot.forgeId });
    } catch {
      // realtime not ready
    }
  }

  res.status(201).json({ ok: true, reportId: report.id });
});

function shape<T extends { reporterId: string; handledById: string | null }>(reports: T[], users: Map<string, { id: string; username: string }>) {
  return reports.map((report) => ({
    ...report,
    reporter: users.get(report.reporterId) ?? null,
    handledBy: report.handledById ? users.get(report.handledById) ?? null : null,
  }));
}

async function usersFor(reports: Array<{ reporterId: string; handledById: string | null }>) {
  const ids = [...new Set(reports.flatMap((report) => [report.reporterId, report.handledById].filter(Boolean) as string[]))];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true } });
  return new Map<string, { id: string; username: string }>(users.map((user) => [user.id, user] as const));
}

function statusFilter(raw: unknown) {
  return raw === "RESOLVED" || raw === "DISMISSED" ? raw : raw === "ALL" ? undefined : "OPEN";
}

/** A forge's report queue, for its moderators. */
reportsRouter.get("/forge/:forgeId", async (req, res) => {
  const member = await loadMemberContext(req.user!.id, req.params.forgeId);
  if (!member || !hasForgePermission(member.access, "moderateChat")) {
    res.status(403).json({ error: "Only moderators can see reports" });
    return;
  }
  const status = statusFilter(req.query.status);
  const reports = await prisma.messageReport.findMany({
    where: { forgeId: req.params.forgeId, kind: "CHANNEL", ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  // Private channels: a moderator only sees reports from channels they can open.
  const visible: typeof reports = [];
  const channelOk = new Map<string, boolean>();
  for (const report of reports) {
    if (report.channelId && !channelOk.has(report.channelId)) channelOk.set(report.channelId, (await userCanViewChannel(req.user!.id, report.channelId)).ok || !(await prisma.channel.findUnique({ where: { id: report.channelId }, select: { id: true } })));
    if (!report.channelId || channelOk.get(report.channelId)) visible.push(report);
  }
  const channels = await prisma.channel.findMany({ where: { id: { in: [...new Set(visible.map((report) => report.channelId).filter(Boolean) as string[])] } }, select: { id: true, name: true } });
  const channelName = new Map(channels.map((channel) => [channel.id, channel.name] as const));
  const openCount = await prisma.messageReport.count({ where: { forgeId: req.params.forgeId, kind: "CHANNEL", status: "OPEN" } });
  res.json({ reports: shape<(typeof reports)[number]>(visible, await usersFor(visible)).map((report) => ({ ...report, channelName: report.channelId ? channelName.get(report.channelId) ?? "deleted-channel" : null })), openCount });
});

/** Everything, for platform staff. */
reportsRouter.get("/staff", async (req, res) => {
  if (!(await isStaff(req))) {
    res.status(403).json({ error: "Staff only" });
    return;
  }
  const status = statusFilter(req.query.status);
  const kind = req.query.kind === "CHANNEL" || req.query.kind === "DM" ? req.query.kind : undefined;
  const reports = await prisma.messageReport.findMany({
    where: { ...(status ? { status } : {}), ...(kind ? { kind } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const openCount = await prisma.messageReport.count({ where: { status: "OPEN" } });
  res.json({ reports: shape(reports, await usersFor(reports)), openCount });
});

reportsRouter.patch("/:id", async (req, res) => {
  const parsed = handleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const report = await prisma.messageReport.findUnique({ where: { id: req.params.id } });
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  const staff = await isStaff(req);
  let actor: Awaited<ReturnType<typeof loadMemberContext>> = null;
  if (report.kind === "CHANNEL" && report.forgeId) actor = await loadMemberContext(req.user!.id, report.forgeId);
  const forgeModerator = Boolean(actor && hasForgePermission(actor.access, "moderateChat") && (!report.channelId || (await userCanViewChannel(req.user!.id, report.channelId)).ok || !(await prisma.channel.findUnique({ where: { id: report.channelId }, select: { id: true } }))));
  if (!staff && !forgeModerator) {
    res.status(403).json({ error: "You can't review this report" });
    return;
  }

  let messageDeleted = false;
  if (parsed.data.deleteMessage) {
    if (report.kind === "CHANNEL") {
      const message = await prisma.message.findUnique({ where: { id: report.messageId }, select: { id: true, channelId: true, authorId: true } });
      if (message) {
        // Same rank rule as deleting from chat; staff can always remove it.
        if (!staff && message.authorId && actor) {
          const forge = await prisma.forge.findUnique({ where: { id: report.forgeId! }, select: { ownerId: true } });
          const author = await prisma.forgeMember.findUnique({
            where: { userId_forgeId: { userId: message.authorId, forgeId: report.forgeId! } },
            include: { roleLinks: { include: { role: true } } },
          });
          if (author && !canModerateMember(actor.access, resolveForgeAccess(forge?.ownerId === message.authorId, author.roleLinks.map((link) => link.role)))) {
            res.status(403).json({ error: "You can't delete messages from someone who outranks you" });
            return;
          }
        }
        await prisma.message.delete({ where: { id: message.id } });
        try {
          getIo().to(`channel:${message.channelId}`).emit("message:deleted", { messageId: message.id });
        } catch {
          // realtime not ready
        }
        messageDeleted = true;
      }
    } else if (staff) {
      const message = await prisma.directMessage.findUnique({ where: { id: report.messageId }, select: { id: true, threadId: true } });
      if (message) {
        await prisma.directMessage.delete({ where: { id: message.id } });
        try {
          getIo().to(`dm:${message.threadId}`).emit("dm:message:deleted", { threadId: message.threadId, messageId: message.id });
        } catch {
          // realtime not ready
        }
        messageDeleted = true;
      }
    }
  }

  const reopened = parsed.data.status === "OPEN";
  const updated = await prisma.messageReport.update({
    where: { id: report.id },
    data: {
      status: parsed.data.status,
      resolutionNote: reopened ? null : parsed.data.note || (messageDeleted ? "Message deleted" : null),
      handledById: reopened ? null : req.user!.id,
      handledAt: reopened ? null : new Date(),
    },
  });
  if (report.forgeId && report.kind === "CHANNEL") {
    if (messageDeleted) {
      void logForgeAction(report.forgeId, req.user!.id, "message.delete", { type: "message", id: report.messageId, label: report.authorUsername ?? "unknown" }, { channelId: report.channelId, excerpt: report.contentSnapshot.slice(0, 200), viaReport: report.id });
    }
    try {
      getIo().to(`forge:${report.forgeId}`).emit("forge:reports", { forgeId: report.forgeId });
    } catch {
      // realtime not ready
    }
  }
  // Platform staff upheld this report, so the VAC escalation rules may now ban the author.
  if (staff && parsed.data.status === "RESOLVED" && report.authorId) {
    void considerAutomaticBan({ userId: report.authorId, triggeredById: req.user!.id }).catch((error) => console.error("[VAC] automatic check failed", error));
  }
  res.json({ report: updated, messageDeleted });
});
