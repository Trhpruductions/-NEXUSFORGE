import { Router } from "express";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { hasActiveFeatureEntitlement } from "../middleware/entitlements.js";

const inviteCodeSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9-]+$/i, "Invite link can only contain letters, numbers, and hyphens.");

const forgeTemplateSchema = z.enum(["GAMING", "CREATOR", "ESPORTS", "STUDY"]);

const createForgeSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional(),
  icon: z.string().url().optional(),
  banner: z.string().url().optional(),
  inviteCode: inviteCodeSchema.optional(),
  template: forgeTemplateSchema.optional(),
});

const joinForgeSchema = z.object({
  inviteCode: inviteCodeSchema,
  source: z.string().min(2).max(48).regex(/^[a-z0-9-]+$/i).optional(),
});

const updateInviteCodeSchema = z.object({
  inviteCode: inviteCodeSchema,
});

export const forgesRouter = Router();

const reservedInviteCodes = new Set([
  "admin",
  "api",
  "app",
  "billing",
  "core-plus",
  "forgot-password",
  "health",
  "invite",
  "login",
  "notifications",
  "pricing",
  "register",
  "settings",
  "support",
]);

const forgeTemplateChannels: Record<z.infer<typeof forgeTemplateSchema>, Array<{ name: string; type: "TEXT" | "ANNOUNCEMENT" | "VOICE" | "STAGE" }>> = {
  GAMING: [
    { name: "general", type: "TEXT" },
    { name: "announcements", type: "ANNOUNCEMENT" },
    { name: "Squad Voice", type: "VOICE" },
  ],
  CREATOR: [
    { name: "creator-lounge", type: "TEXT" },
    { name: "content-drops", type: "ANNOUNCEMENT" },
    { name: "Live Studio", type: "VOICE" },
  ],
  ESPORTS: [
    { name: "team-comms", type: "TEXT" },
    { name: "match-updates", type: "ANNOUNCEMENT" },
    { name: "Scrim Voice", type: "VOICE" },
  ],
  STUDY: [
    { name: "focus-room", type: "TEXT" },
    { name: "resources", type: "ANNOUNCEMENT" },
    { name: "Study Voice", type: "VOICE" },
  ],
};

function normalizeInviteCode(inviteCode: string) {
  return inviteCode.trim().toLowerCase();
}

function normalizeInviteSource(source?: string) {
  return source?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 48) || "direct";
}

function toPercent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function sourceRecencyBoost(lastJoinedAt?: Date | null, lastViewedAt?: Date | null) {
  const reference = lastJoinedAt ?? lastViewedAt;
  if (!reference) return 0;

  const hoursSince = Math.max(0, (Date.now() - reference.getTime()) / (1000 * 60 * 60));
  if (hoursSince <= 24) return 12;
  if (hoursSince <= 72) return 8;
  if (hoursSince <= 24 * 7) return 4;
  return 1;
}

function isInviteCodeTakenError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function getInviteAvailability(inviteCode: string, currentForgeId?: string) {
  const normalizedInviteCode = normalizeInviteCode(inviteCode);

  if (reservedInviteCodes.has(normalizedInviteCode)) {
    return {
      available: false,
      normalizedInviteCode,
      reason: "reserved" as const,
    };
  }

  const existing = await prisma.forge.findUnique({
    where: { inviteCode: normalizedInviteCode },
    select: { id: true },
  });

  if (!existing || existing.id === currentForgeId) {
    return {
      available: true,
      normalizedInviteCode,
      reason: null,
    };
  }

  return {
    available: false,
    normalizedInviteCode,
    reason: "taken" as const,
  };
}

forgesRouter.get("/availability/:inviteCode", async (req, res) => {
  const normalizedInviteCode = normalizeInviteCode(req.params.inviteCode);
  const currentForgeId = typeof req.query.currentForgeId === "string" ? req.query.currentForgeId : undefined;
  const availability = await getInviteAvailability(normalizedInviteCode, currentForgeId);

  res.json({
    inviteCode: availability.normalizedInviteCode,
    available: availability.available,
    reason: availability.reason,
  });
});

forgesRouter.get("/public/:inviteCode", async (req, res) => {
  const inviteCode = normalizeInviteCode(req.params.inviteCode);
  const inviteSource = normalizeInviteSource(typeof req.query.src === "string" ? req.query.src : undefined);
  const forge = await prisma.forge.update({
    where: { inviteCode },
    data: {
      inviteViewCount: {
        increment: 1,
      },
      inviteLastViewedAt: new Date(),
    },
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      banner: true,
      inviteCode: true,
      inviteViewCount: true,
      inviteJoinCount: true,
      inviteLastViewedAt: true,
      inviteLastJoinedAt: true,
      createdAt: true,
      owner: {
        select: {
          username: true,
        },
      },
      _count: {
        select: {
          members: true,
        },
      },
    },
  }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null;
    }

    throw error;
  });

  if (!forge) {
    res.status(404).json({ error: "Invite link not found" });
    return;
  }

  await prisma.inviteSourceStat.upsert({
    where: {
      forgeId_source: {
        forgeId: forge.id,
        source: inviteSource,
      },
    },
    update: {
      viewCount: {
        increment: 1,
      },
      lastViewedAt: new Date(),
    },
    create: {
      forgeId: forge.id,
      source: inviteSource,
      viewCount: 1,
      lastViewedAt: new Date(),
    },
  });

  res.json({
    forge: {
      ...forge,
      memberCount: forge._count.members,
      inviteSource,
    },
  });
});

forgesRouter.use(requireAuth);
forgesRouter.use(requireCsrf);

forgesRouter.get("/", async (req, res) => {
  const memberships = await prisma.forgeMember.findMany({
    where: { userId: req.user!.id },
    include: {
      forge: {
        select: {
          id: true,
          name: true,
          icon: true,
          banner: true,
          inviteCode: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      joinedAt: "asc",
    },
  });

  res.json({ forges: memberships.map((item) => item.forge) });
});

forgesRouter.post("/", async (req, res) => {
  const parsed = createForgeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const requestedBranding = Boolean(parsed.data.icon || parsed.data.banner);
  if (requestedBranding) {
    const hasBrandingKit = await hasActiveFeatureEntitlement(req.user!.id, "TEAM_BRANDING_KIT");
    if (!hasBrandingKit) {
      res.status(402).json({
        error: "Payment required",
        feature: "TEAM_BRANDING_KIT",
        message: "Custom forge icon and banner branding require the Team Branding Kit.",
      });
      return;
    }
  }

  const inviteCode = normalizeInviteCode(parsed.data.inviteCode ?? randomUUID().slice(0, 8));
  const selectedTemplate = parsed.data.template ?? "GAMING";
  const availability = await getInviteAvailability(inviteCode);

  if (!availability.available) {
    res.status(409).json({
      error: availability.reason === "reserved" ? "Invite link is reserved" : "Invite link is already in use",
    });
    return;
  }

  let forge;

  try {
    forge = await prisma.$transaction(async (tx) => {
      const created = await tx.forge.create({
        data: {
          name: parsed.data.name,
          description: parsed.data.description,
          icon: parsed.data.icon,
          banner: parsed.data.banner,
          inviteCode,
          ownerId: req.user!.id,
        },
      });

      const ownerMembership = await tx.forgeMember.create({
        data: {
          userId: req.user!.id,
          forgeId: created.id,
        },
      });

      const ownerRole = await tx.role.create({
        data: {
          forgeId: created.id,
          name: "Owner",
          color: "#22d3ee",
          permissions: {
            manageChannels: true,
            banUsers: true,
            kickUsers: true,
            manageRoles: true,
            moderateChat: true,
            streamAccess: true,
          },
          position: 100,
        },
      });

      await tx.memberRole.create({
        data: {
          forgeMemberId: ownerMembership.id,
          roleId: ownerRole.id,
        },
      });

      await tx.channel.createMany({
        data: forgeTemplateChannels[selectedTemplate].map((channel, index) => ({
          forgeId: created.id,
          name: channel.name,
          type: channel.type,
          position: index,
        })),
      });

      return created;
    });
  } catch (error) {
    if (isInviteCodeTakenError(error)) {
      res.status(409).json({ error: "Invite link is already in use" });
      return;
    }

    throw error;
  }

  res.status(201).json({ forge });
});

forgesRouter.patch("/:id/invite", async (req, res) => {
  const parsed = updateInviteCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const forge = await prisma.forge.findUnique({
    where: { id: req.params.id },
    select: { id: true, ownerId: true },
  });

  if (!forge) {
    res.status(404).json({ error: "Forge not found" });
    return;
  }

  if (forge.ownerId !== req.user!.id) {
    res.status(403).json({ error: "Only forge owners can change invite links" });
    return;
  }

  const nextInviteCode = normalizeInviteCode(parsed.data.inviteCode);
  const availability = await getInviteAvailability(nextInviteCode, forge.id);

  if (!availability.available) {
    res.status(409).json({
      error: availability.reason === "reserved" ? "Invite link is reserved" : "Invite link is already in use",
    });
    return;
  }

  let updated;

  try {
    updated = await prisma.forge.update({
      where: { id: forge.id },
      data: {
        inviteCode: nextInviteCode,
      },
      select: {
        id: true,
        inviteCode: true,
      },
    });
  } catch (error) {
    if (isInviteCodeTakenError(error)) {
      res.status(409).json({ error: "Invite link is already in use" });
      return;
    }

    throw error;
  }

  res.status(200).json({ forge: updated });
});

forgesRouter.post("/join", async (req, res) => {
  const parsed = joinForgeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const forge = await prisma.forge.findUnique({ where: { inviteCode: normalizeInviteCode(parsed.data.inviteCode) } });
  if (!forge) {
    res.status(404).json({ error: "Invalid invite code" });
    return;
  }

  const inviteSource = normalizeInviteSource(parsed.data.source);

  const existingMembership = await prisma.forgeMember.findUnique({
    where: {
      userId_forgeId: {
        userId: req.user!.id,
        forgeId: forge.id,
      },
    },
    select: { id: true },
  });

  if (!existingMembership) {
    await prisma.forgeMember.create({
      data: {
        userId: req.user!.id,
        forgeId: forge.id,
      },
    });

    await prisma.forge.update({
      where: { id: forge.id },
      data: {
        inviteJoinCount: {
          increment: 1,
        },
        inviteLastJoinedAt: new Date(),
      },
    });

    await prisma.inviteSourceStat.upsert({
      where: {
        forgeId_source: {
          forgeId: forge.id,
          source: inviteSource,
        },
      },
      update: {
        joinCount: {
          increment: 1,
        },
        lastJoinedAt: new Date(),
      },
      create: {
        forgeId: forge.id,
        source: inviteSource,
        joinCount: 1,
        lastJoinedAt: new Date(),
      },
    });
  }

  res.status(200).json({ forgeId: forge.id, inviteCode: forge.inviteCode });
});

forgesRouter.get("/:id/invite-analytics", async (req, res) => {
  const membership = await prisma.forgeMember.findUnique({
    where: {
      userId_forgeId: {
        userId: req.user!.id,
        forgeId: req.params.id,
      },
    },
  });

  if (!membership) {
    res.status(403).json({ error: "You are not a member of this Forge" });
    return;
  }

  const [forge, sourceStats] = await Promise.all([
    prisma.forge.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        inviteViewCount: true,
        inviteJoinCount: true,
        inviteLastViewedAt: true,
        inviteLastJoinedAt: true,
      },
    }),
    prisma.inviteSourceStat.findMany({
      where: { forgeId: req.params.id },
      orderBy: [{ joinCount: "desc" }, { viewCount: "desc" }],
      take: 12,
    }),
  ]);

  if (!forge) {
    res.status(404).json({ error: "Forge not found" });
    return;
  }

  const totalViews = forge.inviteViewCount;
  const totalJoins = forge.inviteJoinCount;
  const conversionRate = toPercent(totalJoins, totalViews);

  const rankedSources = sourceStats
    .map((stat) => {
      const sourceConversionRate = toPercent(stat.joinCount, stat.viewCount);
      const viewShare = toPercent(stat.viewCount, Math.max(1, totalViews));
      const joinShare = toPercent(stat.joinCount, Math.max(1, totalJoins));
      const recencyBoost = sourceRecencyBoost(stat.lastJoinedAt, stat.lastViewedAt);

      const score = Math.max(
        0,
        Math.min(
          100,
          Math.round(sourceConversionRate * 0.55 + joinShare * 0.3 + viewShare * 0.1 + recencyBoost),
        ),
      );

      return {
        id: stat.id,
        source: stat.source,
        viewCount: stat.viewCount,
        joinCount: stat.joinCount,
        sourceConversionRate,
        viewShare,
        joinShare,
        score,
        lastViewedAt: stat.lastViewedAt,
        lastJoinedAt: stat.lastJoinedAt,
      };
    })
    .sort((left, right) => right.score - left.score);

  const topSource = rankedSources[0] ?? null;
  const underperformingSource = rankedSources
    .filter((source) => source.viewCount >= 10)
    .sort((left, right) => left.sourceConversionRate - right.sourceConversionRate)[0] ?? null;

  const qualityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        conversionRate * 1.6 +
          Math.min(totalViews, 500) / 20 +
          Math.min(totalJoins, 250) / 5 +
          (topSource?.score ?? 0) * 0.15,
      ),
    ),
  );

  res.json({
    analytics: {
      summary: {
        views: totalViews,
        joins: totalJoins,
        conversionRate,
        qualityScore,
        inviteLastViewedAt: forge.inviteLastViewedAt,
        inviteLastJoinedAt: forge.inviteLastJoinedAt,
      },
      topSource,
      underperformingSource,
      sources: rankedSources,
    },
  });
});

forgesRouter.get("/:id", async (req, res) => {
  const membership = await prisma.forgeMember.findUnique({
    where: {
      userId_forgeId: {
        userId: req.user!.id,
        forgeId: req.params.id,
      },
    },
  });

  if (!membership) {
    res.status(403).json({ error: "You are not a member of this Forge" });
    return;
  }

  const forge = await prisma.forge.findUnique({
    where: { id: req.params.id },
    include: {
      channels: {
        orderBy: { position: "asc" },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
              status: true,
              premium: true,
            },
          },
        },
      },
      roles: {
        orderBy: { position: "desc" },
      },
      botInstallations: {
        orderBy: { createdAt: "desc" },
        include: {
          commands: {
            orderBy: { createdAt: "desc" },
          },
          bot: {
            select: {
              id: true,
              name: true,
              description: true,
              avatar: true,
              inviteCode: true,
              intents: true,
            },
          },
        },
      },
      inviteSources: {
        orderBy: [{ joinCount: "desc" }, { viewCount: "desc" }],
        take: 8,
      },
    },
  });

  if (!forge) {
    res.status(404).json({ error: "Forge not found" });
    return;
  }

  res.json({ forge });
});
