/**
 * Things only you can see: messages you've saved for later, and private notes you keep
 * about other people.
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { userCanViewChannel } from "../lib/channel-access.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

export const meRouter = Router();
meRouter.use(requireAuth);
meRouter.use(requireCsrf);

const SAVED_LIMIT = 500;
const kindSchema = z.enum(["CHANNEL", "DM"]);
const saveSchema = z.object({ kind: kindSchema, messageId: z.string().uuid() });
const noteSchema = z.object({ note: z.string().max(256) });

const authorSelect = { select: { id: true, username: true, avatar: true } } as const;

/** Can this person still open the DM thread? */
async function inDmThread(userId: string, threadId: string) {
  return Boolean(await prisma.directMessageParticipant.findUnique({ where: { threadId_userId: { threadId, userId } }, select: { id: true } }));
}

// ---------------------------------------------------------------- saved messages
/** Your saved messages, newest first. Anything you can no longer open is left out. */
meRouter.get("/saved", async (req, res) => {
  const userId = req.user!.id;
  const rows = await prisma.savedMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: SAVED_LIMIT,
    include: {
      message: {
        select: {
          id: true, content: true, createdAt: true, channelId: true, threadId: true, attachments: true, botName: true,
          author: authorSelect,
          channel: { select: { id: true, name: true, forgeId: true, forge: { select: { name: true, icon: true } } } },
        },
      },
      dmMessage: {
        select: {
          id: true, content: true, createdAt: true, threadId: true, attachments: true,
          author: authorSelect,
          thread: { select: { id: true, isGroup: true, name: true, participants: { select: { userId: true, user: { select: { username: true } } } } } },
        },
      },
    },
  });

  // Check each channel / DM once.
  const channelOk = new Map<string, boolean>();
  const channelIds = new Set<string>(rows.flatMap((row) => (row.message ? [row.message.channelId] : [])));
  for (const channelId of channelIds) {
    channelOk.set(channelId, (await userCanViewChannel(userId, channelId)).ok);
  }

  const items = rows.flatMap((row) => {
    const attachmentCount = (value: unknown) => (Array.isArray(value) ? value.length : 0);
    if (row.message) {
      if (!channelOk.get(row.message.channelId)) return [];
      const m = row.message;
      return [{
        id: row.id,
        kind: "CHANNEL" as const,
        savedAt: row.createdAt,
        message: { id: m.id, content: m.content, createdAt: m.createdAt, attachments: attachmentCount(m.attachments), author: m.author ?? { id: null, username: m.botName ?? "Bot", avatar: null } },
        where: { forgeId: m.channel.forgeId, forgeName: m.channel.forge.name, forgeIcon: m.channel.forge.icon, channelId: m.channel.id, channelName: m.channel.name, threadId: m.threadId },
      }];
    }
    if (row.dmMessage) {
      const d = row.dmMessage;
      if (!d.thread.participants.some((p) => p.userId === userId)) return [];
      const others = d.thread.participants.filter((p) => p.userId !== userId).map((p) => p.user.username);
      return [{
        id: row.id,
        kind: "DM" as const,
        savedAt: row.createdAt,
        message: { id: d.id, content: d.content, createdAt: d.createdAt, attachments: attachmentCount(d.attachments), author: d.author },
        where: { dmThreadId: d.threadId, label: d.thread.isGroup ? d.thread.name || others.join(", ") || "Group chat" : others[0] ?? "Direct message" },
      }];
    }
    return [];
  });
  res.json({ items });
});

/** Just the ids, so message lists can show which ones you've saved. */
meRouter.get("/saved/ids", async (req, res) => {
  const rows = await prisma.savedMessage.findMany({ where: { userId: req.user!.id }, select: { messageId: true, dmMessageId: true }, take: SAVED_LIMIT });
  res.json({
    channel: rows.map((row) => row.messageId).filter(Boolean),
    dm: rows.map((row) => row.dmMessageId).filter(Boolean),
  });
});

meRouter.put("/saved", async (req, res) => {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  const userId = req.user!.id;
  const { kind, messageId } = parsed.data;

  if (kind === "CHANNEL") {
    const message = await prisma.message.findUnique({ where: { id: messageId }, select: { channelId: true } });
    if (!message || !(await userCanViewChannel(userId, message.channelId)).ok) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
  } else {
    const message = await prisma.directMessage.findUnique({ where: { id: messageId }, select: { threadId: true } });
    if (!message || !(await inDmThread(userId, message.threadId))) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
  }

  const existing = await prisma.savedMessage.findFirst({ where: { userId, ...(kind === "CHANNEL" ? { messageId } : { dmMessageId: messageId }) }, select: { id: true } });
  if (existing) {
    res.json({ saved: true });
    return;
  }
  if ((await prisma.savedMessage.count({ where: { userId } })) >= SAVED_LIMIT) {
    res.status(400).json({ error: `You can save up to ${SAVED_LIMIT} messages. Remove some first.` });
    return;
  }
  await prisma.savedMessage.create({ data: { userId, ...(kind === "CHANNEL" ? { messageId } : { dmMessageId: messageId }) } });
  res.status(201).json({ saved: true });
});

meRouter.delete("/saved/:kind/:messageId", async (req, res) => {
  const kind = kindSchema.safeParse(req.params.kind);
  if (!kind.success) {
    res.status(400).json({ error: "Invalid kind" });
    return;
  }
  await prisma.savedMessage.deleteMany({
    where: { userId: req.user!.id, ...(kind.data === "CHANNEL" ? { messageId: req.params.messageId } : { dmMessageId: req.params.messageId }) },
  });
  res.json({ saved: false });
});

// ---------------------------------------------------------------- notes
meRouter.get("/notes/:userId", async (req, res) => {
  const row = await prisma.userNote.findUnique({ where: { authorId_targetId: { authorId: req.user!.id, targetId: req.params.userId } }, select: { note: true, updatedAt: true } });
  res.json({ note: row?.note ?? "", updatedAt: row?.updatedAt ?? null });
});

/** Save your note about someone; an empty note removes it. */
meRouter.put("/notes/:userId", async (req, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Notes can be up to 256 characters" });
    return;
  }
  const authorId = req.user!.id;
  const targetId = req.params.userId;
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, deletedAt: true } });
  if (!target || target.deletedAt) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const note = parsed.data.note.trim();
  if (!note) {
    await prisma.userNote.deleteMany({ where: { authorId, targetId } });
    res.json({ note: "" });
    return;
  }
  const row = await prisma.userNote.upsert({
    where: { authorId_targetId: { authorId, targetId } },
    create: { authorId, targetId, note },
    update: { note },
    select: { note: true, updatedAt: true },
  });
  res.json(row);
});
