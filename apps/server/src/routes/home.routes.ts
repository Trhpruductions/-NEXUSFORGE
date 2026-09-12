import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

/** Aggregated data for the Home dashboard of the selected forge. */
export const homeRouter = Router();

homeRouter.use(requireAuth);

const startedAt = Date.now();

homeRouter.get("/summary", async (req, res) => {
  const forgeId = typeof req.query.forgeId === "string" ? req.query.forgeId : undefined;

  const memberships = await prisma.forgeMember.findMany({
    where: { userId: req.user!.id },
    orderBy: { joinedAt: "asc" },
    select: { forgeId: true },
  });
  const forgeIds = memberships.map((entry) => entry.forgeId);
  const activeForgeId = forgeId && forgeIds.includes(forgeId) ? forgeId : forgeIds[0];

  const forge = activeForgeId
    ? await prisma.forge.findUnique({
        where: { id: activeForgeId },
        select: {
          id: true,
          name: true,
          description: true,
          icon: true,
          banner: true,
          inviteCode: true,
          ownerId: true,
          category: true,
          _count: { select: { members: true, channels: true } },
        },
      })
    : null;

  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  const [onlineCount, featuredEvent, recentMessages, topCreators, liveNow, upcomingCount] = await Promise.all([
    forge
      ? prisma.forgeMember.count({
          where: { forgeId: forge.id, user: { OR: [{ status: { in: ["ONLINE", "IDLE", "DND"] } }, { lastSeenAt: { gte: fiveMinutesAgo } }] } },
        })
      : Promise.resolve(0),
    prisma.event.findFirst({
      where: {
        AND: [
          { OR: [{ forgeId: null }, { forgeId: { in: forgeIds } }] },
          { status: { in: ["SCHEDULED", "LIVE"] } },
          { OR: [{ status: "LIVE" }, { startsAt: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) } }] },
        ],
      },
      orderBy: [{ status: "desc" }, { startsAt: "asc" }],
      include: { _count: { select: { participants: true } }, forge: { select: { id: true, name: true } } },
    }),
    forge
      ? prisma.message.findMany({
          where: { channel: { forgeId: forge.id, type: { in: ["TEXT", "ANNOUNCEMENT"] } }, authorId: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 6,
          include: {
            author: { select: { id: true, username: true, displayName: true, avatar: true } },
            channel: { select: { id: true, name: true } },
            _count: { select: { reactions: true, replies: true } },
          },
        })
      : Promise.resolve([]),
    prisma.user.findMany({
      where: { isCreator: true },
      orderBy: [{ followers: { _count: "desc" } }, { reputation: "desc" }],
      take: 6,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        creatorStatus: true,
        liveViewerCount: true,
        _count: { select: { followers: true } },
      },
    }),
    prisma.user.findMany({
      where: { creatorStatus: "LIVE" },
      orderBy: { liveViewerCount: "desc" },
      take: 4,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        livePlatform: true,
        liveStreamTitle: true,
        liveStreamUrl: true,
        liveGameCategory: true,
        liveViewerCount: true,
        liveStartedAt: true,
      },
    }),
    prisma.event.count({ where: { OR: [{ forgeId: null }, { forgeId: { in: forgeIds } }], status: "SCHEDULED", startsAt: { gte: now } } }),
  ]);

  // If no creators are flagged yet, fall back to the most-followed members so the panel is never empty.
  const creators = topCreators.length
    ? topCreators
    : await prisma.user.findMany({
        orderBy: [{ followers: { _count: "desc" } }, { reputation: "desc" }],
        take: 6,
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
          creatorStatus: true,
          liveViewerCount: true,
          _count: { select: { followers: true } },
        },
      });

  res.json({
    forge: forge
      ? {
          id: forge.id,
          name: forge.name,
          description: forge.description,
          icon: forge.icon,
          banner: forge.banner,
          inviteCode: forge.inviteCode,
          ownerId: forge.ownerId,
          category: forge.category,
        }
      : null,
    stats: {
      members: forge?._count.members ?? 0,
      online: onlineCount,
      channels: forge?._count.channels ?? 0,
      upcomingEvents: upcomingCount,
      uptimeHours: Math.floor((Date.now() - startedAt) / 3_600_000),
    },
    featuredEvent,
    recentActivity: recentMessages.map((message) => ({
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      channel: message.channel,
      author: message.author,
      reactions: message._count.reactions,
      replies: message._count.replies,
    })),
    topCreators: creators.map((creator) => ({
      id: creator.id,
      username: creator.username,
      displayName: creator.displayName,
      avatar: creator.avatar,
      live: creator.creatorStatus === "LIVE",
      followers: creator._count.followers,
      viewers: creator.liveViewerCount,
    })),
    liveNow,
  });
});
