import { Router } from "express";
import { z } from "zod";
import xss from "xss";
import { prisma } from "../lib/prisma.js";
import { getIo } from "../lib/realtime.js";
import { hasForgePermission } from "../lib/forge-permissions.js";
import { isTimedOut, userCanViewChannel } from "../lib/channel-access.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { messageInclude } from "./messages.routes.js";

/**
 * Threads: side conversations started from a message. Replies are normal messages in the
 * parent channel with threadId set (posted through POST /api/messages), so every channel
 * rule applies to them; this router creates, lists, reads and archives threads.
 */
export const threadsRouter = Router();

threadsRouter.use(requireAuth);
threadsRouter.use(requireCsrf);

export const threadSummarySelect = { id: true, title: true, messageCount: true, lastMessageAt: true, archived: true, creatorId: true, createdAt: true } as const;

function emit(channelId: string, event: string, payload: Record<string, unknown>) {
  try {
    getIo().to(`channel:${channelId}`).emit(event, payload);
  } catch {
    // realtime not ready
  }
}

const createSchema = z.object({
  messageId: z.string().uuid(),
  title: z.string().trim().min(1).max(100),
});

threadsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Give the thread a name (up to 100 characters)" });
    return;
  }
  const starter = await prisma.message.findUnique({
    where: { id: parsed.data.messageId },
    select: { id: true, channelId: true, threadId: true, startedThread: { select: { id: true } }, channel: { select: { type: true } } },
  });
  const view = starter ? await userCanViewChannel(req.user!.id, starter.channelId) : null;
  if (!starter || !view?.ok) {
    res.status(404).json({ error: "Message not found" });
    return;
  }
  if (starter.channel.type !== "TEXT" && starter.channel.type !== "ANNOUNCEMENT") {
    res.status(400).json({ error: "Threads can only start in text channels" });
    return;
  }
  if (starter.threadId) {
    res.status(400).json({ error: "You can't start a thread inside a thread" });
    return;
  }
  if (starter.startedThread) {
    res.status(409).json({ error: "This message already has a thread", threadId: starter.startedThread.id });
    return;
  }
  if (isTimedOut(view.member)) {
    res.status(403).json({ error: "You're timed out", code: "TIMED_OUT" });
    return;
  }
  const thread = await prisma.thread.create({
    data: { channelId: starter.channelId, title: xss(parsed.data.title), starterPostId: starter.id, creatorId: req.user!.id },
    select: { ...threadSummarySelect, channelId: true, starterPostId: true },
  });
  emit(starter.channelId, "thread:updated", { channelId: starter.channelId, messageId: starter.id, thread });
  res.status(201).json({ thread });
});

threadsRouter.get("/channel/:channelId", async (req, res) => {
  const view = await userCanViewChannel(req.user!.id, req.params.channelId);
  if (!view.ok) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }
  const threads = await prisma.thread.findMany({
    where: { channelId: req.params.channelId },
    orderBy: [{ archived: "asc" }, { lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 50,
    select: { ...threadSummarySelect, starterPostId: true },
  });
  res.json({ threads });
});

threadsRouter.get("/:id", async (req, res) => {
  const thread = await prisma.thread.findUnique({
    where: { id: req.params.id },
    select: { ...threadSummarySelect, channelId: true, starterPostId: true, starterMessage: { include: messageInclude } },
  });
  const view = thread ? await userCanViewChannel(req.user!.id, thread.channelId) : null;
  if (!thread || !view?.ok) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }
  const messages = await prisma.message.findMany({
    where: { threadId: thread.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    include: messageInclude,
  });
  res.json({ thread, messages: messages.reverse() });
});

const updateSchema = z
  .object({ title: z.string().trim().min(1).max(100).optional(), archived: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied." });

threadsRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  const existing = await prisma.thread.findUnique({ where: { id: req.params.id }, select: { id: true, channelId: true, creatorId: true, starterPostId: true } });
  const view = existing ? await userCanViewChannel(req.user!.id, existing.channelId) : null;
  if (!existing || !view?.ok || !view.member) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }
  const moderator = hasForgePermission(view.member.access, "moderateChat") || hasForgePermission(view.member.access, "manageChannels");
  if (existing.creatorId !== req.user!.id && !moderator) {
    res.status(403).json({ error: "Only the person who started the thread or a moderator can change it" });
    return;
  }
  const thread = await prisma.thread.update({
    where: { id: existing.id },
    data: { title: parsed.data.title ? xss(parsed.data.title) : undefined, archived: parsed.data.archived },
    select: { ...threadSummarySelect, channelId: true, starterPostId: true },
  });
  emit(existing.channelId, "thread:updated", { channelId: existing.channelId, messageId: existing.starterPostId, thread });
  res.json({ thread });
});
