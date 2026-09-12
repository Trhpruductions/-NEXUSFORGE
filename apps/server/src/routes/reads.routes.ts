import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

/**
 * Unread tracking. A ChannelReadState row per (user, channel) stores the last read time and a
 * pending mention counter. Unread counts are computed on demand from message timestamps.
 */
export const readsRouter = Router();

readsRouter.use(requireAuth);
readsRouter.use(requireCsrf);

type ChannelUnread = { channelId: string; unread: number; mentions: number; lastReadAt: string | null };

async function computeForgeUnreads(userId: string, forgeId: string): Promise<ChannelUnread[]> {
  const channels = await prisma.channel.findMany({
    where: { forgeId, type: { in: ["TEXT", "ANNOUNCEMENT"] } },
    select: { id: true },
  });
  if (!channels.length) return [];

  const channelIds = channels.map((channel) => channel.id);
  const states = await prisma.channelReadState.findMany({
    where: { userId, channelId: { in: channelIds } },
  });
  const stateByChannel = new Map<string, (typeof states)[number]>(states.map((state) => [state.channelId, state] as const));

  const results = await Promise.all(
    channelIds.map(async (channelId) => {
      const state = stateByChannel.get(channelId);
      const unread = await prisma.message.count({
        where: {
          channelId,
          ...(state ? { createdAt: { gt: state.lastReadAt } } : {}),
          NOT: { authorId: userId },
        },
      });
      return {
        channelId,
        unread,
        mentions: state?.mentionCount ?? 0,
        lastReadAt: state?.lastReadAt.toISOString() ?? null,
      };
    }),
  );
  return results;
}

/** Per-forge totals for the server rail. */
readsRouter.get("/summary", async (req, res) => {
  const memberships = await prisma.forgeMember.findMany({
    where: { userId: req.user!.id },
    select: { forgeId: true },
  });

  const forges = await Promise.all(
    memberships.map(async ({ forgeId }) => {
      const channels = await computeForgeUnreads(req.user!.id, forgeId);
      return {
        forgeId,
        unread: channels.reduce((sum, entry) => sum + entry.unread, 0),
        mentions: channels.reduce((sum, entry) => sum + entry.mentions, 0),
      };
    }),
  );

  res.json({ forges });
});

/** Per-channel counts for one forge's sidebar. */
readsRouter.get("/forge/:forgeId", async (req, res) => {
  const membership = await prisma.forgeMember.findUnique({
    where: { userId_forgeId: { userId: req.user!.id, forgeId: req.params.forgeId } },
    select: { id: true },
  });
  if (!membership) {
    res.status(403).json({ error: "Not a Forge member" });
    return;
  }

  const channels = await computeForgeUnreads(req.user!.id, req.params.forgeId);
  res.json({ forgeId: req.params.forgeId, channels });
});

/** Mark a channel as read up to now and clear pending mentions. */
readsRouter.post("/channel/:channelId", async (req, res) => {
  const channel = await prisma.channel.findUnique({
    where: { id: req.params.channelId },
    select: { id: true, forgeId: true },
  });
  if (!channel) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  const membership = await prisma.forgeMember.findUnique({
    where: { userId_forgeId: { userId: req.user!.id, forgeId: channel.forgeId } },
    select: { id: true },
  });
  if (!membership) {
    res.status(403).json({ error: "Not a Forge member" });
    return;
  }

  const state = await prisma.channelReadState.upsert({
    where: { userId_channelId: { userId: req.user!.id, channelId: channel.id } },
    update: { lastReadAt: new Date(), mentionCount: 0 },
    create: { userId: req.user!.id, channelId: channel.id, lastReadAt: new Date(), mentionCount: 0 },
  });

  res.json({ channelId: channel.id, lastReadAt: state.lastReadAt.toISOString() });
});

/** Called by the message router after a message is stored. Bumps mention counters for mentioned members. */
export async function recordMentions(channelId: string, mentionedUserIds: string[]): Promise<void> {
  if (!mentionedUserIds.length) return;
  await Promise.all(
    mentionedUserIds.map((userId) =>
      prisma.channelReadState.upsert({
        where: { userId_channelId: { userId, channelId } },
        update: { mentionCount: { increment: 1 } },
        // A brand-new state starts "read up to the epoch" so the mention itself counts as unread.
        create: { userId, channelId, lastReadAt: new Date(0), mentionCount: 1 },
      }),
    ),
  );
}
