import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { evaluateAchievements } from "../lib/achievements.js";
import { createNotification } from "../lib/notifications.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

const requestSchema = z.object({
  receiverId: z.string().uuid(),
});

const updateStatusSchema = z.object({
  status: z.enum(["ACCEPTED", "BLOCKED"]),
});

export const friendsRouter = Router();

friendsRouter.use(requireAuth);
friendsRouter.use(requireCsrf);

friendsRouter.get("/", async (req, res) => {
  const rows = await prisma.friend.findMany({
    where: {
      OR: [{ senderId: req.user!.id }, { receiverId: req.user!.id }],
    },
    include: {
      sender: {
        select: { id: true, username: true, avatar: true, status: true },
      },
      receiver: {
        select: { id: true, username: true, avatar: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Like Discord, a blocked person isn't told; the row only shows for the blocker.
  const visible = rows.filter((row) => row.status !== "BLOCKED" || !row.blockedById || row.blockedById === req.user!.id);
  res.json({ friends: visible });
});

friendsRouter.post("/request", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  if (parsed.data.receiverId === req.user!.id) {
    res.status(400).json({ error: "Cannot friend yourself" });
    return;
  }

  const receiver = await prisma.user.findUnique({ where: { id: parsed.data.receiverId, deletedAt: null } });
  if (!receiver) {
    res.status(404).json({ error: "Receiver not found" });
    return;
  }
  // Settings > Privacy > "Allow friend requests".
  const receiverPrivacy = (receiver.privacySettings ?? {}) as { allowFriendRequests?: boolean };
  if (receiverPrivacy.allowFriendRequests === false) {
    res.status(403).json({ error: "This player isn't accepting friend requests" });
    return;
  }

  const existing = await prisma.friend.findFirst({
    where: {
      OR: [
        { senderId: req.user!.id, receiverId: parsed.data.receiverId },
        { senderId: parsed.data.receiverId, receiverId: req.user!.id },
      ],
    },
  });

  if (existing) {
    res.status(409).json({ error: "Friend relationship already exists" });
    return;
  }

  const row = await prisma.friend.create({
    data: {
      senderId: req.user!.id,
      receiverId: parsed.data.receiverId,
      status: "PENDING",
    },
  });

  await createNotification({
    userId: parsed.data.receiverId,
    type: "FRIEND_REQUEST",
    title: "Friend request received",
    body: `${req.user!.username} sent you a friend request.`,
    data: { friendId: row.id, senderId: req.user!.id },
  });

  res.status(201).json({ friend: row });
});

/**
 * Block anyone, friend or not (it used to need an existing friendship). One row per pair:
 * a block replaces a pending request or friendship. Their block on you stays theirs.
 */
friendsRouter.post("/block/:userId", async (req, res) => {
  const me = req.user!.id;
  const them = String(req.params.userId);
  if (me === them) {
    res.status(400).json({ error: "You can't block yourself" });
    return;
  }
  const target = await prisma.user.findUnique({ where: { id: them }, select: { id: true } });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const existing = await prisma.friend.findFirst({ where: { OR: [{ senderId: me, receiverId: them }, { senderId: them, receiverId: me }] } });
  if (existing?.status === "BLOCKED" && existing.blockedById && existing.blockedById !== me) {
    // They already blocked you; nothing more to do, and don't reveal it.
    res.json({ blocked: true });
    return;
  }
  if (existing) {
    await prisma.friend.update({ where: { id: existing.id }, data: { status: "BLOCKED", blockedById: me } });
  } else {
    await prisma.friend.create({ data: { senderId: me, receiverId: them, status: "BLOCKED", blockedById: me } });
  }
  res.json({ blocked: true });
});

/** Unblock someone you blocked (you are not friends afterwards). */
friendsRouter.delete("/block/:userId", async (req, res) => {
  const me = req.user!.id;
  const them = String(req.params.userId);
  await prisma.friend.deleteMany({
    where: { status: "BLOCKED", blockedById: me, OR: [{ senderId: me, receiverId: them }, { senderId: them, receiverId: me }] },
  });
  res.json({ blocked: false });
});

friendsRouter.patch("/:id", async (req, res) => {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.friend.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Relationship not found" });
    return;
  }

  const isParticipant = existing.receiverId === req.user!.id || existing.senderId === req.user!.id;
  if (!isParticipant) {
    res.status(403).json({ error: "Not allowed" });
    return;
  }

  // Only the person who blocked can lift or change a block.
  if (existing.status === "BLOCKED" && existing.blockedById && existing.blockedById !== req.user!.id) {
    res.status(404).json({ error: "Relationship not found" });
    return;
  }

  if (parsed.data.status === "ACCEPTED" && (existing.receiverId !== req.user!.id || existing.status !== "PENDING")) {
    res.status(403).json({ error: "Only the recipient can accept a pending request" });
    return;
  }

  const updated = await prisma.friend.update({
    where: { id: existing.id },
    data: { status: parsed.data.status, blockedById: parsed.data.status === "BLOCKED" ? req.user!.id : null },
  });

  if (parsed.data.status === "ACCEPTED") {
    await createNotification({
      userId: existing.senderId,
      type: "FRIEND_ACCEPTED",
      title: "Friend request accepted",
      body: `${req.user!.username} accepted your friend request.`,
      data: { friendId: existing.id },
    });
  }

  res.json({ friend: updated });
  if (parsed.data.status === "ACCEPTED") {
    void evaluateAchievements(existing.senderId);
    void evaluateAchievements(existing.receiverId);
  }
});

friendsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.friend.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Relationship not found" });
    return;
  }

  const isParticipant = existing.receiverId === req.user!.id || existing.senderId === req.user!.id;
  if (!isParticipant) {
    res.status(403).json({ error: "Not allowed" });
    return;
  }

  if (existing.status === "BLOCKED" && existing.blockedById && existing.blockedById !== req.user!.id) {
    res.status(404).json({ error: "Relationship not found" });
    return;
  }

  await prisma.friend.delete({ where: { id: existing.id } });
  res.status(204).send();
});
