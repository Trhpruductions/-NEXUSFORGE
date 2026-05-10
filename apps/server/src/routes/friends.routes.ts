import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
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

  res.json({ friends: rows });
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

  const receiver = await prisma.user.findUnique({ where: { id: parsed.data.receiverId } });
  if (!receiver) {
    res.status(404).json({ error: "Receiver not found" });
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

  if (parsed.data.status === "ACCEPTED" && existing.receiverId !== req.user!.id) {
    res.status(403).json({ error: "Only recipient can accept" });
    return;
  }

  const updated = await prisma.friend.update({
    where: { id: existing.id },
    data: { status: parsed.data.status },
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

  await prisma.friend.delete({ where: { id: existing.id } });
  res.status(204).send();
});
