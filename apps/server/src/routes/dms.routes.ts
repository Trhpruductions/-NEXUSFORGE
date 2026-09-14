import { Router } from "express";
import xss from "xss";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { createNotification } from "../lib/notifications.js";
import { getIo } from "../lib/realtime.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

const createDmSchema = z.object({
  userId: z.string().uuid(),
});

const createGroupSchema = z.object({
  name: z.string().min(2).max(80),
  participantIds: z.array(z.string().uuid()).min(2).max(20),
});

const messageSchema = z.object({
  content: z.string().min(1).max(4000),
  attachments: z.array(z.string().url()).max(8).optional(),
});

export const dmsRouter = Router();

dmsRouter.use(requireAuth);
dmsRouter.use(requireCsrf);

dmsRouter.get("/threads", async (req, res) => {
  const membership = await prisma.directMessageParticipant.findMany({
    where: { userId: req.user!.id },
    include: {
      thread: {
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatar: true,
                  status: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              content: true,
              createdAt: true,
              authorId: true,
            },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  // Unread = messages from others after the participant's lastReadAt.
  const unreadCounts = await Promise.all(
    membership.map((row) =>
      prisma.directMessage.count({
        where: { threadId: row.threadId, authorId: { not: req.user!.id }, ...(row.lastReadAt ? { createdAt: { gt: row.lastReadAt } } : {}) },
      }),
    ),
  );
  const threads = membership
    .map((row, index) => ({ ...row.thread, unreadCount: unreadCounts[index], lastReadAt: row.lastReadAt }))
    .sort((a, b) => {
      const aTime = a.messages[0]?.createdAt?.getTime?.() ?? a.updatedAt.getTime();
      const bTime = b.messages[0]?.createdAt?.getTime?.() ?? b.updatedAt.getTime();
      return bTime - aTime;
    });
  res.json({ threads });
});

/** Total unread DMs for the shell badge. */
dmsRouter.get("/unread", async (req, res) => {
  const rows = await prisma.directMessageParticipant.findMany({ where: { userId: req.user!.id }, select: { threadId: true, lastReadAt: true } });
  const counts = await Promise.all(
    rows.map((row) => prisma.directMessage.count({ where: { threadId: row.threadId, authorId: { not: req.user!.id }, ...(row.lastReadAt ? { createdAt: { gt: row.lastReadAt } } : {}) } })),
  );
  res.json({ unread: counts.reduce((sum, value) => sum + value, 0), threads: rows.map((row, index) => ({ threadId: row.threadId, unread: counts[index] })).filter((entry) => entry.unread > 0) });
});

/** Mark a thread as read up to now. */
dmsRouter.post("/threads/:threadId/read", async (req, res) => {
  const updated = await prisma.directMessageParticipant.updateMany({ where: { threadId: req.params.threadId, userId: req.user!.id }, data: { lastReadAt: new Date() } });
  if (!updated.count) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }
  res.json({ ok: true });
});

// Serialize thread creation per user pair so two simultaneous requests cannot create two threads.
const threadLocks = new Map<string, Promise<unknown>>();
async function withPairLock<T>(
  a: string,
  b: string,
  work: () => Promise<T>,
): Promise<T> {
  const key = [a, b].sort().join(":");
  const previous = threadLocks.get(key) ?? Promise.resolve();
  const run = previous.then(work, work);
  threadLocks.set(
    key,
    run.catch(() => undefined),
  );
  try {
    return await run;
  } finally {
    if (threadLocks.get(key) === run) threadLocks.delete(key);
  }
}

dmsRouter.post("/threads", async (req, res) => {
  const parsed = createDmSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  if (parsed.data.userId === req.user!.id) {
    res.status(400).json({ error: "Cannot DM yourself" });
    return;
  }

  const friendship = await prisma.friend.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId: req.user!.id, receiverId: parsed.data.userId },
        { senderId: parsed.data.userId, receiverId: req.user!.id },
      ],
    },
  });

  if (!friendship) {
    res.status(403).json({ error: "You can only DM accepted friends" });
    return;
  }

  const thread = await withPairLock(
    req.user!.id,
    parsed.data.userId,
    async () => {
      const existing = await prisma.directMessageThread.findFirst({
        where: {
          isGroup: false,
          AND: [
            { participants: { some: { userId: req.user!.id } } },
            { participants: { some: { userId: parsed.data.userId } } },
          ],
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatar: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      if (existing && existing.participants.length === 2)
        return { thread: existing, created: false };

      const created = await prisma.directMessageThread.create({
        data: {
          isGroup: false,
          participants: {
            createMany: {
              data: [{ userId: req.user!.id }, { userId: parsed.data.userId }],
            },
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatar: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      return { thread: created, created: true };
    },
  );

  res.status(thread.created ? 201 : 200).json({ thread: thread.thread });
});

dmsRouter.post("/groups", async (req, res) => {
  const parsed = createGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const uniqueIds = Array.from(
    new Set([req.user!.id, ...parsed.data.participantIds]),
  );

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });

  if (users.length !== uniqueIds.length) {
    res.status(400).json({ error: "One or more participants were not found" });
    return;
  }

  const thread = await prisma.directMessageThread.create({
    data: {
      isGroup: true,
      name: parsed.data.name,
      participants: {
        createMany: {
          data: uniqueIds.map((userId) => ({ userId })),
        },
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, username: true, avatar: true, status: true },
          },
        },
      },
    },
  });

  res.status(201).json({ thread });
});

dmsRouter.get("/threads/:threadId/messages", async (req, res) => {
  const threadId = req.params.threadId;

  const participant = await prisma.directMessageParticipant.findUnique({
    where: {
      threadId_userId: {
        threadId,
        userId: req.user!.id,
      },
    },
  });

  if (!participant) {
    res.status(403).json({ error: "Not a participant" });
    return;
  }

  const messages = await prisma.directMessage.findMany({
    where: { threadId },
    include: {
      author: {
        select: { id: true, username: true, avatar: true, premium: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  res.json({ messages });
});

dmsRouter.post("/threads/:threadId/messages", async (req, res) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const threadId = req.params.threadId;
  const participant = await prisma.directMessageParticipant.findUnique({
    where: {
      threadId_userId: {
        threadId,
        userId: req.user!.id,
      },
    },
  });

  if (!participant) {
    res.status(403).json({ error: "Not a participant" });
    return;
  }

  const message = await prisma.directMessage.create({
    data: {
      threadId,
      authorId: req.user!.id,
      content: xss(parsed.data.content.trim()),
      attachments: parsed.data.attachments ?? [],
    },
    include: {
      author: {
        select: { id: true, username: true, avatar: true, premium: true },
      },
    },
  });

  await prisma.directMessageThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  });

  const participants = await prisma.directMessageParticipant.findMany({
    where: { threadId, userId: { not: req.user!.id } },
    select: { userId: true },
  });

  await Promise.all(
    participants.map((participant) =>
      createNotification({
        userId: participant.userId,
        type: "DM",
        title: "New direct message",
        body: `${req.user!.username} sent you a message.`,
        data: { threadId, messageId: message.id },
      }),
    ),
  );

  getIo().to(`dm:${threadId}`).emit("dm:message", { threadId, message });
  // Also tell each participant's other sessions so the shell badge ticks without the thread open.
  for (const participant of participants) getIo().to(`user:${participant.userId}`).emit("dm:activity", { threadId, messageId: message.id, authorId: req.user!.id });

  res.status(201).json({ message });
});
