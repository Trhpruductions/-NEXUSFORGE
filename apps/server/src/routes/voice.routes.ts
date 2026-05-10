import { Router } from "express";
import { AccessToken } from "livekit-server-sdk";
import { z } from "zod";
import { env } from "../config/env.js";
import { getIo } from "../lib/realtime.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

const tokenSchema = z.object({
  channelId: z.string().uuid(),
});

const voiceStateSchema = z.object({
  channelId: z.string().uuid(),
  muted: z.boolean().optional(),
  deafened: z.boolean().optional(),
  screenSharing: z.boolean().optional(),
  noiseSuppression: z.boolean().optional(),
  voiceActivity: z.boolean().optional(),
});

export const voiceRouter = Router();

voiceRouter.use(requireAuth);
voiceRouter.use(requireCsrf);

voiceRouter.post("/token", async (req, res) => {
  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET || !env.LIVEKIT_WS_URL) {
    res.status(503).json({ error: "LiveKit is not configured" });
    return;
  }

  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const channel = await prisma.channel.findUnique({
    where: { id: parsed.data.channelId },
    select: { id: true, forgeId: true, type: true },
  });

  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  if (channel.type !== "VOICE" && channel.type !== "STAGE") {
    res.status(400).json({ error: "Voice token only valid for voice/stage channels" });
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
    res.status(403).json({ error: "Not a member of this Forge" });
    return;
  }

  const roomName = `forge-${channel.forgeId}-channel-${channel.id}`;

  const accessToken = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: req.user!.id,
    name: req.user!.username,
    ttl: "30m",
  });

  accessToken.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  res.json({
    token: await accessToken.toJwt(),
    wsUrl: env.LIVEKIT_WS_URL,
    roomName,
  });
});

voiceRouter.post("/state", async (req, res) => {
  const parsed = voiceStateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const channel = await prisma.channel.findUnique({
    where: { id: parsed.data.channelId },
    select: { forgeId: true, type: true },
  });

  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  if (channel.type !== "VOICE" && channel.type !== "STAGE") {
    res.status(400).json({ error: "Invalid voice channel" });
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
    res.status(403).json({ error: "Not a member of this Forge" });
    return;
  }

  getIo().to(`voice:${parsed.data.channelId}`).emit("voice:state", {
    channelId: parsed.data.channelId,
    userId: req.user!.id,
    username: req.user!.username,
    state: {
      muted: parsed.data.muted ?? false,
      deafened: parsed.data.deafened ?? false,
      screenSharing: parsed.data.screenSharing ?? false,
      noiseSuppression: parsed.data.noiseSuppression ?? true,
      voiceActivity: parsed.data.voiceActivity ?? true,
    },
  });

  res.status(202).json({ ok: true });
});
