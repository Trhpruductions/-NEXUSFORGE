import { Router } from "express";
import xss from "xss";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { createNotification } from "../lib/notifications.js";
import { getIo } from "../lib/realtime.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

/** Follows, posts/clips, and the public profile summary used by the Profile page. */
export const socialRouter = Router();

socialRouter.use(requireAuth);
socialRouter.use(requireCsrf);

const createPostSchema = z.object({
  kind: z.enum(["POST", "CLIP"]).default("POST"),
  content: z.string().trim().min(1).max(2000),
  mediaUrl: z.string().url().optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(8).optional(),
});

const postInclude = {
  author: { select: { id: true, username: true, displayName: true, avatar: true, isStaff: true, isPartner: true, isCreator: true } },
  _count: { select: { likes: true } },
} as const;

async function attachLiked<T extends { id: string }>(posts: T[], userId: string) {
  if (!posts.length) return posts.map((post) => ({ ...post, liked: false }));
  const likes = await prisma.postLike.findMany({
    where: { userId, postId: { in: posts.map((post) => post.id) } },
    select: { postId: true },
  });
  const liked = new Set(likes.map((like) => like.postId));
  return posts.map((post) => ({ ...post, liked: liked.has(post.id) }));
}

// ---------------------------------------------------------------------------
// Profile summary
// ---------------------------------------------------------------------------

socialRouter.get("/users/:userId/summary", async (req, res) => {
  const userId = req.params.userId === "me" ? req.user!.id : req.params.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatar: true,
      banner: true,
      bio: true,
      clanTag: true,
      status: true,
      premium: true,
      premiumTier: true,
      isStaff: true,
      isRep: true,
      isPartner: true,
      isCreator: true,
      creatorStatus: true,
      livePlatform: true,
      liveStreamTitle: true,
      liveStreamUrl: true,
      liveGameCategory: true,
      liveViewerCount: true,
      liveStartedAt: true,
      ageVerificationLevel: true,
      reputation: true,
      socialLinks: true,
      avatarConfig: true,
      loadout: true,
      createdAt: true,
      lastSeenAt: true,
      _count: { select: { followers: true, following: true, posts: true, medals: true, memberships: true } },
    },
  });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [isFollowing, followsYou, reputationAccount] = await Promise.all([
    userId === req.user!.id
      ? Promise.resolve(false)
      : prisma.follow.findUnique({ where: { followerId_followingId: { followerId: req.user!.id, followingId: userId } } }).then(Boolean),
    userId === req.user!.id
      ? Promise.resolve(false)
      : prisma.follow.findUnique({ where: { followerId_followingId: { followerId: userId, followingId: req.user!.id } } }).then(Boolean),
    prisma.economyAccount.findUnique({ where: { userId_currencyType: { userId, currencyType: "FR" } }, select: { balance: true } }),
  ]);

  const points = Number(reputationAccount?.balance ?? 0n) + user.reputation;

  // The equipped emote plays on the profile card.
  const emoteId = (user.loadout as { EMOTE?: string } | null)?.EMOTE;
  const profileEmote = emoteId
    ? await prisma.cosmeticItem.findUnique({ where: { id: emoteId }, select: { id: true, key: true, name: true, description: true, rarity: true, color: true, metadata: true, slot: true } })
    : null;

  res.json({
    user: { ...user, loadout: undefined, points, profileEmote },
    isSelf: userId === req.user!.id,
    isFollowing,
    followsYou,
  });
});

// ---------------------------------------------------------------------------
// Follows
// ---------------------------------------------------------------------------

socialRouter.post("/follow/:userId", async (req, res) => {
  const targetId = req.params.userId;
  if (targetId === req.user!.id) {
    res.status(400).json({ error: "You cannot follow yourself" });
    return;
  }
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: req.user!.id, followingId: targetId } },
  });
  if (existing) {
    res.json({ following: true });
    return;
  }

  await prisma.follow.create({ data: { followerId: req.user!.id, followingId: targetId } });
  void createNotification({
    userId: targetId,
    type: "SYSTEM",
    title: "New follower",
    body: `${req.user!.username} started following you.`,
    data: { followerId: req.user!.id },
  }).catch(() => undefined);

  res.status(201).json({ following: true });
});

socialRouter.delete("/follow/:userId", async (req, res) => {
  await prisma.follow.deleteMany({ where: { followerId: req.user!.id, followingId: req.params.userId } });
  res.json({ following: false });
});

socialRouter.get("/users/:userId/followers", async (req, res) => {
  const userId = req.params.userId === "me" ? req.user!.id : req.params.userId;
  const rows = await prisma.follow.findMany({
    where: { followingId: userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { follower: { select: { id: true, username: true, displayName: true, avatar: true, status: true } } },
  });
  res.json({ users: rows.map((row) => row.follower) });
});

socialRouter.get("/users/:userId/following", async (req, res) => {
  const userId = req.params.userId === "me" ? req.user!.id : req.params.userId;
  const rows = await prisma.follow.findMany({
    where: { followerId: userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { following: { select: { id: true, username: true, displayName: true, avatar: true, status: true } } },
  });
  res.json({ users: rows.map((row) => row.following) });
});

// ---------------------------------------------------------------------------
// Posts and clips
// ---------------------------------------------------------------------------

socialRouter.get("/posts", async (req, res) => {
  const authorId = typeof req.query.authorId === "string" ? (req.query.authorId === "me" ? req.user!.id : req.query.authorId) : undefined;
  const kind = req.query.kind === "CLIP" || req.query.kind === "POST" ? req.query.kind : undefined;
  const scope = req.query.scope === "following" ? "following" : "all";

  let authorFilter: { in: string[] } | string | undefined = authorId;
  if (!authorId && scope === "following") {
    const following = await prisma.follow.findMany({ where: { followerId: req.user!.id }, select: { followingId: true } });
    authorFilter = { in: [...following.map((entry) => entry.followingId), req.user!.id] };
  }

  const posts = await prisma.post.findMany({
    where: {
      ...(authorFilter ? { authorId: authorFilter } : {}),
      ...(kind ? { kind } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: postInclude,
  });

  res.json({ posts: await attachLiked(posts, req.user!.id) });
});

socialRouter.post("/posts", async (req, res) => {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const post = await prisma.post.create({
    data: {
      authorId: req.user!.id,
      kind: parsed.data.kind,
      content: xss(parsed.data.content),
      mediaUrl: parsed.data.mediaUrl,
      tags: (parsed.data.tags ?? []).map((tag) => tag.replace(/^#/, "").toLowerCase()),
    },
    include: postInclude,
  });

  res.status(201).json({ post: { ...post, liked: false } });
});

socialRouter.delete("/posts/:id", async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id }, select: { id: true, authorId: true } });
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const isPrivileged = req.user!.appRole === "ADMIN" || req.user!.appRole === "OWNER" || req.user!.appRole === "EXEC";
  if (post.authorId !== req.user!.id && !isPrivileged) {
    res.status(403).json({ error: "You cannot delete this post" });
    return;
  }
  await prisma.post.delete({ where: { id: post.id } });
  res.json({ ok: true, postId: post.id });
});

socialRouter.post("/posts/:id/like", async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const existing = await prisma.postLike.findUnique({ where: { postId_userId: { postId: post.id, userId: req.user!.id } } });
  if (existing) {
    await prisma.postLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.postLike.create({ data: { postId: post.id, userId: req.user!.id } });
  }
  const count = await prisma.postLike.count({ where: { postId: post.id } });
  res.json({ liked: !existing, likes: count });
});

// ---------------------------------------------------------------------------
// Presence status chosen by the user (Online / Idle / Do not disturb)
// ---------------------------------------------------------------------------

socialRouter.put("/status", async (req, res) => {
  const parsed = z.object({ status: z.enum(["ONLINE", "IDLE", "DND"]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: { status: parsed.data.status, lastSeenAt: new Date() }, select: { id: true, status: true } });
  const memberships = await prisma.forgeMember.findMany({ where: { userId: user.id }, select: { forgeId: true } });
  try {
    const io = getIo();
    for (const { forgeId } of memberships) io.to(`forge:${forgeId}`).emit("presence:changed", { forgeId, userId: user.id, status: user.status });
  } catch {
    // realtime not ready
  }
  res.json({ status: user.status });
});

// ---------------------------------------------------------------------------
// Live status
// ---------------------------------------------------------------------------

const liveSchema = z.object({
  live: z.boolean(),
  platform: z.enum(["Twitch", "Kick", "YouTube", "TikTok", "Vexora"]).optional(),
  title: z.string().trim().max(140).optional(),
  url: z.string().url().optional(),
  game: z.string().trim().max(80).optional(),
});

socialRouter.put("/live", async (req, res) => {
  const parsed = liveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  if (parsed.data.live) {
    const gate = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { ageVerificationLevel: true } });
    if (!gate || gate.ageVerificationLevel === "NONE") {
      res.status(403).json({ error: "Confirm you are 18 or older before going live", code: "AGE_REQUIRED" });
      return;
    }
  }
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: parsed.data.live
      ? {
          isCreator: true,
          creatorStatus: "LIVE",
          livePlatform: parsed.data.platform ?? "Vexora",
          liveStreamTitle: parsed.data.title || null,
          liveStreamUrl: parsed.data.url || null,
          liveGameCategory: parsed.data.game || null,
          liveStartedAt: new Date(),
          activityType: "STREAMING",
          activityStatus: parsed.data.title ? `Streaming: ${parsed.data.title}` : "Streaming",
        }
      : { creatorStatus: "OFFLINE", liveViewerCount: 0, liveStartedAt: null, activityType: null, activityStatus: null },
    select: { id: true, username: true, displayName: true, creatorStatus: true, livePlatform: true, liveStreamTitle: true, liveStreamUrl: true, liveGameCategory: true, liveStartedAt: true },
  });
  res.json({ live: user });

  if (parsed.data.live) {
    // Live alert to followers (each follower's notification preferences are honoured in createNotification).
    void (async () => {
      const followers = await prisma.follow.findMany({ where: { followingId: user.id }, select: { followerId: true } });
      const name = user.displayName || user.username;
      await Promise.all(
        followers.map((entry) =>
          createNotification({
            userId: entry.followerId,
            type: "LIVE",
            title: `${name} is live`,
            body: user.liveStreamTitle ? `${user.liveStreamTitle}${user.liveGameCategory ? ` · ${user.liveGameCategory}` : ""}` : `Streaming now on ${user.livePlatform ?? "Vexora"}`,
            data: { creatorId: user.id, url: user.liveStreamUrl },
          }).catch(() => undefined),
        ),
      );
    })();
  }
});
