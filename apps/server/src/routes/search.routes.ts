import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const querySchema = z.object({
  q: z.string().min(1).max(120),
  forgeId: z.string().uuid().optional(),
  channelId: z.string().uuid().optional(),
});

export const searchRouter = Router();

searchRouter.use(requireAuth);

searchRouter.get("/messages", async (req, res) => {
  const parsed = querySchema.safeParse({
    q: req.query.q,
    forgeId: req.query.forgeId,
    channelId: req.query.channelId,
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
    return;
  }

  const membershipWhere = parsed.data.forgeId
    ? {
        userId_forgeId: {
          userId: req.user!.id,
          forgeId: parsed.data.forgeId,
        },
      }
    : undefined;

  if (membershipWhere) {
    const isMember = await prisma.forgeMember.findUnique({ where: membershipWhere });
    if (!isMember) {
      res.status(403).json({ error: "Not a member of this Forge" });
      return;
    }
  }

  const messages = await prisma.message.findMany({
    where: {
      content: {
        contains: parsed.data.q,
        mode: "insensitive",
      },
      ...(parsed.data.channelId ? { channelId: parsed.data.channelId } : {}),
      ...(parsed.data.forgeId
        ? {
            channel: {
              forgeId: parsed.data.forgeId,
            },
          }
        : {
            channel: {
              forge: {
                members: {
                  some: {
                    userId: req.user!.id,
                  },
                },
              },
            },
          }),
    },
    include: {
      author: {
        select: { id: true, username: true, avatar: true },
      },
      channel: {
        select: { id: true, name: true, forgeId: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  res.json({ messages });
});

searchRouter.get("/users", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  if (!q || q.length < 1) {
    res.status(400).json({ error: "Query is required" });
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      username: true,
      avatar: true,
      status: true,
      premium: true,
      clanTag: true,
    },
    take: 30,
  });

  res.json({ users });
});

searchRouter.get("/forges", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  if (!q || q.length < 1) {
    res.status(400).json({ error: "Query is required" });
    return;
  }

  const forges = await prisma.forge.findMany({
    where: {
      name: {
        contains: q,
        mode: "insensitive",
      },
      members: {
        some: {
          userId: req.user!.id,
        },
      },
    },
    select: {
      id: true,
      name: true,
      icon: true,
      banner: true,
      inviteCode: true,
      createdAt: true,
    },
    take: 25,
    orderBy: { createdAt: "desc" },
  });

  res.json({ forges });
});
