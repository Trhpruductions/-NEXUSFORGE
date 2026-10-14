import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { hiddenChannelIdsForUser, userCanViewChannel } from "../lib/channel-access.js";

/**
 * Unread tracking. A ChannelReadState row per (user, channel) stores the last read time and a
 * pending mention counter. Unread counts are computed on demand from message timestamps.
 */
export const readsRouter = Router();

readsRouter.use(requireAuth);
readsRouter.use(requireCsrf);

type ChannelUnread = { channelId: string; unread: number; mentions: number; lastReadAt: string | null };

async function computeForgeUnreads(userId: string, forgeId: string): Promise<ChannelUnread[]> {
  const hidden = await hiddenChannelIdsForUser(userId, forgeId);
  const channels = await prisma.channel.findMany({
    where: { forgeId, type: { in: ["TEXT", "ANNOUNCEMENT", "FORUM"] }, id: { notIn: hidden } },
    select: { id: true },
  });
  if (!channels.length) return [];

  const channelIds = channels.map((channel) => channel.id);
  const states = await prisma.channelReadState.findMany({
    where: { userId, channelId: { in: channelIds } },
  });
  const stateByChannel = new Map<string, (typeof states)[number]>(states.map((state) => [state.channelId, state] as const));

  const counts = await countUnread(userId, channelIds);
  return channelIds.map((channelId) => {
    const state = stateByChannel.get(channelId);
    return {
      channelId,
      unread: counts.get(channelId) ?? 0,
      mentions: state?.mentionCount ?? 0,
      lastReadAt: state?.lastReadAt.toISOString() ?? null,
    };
  });
}

/**
 * Unread messages per channel in ONE query (it used to be one count per channel, and
 * the server rail asked for every channel of every forge on each load). Counts channel
 * messages (not thread replies) newer than your last read that someone else sent,
 * bots and webhooks included.
 */
async function countUnread(userId: string, channelIds: string[]) {
  if (!channelIds.length) return new Map<string, number>();
  const rows: Array<{ channelId: string; unread: bigint }> = await prisma.$queryRaw(Prisma.sql`
    SELECT m."channelId" AS "channelId", COUNT(*) AS unread
    FROM "Message" m
    LEFT JOIN "ChannelReadState" s ON s."channelId" = m."channelId" AND s."userId" = ${userId}
    WHERE m."channelId" IN (${Prisma.join(channelIds)})
      AND m."threadId" IS NULL
      AND m."authorId" IS DISTINCT FROM ${userId}
      AND (s."lastReadAt" IS NULL OR m."createdAt" > s."lastReadAt")
    GROUP BY m."channelId"`);
  return new Map(rows.map((row) => [row.channelId, Number(row.unread)] as const));
}

/** Per-forge totals for the server rail. */
readsRouter.get("/summary", async (req, res) => {
  const memberships = await prisma.forgeMember.findMany({
    where: { userId: req.user!.id },
    select: { forgeId: true, mutedUntil: true, notifyLevel: true },
  });

  const now = Date.now();
  const forges = await Promise.all(
    memberships.map(async ({ forgeId, mutedUntil, notifyLevel }) => {
      const channels = await computeForgeUnreads(req.user!.id, forgeId);
      // A muted forge shows no unread dot, only mention badges (Discord does the same);
      // "Nothing" hides those too.
      const muted = Boolean(mutedUntil && mutedUntil.getTime() > now);
      return {
        forgeId,
        muted,
        unread: muted ? 0 : channels.reduce((sum, entry) => sum + entry.unread, 0),
        mentions: notifyLevel === "NONE" ? 0 : channels.reduce((sum, entry) => sum + entry.mentions, 0),
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

  const view = await userCanViewChannel(req.user!.id, channel.id);
  if (!view.member) {
    res.status(403).json({ error: "Not a Forge member" });
    return;
  }
  if (!view.ok) {
    res.status(404).json({ error: "Channel not found" });
    return;
  }

  const state = await prisma.channelReadState.upsert({
    where: { userId_channelId: { userId: req.user!.id, channelId: channel.id } },
    update: { lastReadAt: new Date(), mentionCount: 0 },
    create: { userId: req.user!.id, channelId: channel.id, lastReadAt: new Date(), mentionCount: 0 },
  });

  res.json({ channelId: channel.id, lastReadAt: state.lastReadAt.toISOString() });
});

/** Every channel of these forges the person can see, marked read now with mentions cleared. */
async function markForgesRead(userId: string, forgeIds: string[]) {
  const now = new Date();
  let channels = 0;
  for (const forgeId of forgeIds) {
    const hidden = await hiddenChannelIdsForUser(userId, forgeId);
    const ids = (
      await prisma.channel.findMany({
        where: { forgeId, type: { in: ["TEXT", "ANNOUNCEMENT", "FORUM"] }, id: { notIn: hidden } },
        select: { id: true },
      })
    ).map((channel) => channel.id);
    if (!ids.length) continue;
    await prisma.$transaction([
      prisma.channelReadState.updateMany({ where: { userId, channelId: { in: ids } }, data: { lastReadAt: now, mentionCount: 0 } }),
      prisma.channelReadState.createMany({ data: ids.map((channelId) => ({ userId, channelId, lastReadAt: now, mentionCount: 0 })), skipDuplicates: true }),
    ]);
    channels += ids.length;
  }
  return channels;
}

/** "Mark as read" on a server: clears every channel's unread dot and mention badge. */
readsRouter.post("/forge/:forgeId", async (req, res) => {
  const membership = await prisma.forgeMember.findUnique({
    where: { userId_forgeId: { userId: req.user!.id, forgeId: req.params.forgeId } },
    select: { id: true },
  });
  if (!membership) {
    res.status(403).json({ error: "Not a Forge member" });
    return;
  }
  res.json({ forgeId: req.params.forgeId, channels: await markForgesRead(req.user!.id, [req.params.forgeId]) });
});

/** Mark every server you're in as read. */
readsRouter.post("/all", async (req, res) => {
  const memberships = await prisma.forgeMember.findMany({ where: { userId: req.user!.id }, select: { forgeId: true } });
  res.json({ forges: memberships.length, channels: await markForgesRead(req.user!.id, memberships.map((entry) => entry.forgeId)) });
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
