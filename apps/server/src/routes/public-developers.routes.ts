import { Router } from "express";
import { prisma } from "../lib/prisma.js";

// Public and read only: what the developer section shows to everyone, without signing in.
// Published updates and public bots only. Nothing personal (no owner ids, no invite codes), and nothing here lets a
// visitor act on the platform. Signed-in features stay behind /api/updates and /api/bots.
export const publicDevelopersRouter = Router();

/** Published "What's new" updates, newest first. Drafts are never included. */
publicDevelopersRouter.get("/updates", async (_req, res) => {
  const updates = await prisma.appUpdate.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    take: 30,
    select: { id: true, title: true, body: true, version: true, publishedAt: true },
  });
  res.json({ updates });
});

/** Public bot apps for the marketplace. Install codes are left out: a signed-in user gets the code for a bot. */
publicDevelopersRouter.get("/bots", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
  const bots = await prisma.botApp.findMany({
    where: {
      isPublic: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { description: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, name: true, description: true, avatar: true, createdAt: true },
  });
  res.json({ bots });
});
