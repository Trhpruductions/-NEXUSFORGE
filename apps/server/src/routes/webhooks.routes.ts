import { Router } from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import xss from "xss";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getIo } from "../lib/realtime.js";
import { isOwnUploadUrl } from "../lib/storage.js";
import { messageInclude } from "./messages.routes.js";
import { channelAccessSelect, privateChannelViewerIds } from "../lib/channel-access.js";

/**
 * Incoming webhooks: POST /api/webhooks/:id/:token posts a message into the webhook's
 * channel. The token is the only credential (no sign-in, no CSRF), so it's long and
 * random, only its hash is stored, and each webhook is rate limited.
 */
export const webhookExecuteRouter = Router();

export function newWebhookToken() {
  return randomBytes(32).toString("base64url");
}

export function hashWebhookToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

const executeSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  username: z.string().trim().min(1).max(80).optional(),
  // Only images from our own storage, so a webhook can't plant a tracking pixel.
  avatarUrl: z.string().url().max(2048).optional(),
});

const hits = new Map<string, number[]>();
const PER_MINUTE = 30;

webhookExecuteRouter.post("/:id/:token", async (req, res) => {
  const webhook = await prisma.channelWebhook.findUnique({ where: { id: req.params.id } }).catch(() => null);
  const given = Buffer.from(hashWebhookToken(String(req.params.token)));
  if (!webhook || given.length !== Buffer.from(webhook.tokenHash).length || !timingSafeEqual(given, Buffer.from(webhook.tokenHash))) {
    res.status(401).json({ error: "Invalid webhook" });
    return;
  }
  const now = Date.now();
  const recent = (hits.get(webhook.id) ?? []).filter((at) => now - at < 60_000);
  if (recent.length >= PER_MINUTE) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "This webhook is posting too fast (30 per minute)" });
    return;
  }
  recent.push(now);
  hits.set(webhook.id, recent);

  const parsed = executeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Send JSON like {\"content\": \"Hello\"} (1-2000 characters)" });
    return;
  }
  const channel = await prisma.channel.findUnique({ where: { id: webhook.channelId }, select: { ...channelAccessSelect, type: true } });
  if (!channel || (channel.type !== "TEXT" && channel.type !== "ANNOUNCEMENT")) {
    res.status(410).json({ error: "The webhook's channel no longer exists" });
    return;
  }
  const avatar = parsed.data.avatarUrl && isOwnUploadUrl(parsed.data.avatarUrl) ? parsed.data.avatarUrl : webhook.avatarUrl;
  const message = await prisma.message.create({
    data: {
      channelId: channel.id,
      authorId: null,
      webhookId: webhook.id,
      botName: xss(parsed.data.username ?? webhook.name),
      botAvatar: avatar,
      // Webhooks never ping: @everyone / @here / mentions are shown but notify nobody.
      content: xss(parsed.data.content),
      attachments: [],
    },
    include: messageInclude,
  });
  await prisma.channelWebhook.update({ where: { id: webhook.id }, data: { lastUsedAt: new Date() } });
  try {
    const io = getIo();
    io.to(`channel:${channel.id}`).emit("message:created", { message });
    const activity = { forgeId: channel.forgeId, channelId: channel.id, messageId: message.id, authorId: null, mentionedUserIds: [], preview: message.content.slice(0, 120), threadId: null };
    // Unread badges for a private channel only go to the people who can see it.
    if (channel.isPrivate) {
      for (const userId of await privateChannelViewerIds(channel)) io.to(`user:${userId}`).emit("channel:activity", activity);
    } else {
      io.to(`forge:${channel.forgeId}`).emit("channel:activity", activity);
    }
  } catch {
    // realtime not ready
  }
  res.status(200).json({ id: message.id, channelId: channel.id });
});
