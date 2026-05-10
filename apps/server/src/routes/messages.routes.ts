import { Router } from "express";
import xss from "xss";
import { z } from "zod";
import { renderBotCommandResponse } from "../lib/bot-commands.js";
import { prisma } from "../lib/prisma.js";
import { createNotification } from "../lib/notifications.js";
import { getIo } from "../lib/realtime.js";
import { antiSpam } from "../middleware/anti-spam.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { messageRateLimit } from "../middleware/rate-limit.js";

const createMessageSchema = z.object({
  channelId: z.string().uuid(),
  content: z.string().min(1).max(4000),
  attachments: z.array(z.string().url()).max(8).optional(),
  replyToId: z.string().uuid().optional(),
  optimisticId: z.string().optional(),
});

const editMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

const reactionSchema = z.object({
  emoji: z.string().min(1).max(32),
});

export const messagesRouter = Router();

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

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { forgeId: true },
  });

  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  const member = await prisma.forgeMember.findUnique({
    where: {
      userId_forgeId: {
        userId: req.user!.id,
        forgeId: channel.forgeId,
      },
    },
  });

  if (!member) {
    res.status(403).json({ error: "Not a Forge member" });
    return;
  }

  const messages = await prisma.message.findMany({
    where: { channelId },
    take: limit,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor },
        }
      : {}),
    orderBy: { createdAt: "desc" },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          avatar: true,
          premium: true,
        },
      },
      reactions: true,
    },
  });

  res.json({
    messages: messages.reverse(),
    nextCursor: messages.length === limit ? messages[messages.length - 1]?.id : null,
  });
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
      id: true,
      forgeId: true,
      name: true,
      type: true,
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

  if (channel.type !== "TEXT" && channel.type !== "ANNOUNCEMENT") {
    res.status(400).json({ error: "Messages are only allowed in text-based channels" });
    return;
  }

  const membership = await prisma.forgeMember.findUnique({
    where: {
      userId_forgeId: {
        userId: req.user!.id,
        forgeId: channel.forgeId,
      },
    },
  });

  if (!membership) {
    res.status(403).json({ error: "Not a Forge member" });
    return;
  }

  const sanitizedContent = xss(parsed.data.content.trim());
  const created = await prisma.message.create({
    data: {
      channelId: parsed.data.channelId,
      authorId: req.user!.id,
      content: sanitizedContent,
      attachments: parsed.data.attachments ?? [],
      replyToId: parsed.data.replyToId,
    },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          avatar: true,
          premium: true,
        },
      },
      reactions: true,
    },
  });

  const mentionMatches = Array.from(parsed.data.content.matchAll(/@([a-zA-Z0-9_]+)/g));
  const mentionedUsernames = [...new Set(mentionMatches.map((match) => match[1]))];

  if (mentionedUsernames.length) {
    const mentionedUsers = await prisma.user.findMany({
      where: {
        username: { in: mentionedUsernames },
        id: { not: req.user!.id },
      },
      select: { id: true, username: true },
    });

    await Promise.all(
      mentionedUsers.map((mentionedUser) =>
        createNotification({
          userId: mentionedUser.id,
          type: "MENTION",
          title: "You were mentioned",
          body: `${req.user!.username} mentioned you in a Forge message.`,
          data: { channelId: parsed.data.channelId, messageId: created.id },
        }),
      ),
    );
  }

  const io = getIo();
  io.to(`channel:${parsed.data.channelId}`).emit("message:created", {
    message: created,
    optimisticId: parsed.data.optimisticId,
  });

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
      include: {
        author: {
          select: {
            id: true,
            username: true,
            avatar: true,
            premium: true,
          },
        },
        reactions: true,
      },
    });

    io.to(`channel:${parsed.data.channelId}`).emit("message:created", {
      message: botMessage,
    });
  }

  res.status(201).json({ message: created });
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

  const canModerate = membership?.roleLinks.some((link) => {
    const permissions = link.role.permissions as Record<string, boolean>;
    return Boolean(permissions.moderateChat);
  });

  if (!isAuthor && !canModerate) {
    res.status(403).json({ error: "You cannot edit this message" });
    return;
  }

  const message = await prisma.message.update({
    where: { id: req.params.id },
    data: {
      content: xss(parsed.data.content.trim()),
      edited: true,
    },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          avatar: true,
          premium: true,
        },
      },
      reactions: true,
    },
  });

  getIo().to(`channel:${message.channelId}`).emit("message:updated", { message });
  res.json({ message });
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

  const canModerate = membership?.roleLinks.some((link) => {
    const permissions = link.role.permissions as Record<string, boolean>;
    return Boolean(permissions.moderateChat);
  });

  if (!isAuthor && !canModerate) {
    res.status(403).json({ error: "You cannot delete this message" });
    return;
  }

  await prisma.message.delete({ where: { id: existing.id } });
  getIo().to(`channel:${existing.channelId}`).emit("message:deleted", { messageId: existing.id });

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

  const member = await prisma.forgeMember.findUnique({
    where: {
      userId_forgeId: {
        userId: req.user!.id,
        forgeId: message.channel.forgeId,
      },
    },
  });

  if (!member) {
    res.status(403).json({ error: "Not a Forge member" });
    return;
  }

  await prisma.messageReaction.upsert({
    where: {
      messageId_userId_emoji: {
        messageId: req.params.id,
        userId: req.user!.id,
        emoji: parsed.data.emoji,
      },
    },
    update: {},
    create: {
      messageId: req.params.id,
      userId: req.user!.id,
      emoji: parsed.data.emoji,
    },
  });

  const reactions = await prisma.messageReaction.findMany({ where: { messageId: req.params.id } });
  getIo().to(`channel:${message.channelId}`).emit("message:reactions", {
    messageId: message.id,
    reactions,
  });

  res.status(201).json({ reactions });
});
