import { Router } from "express";
import xss from "xss";
import { z } from "zod";
import { renderBotCommandResponse } from "../lib/bot-commands.js";
import { prisma } from "../lib/prisma.js";
import { canModerateMember, hasForgePermission, resolveForgeAccess } from "../lib/forge-permissions.js";
import { evaluateAchievements } from "../lib/achievements.js";
import { createNotification } from "../lib/notifications.js";
import { getIo } from "../lib/realtime.js";
import { antiSpam } from "../middleware/anti-spam.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { messageRateLimit } from "../middleware/rate-limit.js";
import { recordMentions } from "./reads.routes.js";
import { bypassesSlowmode, canViewChannel, channelAccessSelect, isTimedOut, loadMemberContext, privateChannelViewerIds, userCanViewChannel } from "../lib/channel-access.js";
import { logForgeAction } from "../lib/forge-audit.js";
import { runAutoMod } from "../lib/automod-runtime.js";

function timeoutError(until: Date | null) {
  return { error: `You're timed out until ${until?.toISOString() ?? "later"}`, code: "TIMED_OUT", timeoutUntil: until };
}

const createMessageSchema = z.object({
  channelId: z.string().uuid(),
  content: z.string().min(1).max(4000),
  // http(s) only: these render as links, and z.url() alone accepts javascript: URLs.
  attachments: z.array(z.string().url().max(2048).refine((value) => /^https?:\/\//i.test(value), "Attachments must be http(s) links")).max(8).optional(),
  replyToId: z.string().uuid().optional(),
  optimisticId: z.string().optional(),
  /** Post into a thread of this channel instead of the channel itself. */
  threadId: z.string().uuid().optional(),
  /** Forum channels: a new post needs a title (and may pick tags). */
  forumTitle: z.string().trim().min(1).max(100).optional(),
  forumTags: z.array(z.string().trim().min(1).max(20)).max(5).optional(),
});

const editMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

const reactionSchema = z.object({
  emoji: z.string().min(1).max(32),
});

export const messagesRouter = Router();

/** Standard message payload shape shared by list, create, edit and realtime events. */
export const messageInclude = {
  author: {
    select: {
      id: true,
      username: true,
      avatar: true,
      premium: true,
    },
  },
  reactions: true,
  replyTo: {
    select: {
      id: true,
      content: true,
      authorId: true,
      botName: true,
      author: { select: { id: true, username: true } },
    },
  },
  // A message that started a thread shows the thread's name and size under it.
  startedThread: { select: { id: true, title: true, messageCount: true, lastMessageAt: true, archived: true } },
} as const;

function normalizeBotCommandName(raw: string) {
  return raw.trim().replace(/^\//, "").toLowerCase();
}

async function resolveBotCommandResponse(
  userId: string,
  userName: string,
  forgeId: string,
  forgeName: string,
  channelName: string,
  rawContent: string,
) {
  const trimmed = rawContent.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const [commandToken, ...argParts] = trimmed.slice(1).split(/\s+/);
  const commandName = normalizeBotCommandName(commandToken ?? "");
  if (!commandName) {
    return null;
  }

  const command = await prisma.botCommand.findUnique({
    where: {
      forgeId_name: {
        forgeId,
        name: commandName,
      },
    },
    include: {
      installation: {
        include: {
          bot: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      },
    },
  });

  if (!command || !command.enabled || !command.installation.enabled) {
    return null;
  }

  if (command.requiredPermission !== "NONE") {
    const member = await prisma.forgeMember.findUnique({
      where: {
        userId_forgeId: {
          userId,
          forgeId,
        },
      },
      include: {
        roleLinks: {
          include: {
            role: true,
          },
        },
      },
    });

    const hasPermission = member?.roleLinks.some((link) => {
      const permissions = link.role.permissions as Record<string, boolean>;
      return Boolean(permissions[command.requiredPermission]);
    });

    if (!hasPermission) {
      return {
        denied: true as const,
        responseTemplate: `You do not have permission to use /${command.name}.`,
        botId: command.installation.bot.id,
        botName: command.installation.bot.name,
        botAvatar: command.installation.bot.avatar,
      };
    }
  }

  const args = argParts.join(" ").trim();

  return {
    denied: false as const,
    responseTemplate: renderBotCommandResponse(command.responseTemplate, {
      userId,
      userName,
      forgeName,
      channelName,
      commandName: command.name,
      botName: command.installation.bot.name,
      args,
    }),
    botId: command.installation.bot.id,
    botName: command.installation.bot.name,
    botAvatar: command.installation.bot.avatar,
  };
}

messagesRouter.use(requireAuth);
messagesRouter.use(requireCsrf);

messagesRouter.get("/:channelId", async (req, res) => {
  const channelId = req.params.channelId;
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  const limit = Math.min(Number(req.query.limit ?? 40), 100);

  const view = await userCanViewChannel(req.user!.id, channelId);
  if (!view.channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }
  if (!view.member) {
    res.status(403).json({ error: "Not a Forge member" });
    return;
  }
  // A private channel you can't see doesn't exist as far as you're concerned.
  if (!view.ok) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  const messages = await prisma.message.findMany({
    // Thread replies live in their thread, not in the channel's main history.
    where: { channelId, threadId: null },
    take: limit,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor },
        }
      : {}),
    // id breaks ties so two messages in the same millisecond can't swap between pages.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: messageInclude,
  });

  // Newest-first from the query, so the last row is the oldest: that's where the next
  // page starts. Take it before reversing (reverse() works in place).
  const nextCursor = messages.length === limit ? messages[messages.length - 1]?.id ?? null : null;
  res.json({ messages: [...messages].reverse(), nextCursor });
});

messagesRouter.post("/", messageRateLimit, antiSpam, async (req, res) => {
  const parsed = createMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const channel = await prisma.channel.findUnique({
    where: { id: parsed.data.channelId },
    select: {
      ...channelAccessSelect,
      name: true,
      type: true,
      slowmodeSeconds: true,
      forumTags: true,
      forge: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  if (channel.type === "FORUM") {
    // A forum has no flat chat: either a reply inside a post, or a new titled post.
    if (!parsed.data.threadId && !parsed.data.forumTitle) {
      res.status(400).json({ error: "Give your post a title", code: "FORUM_TITLE" });
      return;
    }
  } else if (channel.type !== "TEXT" && channel.type !== "ANNOUNCEMENT") {
    res.status(400).json({ error: "Messages are only allowed in text-based channels" });
    return;
  }
  const forumTags = channel.type === "FORUM" && parsed.data.forumTags ? [...new Set(parsed.data.forumTags)] : [];
  if (forumTags.some((tag) => !channel.forumTags.includes(tag))) {
    res.status(400).json({ error: "Pick tags from this forum's list" });
    return;
  }

  const membership = await prisma.forgeMember.findUnique({
    where: {
      userId_forgeId: {
        userId: req.user!.id,
        forgeId: channel.forgeId,
      },
    },
    include: { roleLinks: { include: { role: true } }, forge: { select: { ownerId: true } } },
  });

  const memberContext = await loadMemberContext(req.user!.id, channel.forgeId);
  if (!membership || !memberContext) {
    res.status(403).json({ error: "Not a Forge member" });
    return;
  }
  if (!canViewChannel(memberContext, channel)) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }
  if (isTimedOut(memberContext)) {
    res.status(403).json(timeoutError(memberContext.timeoutUntil));
    return;
  }
  if (channel.slowmodeSeconds > 0 && !bypassesSlowmode(memberContext)) {
    const since = new Date(Date.now() - channel.slowmodeSeconds * 1000);
    const recent = await prisma.message.findFirst({
      where: { channelId: channel.id, authorId: req.user!.id, createdAt: { gt: since } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (recent) {
      const retryAfter = Math.max(1, Math.ceil((recent.createdAt.getTime() + channel.slowmodeSeconds * 1000 - Date.now()) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({ error: `Slowmode is on. You can send another message in ${retryAfter}s.`, code: "SLOWMODE", retryAfter });
      return;
    }
  }

  const automod = await runAutoMod({ forgeId: channel.forgeId, channelId: channel.id, content: parsed.data.forumTitle ? `${parsed.data.forumTitle}\n${parsed.data.content}` : parsed.data.content, member: memberContext, username: req.user!.username });
  if (automod.blocked) {
    res.status(400).json({ error: automod.message, code: "AUTOMOD", rule: automod.ruleName });
    return;
  }

  // Announcement channels are read-only for regular members.
  if (channel.type === "ANNOUNCEMENT") {
    const access = resolveForgeAccess(
      membership.forge.ownerId === req.user!.id,
      membership.roleLinks.map((link) => ({ position: link.role.position, permissions: link.role.permissions })),
    );
    if (!hasForgePermission(access, "moderateChat") && !hasForgePermission(access, "manageChannels")) {
      res.status(403).json({ error: "Only moderators can post in announcement channels" });
      return;
    }
  }

  let thread: { id: string; archived: boolean } | null = null;
  if (parsed.data.threadId) {
    thread = await prisma.thread.findFirst({ where: { id: parsed.data.threadId, channelId: channel.id }, select: { id: true, archived: true } });
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
  }

  // A reply must point at a message in this same channel; otherwise its preview (which
  // echoes the original's content) would leak messages from channels you can't read.
  if (parsed.data.replyToId) {
    const original = await prisma.message.findUnique({ where: { id: parsed.data.replyToId }, select: { channelId: true } });
    if (!original || original.channelId !== parsed.data.channelId) {
      res.status(400).json({ error: "You can only reply to a message in this channel" });
      return;
    }
  }

  const sanitizedContent = xss(parsed.data.content.trim());
  const created = await prisma.message.create({
    data: {
      channelId: parsed.data.channelId,
      authorId: req.user!.id,
      content: sanitizedContent,
      attachments: parsed.data.attachments ?? [],
      replyToId: parsed.data.replyToId,
      threadId: thread?.id,
    },
    include: messageInclude,
  });

  // A new forum post: the message is the post body, and a thread holds its replies.
  if (channel.type === "FORUM" && !thread && parsed.data.forumTitle) {
    const post = await prisma.thread.create({
      data: { channelId: channel.id, title: xss(parsed.data.forumTitle), starterPostId: created.id, creatorId: req.user!.id, tags: forumTags, lastMessageAt: created.createdAt },
      select: { id: true, title: true, messageCount: true, lastMessageAt: true, archived: true, creatorId: true, tags: true },
    });
    (created as { startedThread?: unknown }).startedThread = post;
    getIo().to(`channel:${channel.id}`).emit("thread:updated", { channelId: channel.id, messageId: created.id, thread: post });
  }

  if (thread) {
    // Like Discord, a new reply brings an archived thread back.
    const updated = await prisma.thread.update({
      where: { id: thread.id },
      data: { messageCount: { increment: 1 }, lastMessageAt: created.createdAt, archived: false },
      select: { id: true, title: true, messageCount: true, lastMessageAt: true, archived: true, starterPostId: true },
    });
    getIo().to(`channel:${channel.id}`).emit("thread:updated", { channelId: channel.id, messageId: updated.starterPostId, thread: updated });
  }

  // Mentions. Only members of this forge are ever notified.
  //  - @username
  //  - @Role Name: everyone holding that role
  //  - @everyone (all members) / @here (members currently online): like Discord, these
  //    only ping when sent by someone with moderation rights; otherwise they're just text.
  const raw = parsed.data.content;
  const mentionedUserIds: string[] = [];
  let mentionLabel = "you";
  const recipients = new Set<string>();
  // People pinged by name or role, as opposed to only through @everyone / @here.
  const directRecipients = new Set<string>();

  const usernames = [...new Set(Array.from(raw.matchAll(/@([a-zA-Z0-9_]+)/g)).map((match) => match[1]))].filter((name) => name !== "everyone" && name !== "here");
  if (usernames.length) {
    const users = await prisma.user.findMany({
      where: { username: { in: usernames }, memberships: { some: { forgeId: channel.forgeId } } },
      select: { id: true },
    });
    users.forEach((entry) => {
      recipients.add(entry.id);
      directRecipients.add(entry.id);
    });
  }

  const forgeRoles = await prisma.role.findMany({ where: { forgeId: channel.forgeId }, select: { id: true, name: true } });
  const mentionedRoles = forgeRoles.filter((role) => role.name && raw.includes(`@${role.name}`) && role.name.toLowerCase() !== "@everyone");
  if (mentionedRoles.length) {
    const holders = await prisma.memberRole.findMany({ where: { roleId: { in: mentionedRoles.map((role) => role.id) } }, select: { forgeMember: { select: { userId: true } } } });
    holders.forEach((entry) => {
      recipients.add(entry.forgeMember.userId);
      directRecipients.add(entry.forgeMember.userId);
    });
    mentionLabel = `@${mentionedRoles[0].name}`;
  }

  const wantsEveryone = /@everyone\b/.test(raw);
  const wantsHere = /@here\b/.test(raw);
  if (wantsEveryone || wantsHere) {
    const access = resolveForgeAccess(
      membership.forge.ownerId === req.user!.id,
      membership.roleLinks.map((link) => ({ position: link.role.position, permissions: link.role.permissions })),
    );
    if (hasForgePermission(access, "moderateChat") || hasForgePermission(access, "manageForge")) {
      const members = await prisma.forgeMember.findMany({
        where: { forgeId: channel.forgeId, ...(wantsEveryone ? {} : { user: { status: { in: ["ONLINE", "IDLE", "DND"] } } }) },
        select: { userId: true },
        take: 2000,
      });
      members.forEach((entry) => recipients.add(entry.userId));
      mentionLabel = wantsEveryone ? "@everyone" : "@here";
    }
  }

  recipients.delete(req.user!.id);
  // In a private channel, only people who can open it get pinged.
  const viewerIds = channel.isPrivate ? new Set(await privateChannelViewerIds(channel)) : null;
  // Each member's own settings for this forge: "Nothing" drops the ping entirely,
  // "suppress @everyone" drops pings that only came from @everyone/@here, and a mute
  // keeps the mention badge but sends no notification.
  const candidateIds = [...recipients].filter((id) => !viewerIds || viewerIds.has(id));
  const prefs = candidateIds.length
    ? await prisma.forgeMember.findMany({
        where: { forgeId: channel.forgeId, userId: { in: candidateIds } },
        select: { userId: true, notifyLevel: true, mutedUntil: true, suppressEveryone: true },
      })
    : [];
  const prefByUser = new Map<string, { notifyLevel: string; mutedUntil: Date | null; suppressEveryone: boolean }>(prefs.map((pref) => [pref.userId, pref] as const));
  const nowMs = Date.now();
  const mutedIds = new Set<string>();
  const wanted = candidateIds.filter((id) => {
    const pref = prefByUser.get(id);
    if (!pref) return true;
    if (pref.notifyLevel === "NONE") return false;
    if (pref.suppressEveryone && !directRecipients.has(id)) return false;
    if (pref.mutedUntil && pref.mutedUntil.getTime() > nowMs) mutedIds.add(id);
    return true;
  });
  // Bound the cost of one message in a very large forge.
  mentionedUserIds.push(...wanted.slice(0, 500));

  if (mentionedUserIds.length) {
    void recordMentions(parsed.data.channelId, mentionedUserIds).catch(() => undefined);
    const channelName = (await prisma.channel.findUnique({ where: { id: parsed.data.channelId }, select: { name: true } }))?.name;
    await Promise.all(
      mentionedUserIds.filter((userId) => !mutedIds.has(userId)).map((userId) =>
        createNotification({
          userId,
          type: "MENTION",
          title: mentionLabel === "you" ? "You were mentioned" : `${req.user!.username} mentioned ${mentionLabel}`,
          body: `${req.user!.username} in #${channelName ?? "channel"}: ${sanitizedContent.slice(0, 120)}`,
          data: { channelId: parsed.data.channelId, messageId: created.id, forgeId: channel.forgeId },
        }).catch(() => undefined),
      ),
    );
  }

  const io = getIo();
  io.to(`channel:${parsed.data.channelId}`).emit("message:created", {
    message: created,
    optimisticId: parsed.data.optimisticId,
  });
  const activity = {
    forgeId: channel.forgeId,
    channelId: parsed.data.channelId,
    // Thread replies don't count as unread in the channel (mentions still do).
    threadId: thread?.id ?? null,
    messageId: created.id,
    authorId: req.user!.id,
    mentionedUserIds,
    preview: sanitizedContent.slice(0, 120),
  };
  // Unread badges for a private channel go only to the people who can see it.
  if (viewerIds) {
    for (const userId of viewerIds) io.to(`user:${userId}`).emit("channel:activity", activity);
  } else {
    io.to(`forge:${channel.forgeId}`).emit("channel:activity", activity);
  }

  const botResponse = await resolveBotCommandResponse(
    req.user!.id,
    req.user!.username,
    channel.forgeId,
    channel.forge.name,
    channel.name,
    sanitizedContent,
  );
  if (botResponse) {
    const botMessage = await prisma.message.create({
      data: {
        channelId: parsed.data.channelId,
        authorId: null,
        botId: botResponse.botId,
        botName: botResponse.botName,
        botAvatar: botResponse.botAvatar,
        content: xss(botResponse.responseTemplate),
        attachments: [],
        replyToId: created.id,
      },
      include: messageInclude,
    });

    io.to(`channel:${parsed.data.channelId}`).emit("message:created", {
      message: botMessage,
    });
  }

  res.status(201).json({ message: created });
  void evaluateAchievements(req.user!.id);
});

messagesRouter.patch("/:id", async (req, res) => {
  const parsed = editMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.message.findUnique({
    where: { id: req.params.id },
    include: {
      channel: {
        select: { forgeId: true },
      },
    },
  });

  if (!existing) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  // Like Discord, only the author can edit; moderators can delete but never put words in
  // someone else's mouth.
  if (existing.authorId !== req.user!.id) {
    res.status(403).json({ error: "You cannot edit this message" });
    return;
  }
  const view = await userCanViewChannel(req.user!.id, existing.channelId);
  if (!view.ok) {
    res.status(403).json({ error: "You cannot edit this message" });
    return;
  }
  if (isTimedOut(view.member)) {
    res.status(403).json(timeoutError(view.member!.timeoutUntil));
    return;
  }
  if (view.member && view.channel) {
    const automod = await runAutoMod({ forgeId: view.channel.forgeId, channelId: view.channel.id, content: parsed.data.content, member: view.member, username: req.user!.username });
    if (automod.blocked) {
      res.status(400).json({ error: automod.message, code: "AUTOMOD", rule: automod.ruleName });
      return;
    }
  }

  const message = await prisma.message.update({
    where: { id: req.params.id },
    data: {
      content: xss(parsed.data.content.trim()),
      edited: true,
    },
    include: messageInclude,
  });

  getIo().to(`channel:${message.channelId}`).emit("message:updated", { message });
  res.json({ message });
});

/** Who may pin: the forge owner or anyone with moderateChat / manageChannels. */
async function canPinIn(userId: string, forgeId: string) {
  const [forge, membership] = await Promise.all([
    prisma.forge.findUnique({ where: { id: forgeId }, select: { ownerId: true } }),
    prisma.forgeMember.findUnique({ where: { userId_forgeId: { userId, forgeId } }, include: { roleLinks: { include: { role: true } } } }),
  ]);
  if (forge?.ownerId === userId) return true;
  return Boolean(
    membership?.roleLinks.some((link) => {
      const permissions = link.role.permissions as Record<string, boolean>;
      return Boolean(permissions.moderateChat || permissions.manageChannels);
    }),
  );
}

messagesRouter.get("/:channelId/pins", async (req, res) => {
  const channel = await prisma.channel.findUnique({ where: { id: req.params.channelId }, select: { forgeId: true } });
  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }
  const view = await userCanViewChannel(req.user!.id, req.params.channelId);
  if (!view.member) {
    res.status(403).json({ error: "Not a member of this forge" });
    return;
  }
  if (!view.ok) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }
  const messages = await prisma.message.findMany({
    where: { channelId: req.params.channelId, pinnedAt: { not: null } },
    orderBy: { pinnedAt: "desc" },
    take: 50,
    include: messageInclude,
  });
  res.json({ messages });
});

messagesRouter.post("/:id/pin", async (req, res) => {
  const existing = await prisma.message.findUnique({ where: { id: req.params.id }, include: { channel: { select: { forgeId: true } } } });
  if (!existing) {
    res.status(404).json({ error: "Message not found" });
    return;
  }
  if (!(await canPinIn(req.user!.id, existing.channel.forgeId)) || !(await userCanViewChannel(req.user!.id, existing.channelId)).ok) {
    res.status(403).json({ error: "Only moderators can pin messages" });
    return;
  }
  const pinnedCount = await prisma.message.count({ where: { channelId: existing.channelId, pinnedAt: { not: null } } });
  if (!existing.pinnedAt && pinnedCount >= 50) {
    res.status(400).json({ error: "This channel already has 50 pins. Unpin something first." });
    return;
  }
  const updated = await prisma.message.update({ where: { id: existing.id }, data: { pinnedAt: new Date(), pinnedById: req.user!.id }, include: messageInclude });
  void logForgeAction(existing.channel.forgeId, req.user!.id, "message.pin", { type: "message", id: existing.id, label: existing.content.slice(0, 80) }, { channelId: existing.channelId });
  getIo().to(`channel:${existing.channelId}`).emit("message:pinned", { message: updated, pinned: true });
  res.json({ message: updated });
});

messagesRouter.delete("/:id/pin", async (req, res) => {
  const existing = await prisma.message.findUnique({ where: { id: req.params.id }, include: { channel: { select: { forgeId: true } } } });
  if (!existing) {
    res.status(404).json({ error: "Message not found" });
    return;
  }
  if (!(await canPinIn(req.user!.id, existing.channel.forgeId)) || !(await userCanViewChannel(req.user!.id, existing.channelId)).ok) {
    res.status(403).json({ error: "Only moderators can unpin messages" });
    return;
  }
  const updated = await prisma.message.update({ where: { id: existing.id }, data: { pinnedAt: null, pinnedById: null }, include: messageInclude });
  void logForgeAction(existing.channel.forgeId, req.user!.id, "message.unpin", { type: "message", id: existing.id, label: existing.content.slice(0, 80) }, { channelId: existing.channelId });
  getIo().to(`channel:${existing.channelId}`).emit("message:pinned", { message: updated, pinned: false });
  res.json({ message: updated });
});

messagesRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.message.findUnique({
    where: { id: req.params.id },
    include: {
      channel: {
        select: { forgeId: true },
      },
    },
  });

  if (!existing) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  const isAuthor = existing.authorId === req.user!.id;
  const membership = await prisma.forgeMember.findUnique({
    where: {
      userId_forgeId: {
        userId: req.user!.id,
        forgeId: existing.channel.forgeId,
      },
    },
    include: {
      roleLinks: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!isAuthor) {
    // Moderators may remove other people's messages, but only from members they outrank
    // (the same rule as kick/ban); the forge owner can remove anyone's.
    const forge = await prisma.forge.findUnique({ where: { id: existing.channel.forgeId }, select: { ownerId: true } });
    const actor = resolveForgeAccess(
      forge?.ownerId === req.user!.id,
      (membership?.roleLinks ?? []).map((link) => ({ position: link.role.position, permissions: link.role.permissions })),
    );
    if (!membership || !hasForgePermission(actor, "moderateChat") || !(await userCanViewChannel(req.user!.id, existing.channelId)).ok) {
      res.status(403).json({ error: "You cannot delete this message" });
      return;
    }
    if (existing.authorId) {
      const authorMembership = await prisma.forgeMember.findUnique({
        where: { userId_forgeId: { userId: existing.authorId, forgeId: existing.channel.forgeId } },
        include: { roleLinks: { include: { role: true } } },
      });
      // Someone who has left the forge can't outrank anyone.
      if (authorMembership) {
        const target = resolveForgeAccess(
          forge?.ownerId === existing.authorId,
          authorMembership.roleLinks.map((link) => ({ position: link.role.position, permissions: link.role.permissions })),
        );
        if (!canModerateMember(actor, target)) {
          res.status(403).json({ error: "You can't delete messages from someone who outranks you" });
          return;
        }
      }
    }
  }

  await prisma.message.delete({ where: { id: existing.id } });
  getIo().to(`channel:${existing.channelId}`).emit("message:deleted", { messageId: existing.id });
  if (existing.threadId) {
    const updated = await prisma.thread.updateMany({ where: { id: existing.threadId, messageCount: { gt: 0 } }, data: { messageCount: { decrement: 1 } } });
    if (updated.count) {
      const thread = await prisma.thread.findUnique({ where: { id: existing.threadId }, select: { id: true, title: true, messageCount: true, lastMessageAt: true, archived: true, starterPostId: true } });
      if (thread) getIo().to(`channel:${existing.channelId}`).emit("thread:updated", { channelId: existing.channelId, messageId: thread.starterPostId, thread });
    }
  }
  if (!isAuthor) {
    const author = existing.authorId ? await prisma.user.findUnique({ where: { id: existing.authorId }, select: { username: true } }) : null;
    void logForgeAction(existing.channel.forgeId, req.user!.id, "message.delete", { type: "message", id: existing.id, label: author?.username ?? existing.botName ?? "unknown" }, { channelId: existing.channelId, excerpt: existing.content.slice(0, 200) });
  }

  res.status(204).send();
});

messagesRouter.post("/:id/reactions", async (req, res) => {
  const parsed = reactionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const message = await prisma.message.findUnique({
    where: { id: req.params.id },
    include: {
      channel: {
        select: { forgeId: true },
      },
    },
  });

  if (!message) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  const view = await userCanViewChannel(req.user!.id, message.channelId);
  if (!view.member || !view.ok) {
    res.status(403).json({ error: "Not a Forge member" });
    return;
  }
  if (isTimedOut(view.member)) {
    res.status(403).json(timeoutError(view.member.timeoutUntil));
    return;
  }

  if (/^:[a-z0-9_]{2,30}:$/.test(parsed.data.emoji)) {
    const custom = await prisma.forgeEmoji.findUnique({ where: { forgeId_name: { forgeId: message.channel.forgeId, name: parsed.data.emoji.slice(1, -1) } }, select: { id: true } });
    if (!custom) {
      res.status(400).json({ error: "That emoji isn't in this forge" });
      return;
    }
  }

  // Toggle: a second reaction with the same emoji removes it.
  const reactionKey = {
    messageId_userId_emoji: {
      messageId: req.params.id,
      userId: req.user!.id,
      emoji: parsed.data.emoji,
    },
  };
  const existingReaction = await prisma.messageReaction.findUnique({ where: reactionKey, select: { id: true } });
  if (existingReaction) {
    await prisma.messageReaction.delete({ where: { id: existingReaction.id } });
  } else {
    await prisma.messageReaction.create({
      data: {
        messageId: req.params.id,
        userId: req.user!.id,
        emoji: parsed.data.emoji,
      },
    });
  }

  const reactions = await prisma.messageReaction.findMany({ where: { messageId: req.params.id } });
  getIo().to(`channel:${message.channelId}`).emit("message:reactions", {
    messageId: message.id,
    reactions,
  });

  res.status(200).json({ reactions, active: !existingReaction });
});
