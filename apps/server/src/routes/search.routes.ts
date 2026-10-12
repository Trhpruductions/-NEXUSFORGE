import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { hiddenChannelIdsForUser } from "../lib/channel-access.js";
import { hasAnyFilter, parseSearchQuery } from "../lib/search-query.js";
import { Prisma } from "@prisma/client";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|$)/i;
const attachmentUrls = (value: unknown) => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []);

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

  // Private channels the searcher can't open never show up in results.
  const hidden = await hiddenChannelIdsForUser(req.user!.id, parsed.data.forgeId);
  if (parsed.data.channelId && hidden.includes(parsed.data.channelId)) {
    res.json({ messages: [] });
    return;
  }

  // from:, in:, has:, mentions:, before:, after:, during:, pinned: (see lib/search-query).
  const filters = parseSearchQuery(parsed.data.q);
  if (!hasAnyFilter(filters)) {
    res.json({ messages: [], filters });
    return;
  }
  const and: Prisma.MessageWhereInput[] = [];
  if (filters.text) and.push({ content: { contains: filters.text, mode: "insensitive" } });
  if (filters.from.length) {
    const authors = await prisma.user.findMany({
      where: { OR: filters.from.map((name) => ({ username: { equals: name, mode: "insensitive" as const } })) },
      select: { id: true },
    });
    and.push({ authorId: { in: authors.map((author) => author.id) } });
  }
  if (filters.in.length) and.push({ channel: { OR: filters.in.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })) } });
  for (const name of filters.mentions) and.push({ content: { contains: `@${name}`, mode: "insensitive" } });
  if (filters.has.includes("link")) and.push({ content: { contains: "http", mode: "insensitive" } });
  // attachments is a JSON array: "has a file" = not empty and not null.
  if (filters.has.some((kind) => kind !== "link")) and.push({ NOT: [{ attachments: { equals: [] } }, { attachments: { equals: Prisma.DbNull } }] });
  if (filters.before) and.push({ createdAt: { lt: filters.before } });
  if (filters.after) and.push({ createdAt: { gt: filters.after } });
  if (filters.pinned === true) and.push({ pinnedAt: { not: null } });
  if (filters.pinned === false) and.push({ pinnedAt: null });
  // Image/video can't be told apart in the query (attachments are URLs), so filter after.
  const needsTypeCheck = filters.has.includes("image") || filters.has.includes("video");

  const found = await prisma.message.findMany({
    where: {
      AND: and,
      ...(hidden.length && !parsed.data.channelId ? { channelId: { notIn: hidden } } : {}),
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
    take: needsTypeCheck ? 300 : 50,
  });

  const messages = needsTypeCheck
    ? found
        .filter((message) =>
          (!filters.has.includes("image") || attachmentUrls(message.attachments).some((url) => IMAGE_EXT.test(url))) &&
          (!filters.has.includes("video") || attachmentUrls(message.attachments).some((url) => VIDEO_EXT.test(url))),
        )
        .slice(0, 50)
    : found;

  res.json({ messages, filters });
});

searchRouter.get("/users", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  if (!q || q.length < 1) {
    res.status(400).json({ error: "Query is required" });
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
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
