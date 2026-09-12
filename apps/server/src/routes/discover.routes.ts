import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

/** Public forge directory for the Discover page. */
export const discoverRouter = Router();

discoverRouter.use(requireAuth);

export const discoverCategories = ["gaming", "creators", "esports", "social", "new"] as const;

const forgeCardSelect = {
  id: true,
  name: true,
  description: true,
  icon: true,
  banner: true,
  inviteCode: true,
  category: true,
  tags: true,
  featured: true,
  createdAt: true,
  _count: { select: { members: true, channels: true } },
} as const;

discoverRouter.get("/", async (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category.toLowerCase() : "all";
  const query = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const memberships = await prisma.forgeMember.findMany({ where: { userId: req.user!.id }, select: { forgeId: true } });
  const joined = new Set(memberships.map((entry) => entry.forgeId));

  const where = {
    isPublic: true,
    ...(category === "new"
      ? { createdAt: { gte: sevenDaysAgo } }
      : category !== "all" && (discoverCategories as readonly string[]).includes(category)
        ? { category }
        : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } },
            { tags: { has: query } },
          ],
        }
      : {}),
  };

  const forges = await prisma.forge.findMany({
    where,
    select: forgeCardSelect,
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: 60,
  });

  const withMeta = forges.map((forge) => ({
    ...forge,
    memberCount: forge._count.members,
    channelCount: forge._count.channels,
    joined: joined.has(forge.id),
  }));

  const featured = withMeta.filter((forge) => forge.featured).slice(0, 6);
  const featuredIds = new Set(featured.map((forge) => forge.id));
  // Recommended: largest public forges the user has not joined, excluding featured.
  const recommended = withMeta
    .filter((forge) => !forge.joined && !featuredIds.has(forge.id))
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, 6);

  const tagCounts = new Map<string, number>();
  for (const forge of withMeta) {
    for (const tag of forge.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + forge.memberCount + 1);
  }
  const popularTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tag, score]) => ({ tag, score }));

  res.json({
    categories: ["all", ...discoverCategories],
    featured,
    recommended,
    popularTags,
    forges: withMeta,
  });
});
