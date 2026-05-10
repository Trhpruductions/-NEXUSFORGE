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

const onboardingActionTypeSchema = z.enum([
  "SEED_CORE_CHANNELS",
  "CREATE_MODERATOR_ROLE",
  "ENABLE_STARTER_AUTOMATION",
  "LAUNCH_SHARE_CAMPAIGNS",
  "PUBLISH_MEMBER_RECRUITMENT_POST",
  "OPTIMIZE_CAMPAIGNS",
]);

const onboardingActionSchema = z.object({
  action: onboardingActionTypeSchema,
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

function toOnboardingScore(completedCount: number, totalCount: number) {
  if (totalCount <= 0) return 0;
  return Math.round((completedCount / totalCount) * 100);
}

const campaignOptimizationTag = "[Campaign Optimization Checklist]";
const campaignSnapshotPrefix = "CAMPAIGN_SNAPSHOT:";

type CampaignSnapshot = {
  capturedAt: string;
  weakestSources: Array<{
    source: string;
    views: number;
    joins: number;
    conversionRate: number;
  }>;
};

function parseCampaignSnapshot(content: string): CampaignSnapshot | null {
  const snapshotLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith(campaignSnapshotPrefix));

  if (!snapshotLine) {
    return null;
  }

  const payload = snapshotLine.slice(campaignSnapshotPrefix.length);
  try {
    const parsed = JSON.parse(payload) as CampaignSnapshot;
    if (!parsed || !Array.isArray(parsed.weakestSources) || typeof parsed.capturedAt !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
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
    select: { id: true, ownerId: true, inviteCode: true },
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

  const [forge, sourceStats, latestOptimizationSnapshot] = await Promise.all([
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
    prisma.message.findFirst({
      where: {
        type: "SYSTEM",
        content: {
          contains: campaignSnapshotPrefix,
        },
        channel: {
          forgeId: req.params.id,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
        content: true,
      },
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

  const snapshot = latestOptimizationSnapshot ? parseCampaignSnapshot(latestOptimizationSnapshot.content) : null;
  const campaignLoop = snapshot
    ? (() => {
        const evaluations = snapshot.weakestSources.map((baseline) => {
          const current = sourceStats.find((entry) => entry.source === baseline.source);
          const currentViews = current?.viewCount ?? baseline.views;
          const currentJoins = current?.joinCount ?? baseline.joins;
          const currentConversionRate = toPercent(currentJoins, Math.max(1, currentViews));
          const deltaViews = Math.max(0, currentViews - baseline.views);
          const deltaJoins = Math.max(0, currentJoins - baseline.joins);
          const deltaConversionRate = currentConversionRate - baseline.conversionRate;

          const state = deltaViews < 10 ? "collecting" : deltaConversionRate >= 3 ? "improved" : "stalled";

          return {
            source: baseline.source,
            baselineViews: baseline.views,
            baselineJoins: baseline.joins,
            baselineConversionRate: baseline.conversionRate,
            currentViews,
            currentJoins,
            currentConversionRate,
            deltaViews,
            deltaJoins,
            deltaConversionRate,
            state,
          };
        });

        const improvedCount = evaluations.filter((entry) => entry.state === "improved").length;
        const stalledCount = evaluations.filter((entry) => entry.state === "stalled").length;
        const collectingCount = evaluations.filter((entry) => entry.state === "collecting").length;

        const status = collectingCount > 0 ? "collecting" : improvedCount >= Math.ceil(evaluations.length / 2) ? "improving" : "needs-attention";

        const recommendation =
          status === "collecting"
            ? "Collect at least 10 new views per tracked source before declaring winners."
            : status === "improving"
              ? "Promote improving creatives and replicate across adjacent channels."
              : "Rewrite weak source copy and retest with urgency-driven CTAs in the next 24h.";

        return {
          capturedAt: snapshot.capturedAt,
          generatedAt: latestOptimizationSnapshot?.createdAt,
          status,
          recommendation,
          improvedCount,
          stalledCount,
          collectingCount,
          evaluations,
        };
      })()
    : null;

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
      campaignLoop,
    },
  });
});

forgesRouter.get("/:id/onboarding-health", async (req, res) => {
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
    select: {
      id: true,
      inviteCode: true,
      inviteViewCount: true,
      inviteJoinCount: true,
      channels: {
        select: {
          type: true,
        },
      },
      members: {
        select: {
          id: true,
        },
      },
      roles: {
        select: {
          id: true,
        },
      },
      botInstallations: {
        where: {
          enabled: true,
        },
        select: {
          id: true,
        },
      },
    },
  });

  if (!forge) {
    res.status(404).json({ error: "Forge not found" });
    return;
  }

  const hasVoiceSurface = forge.channels.some((channel) => channel.type === "VOICE" || channel.type === "STAGE");
  const inviteConversionRate = toPercent(forge.inviteJoinCount, Math.max(1, forge.inviteViewCount));

  const tasks = [
    {
      id: "channels",
      label: "Core channels live",
      description: "Keep at least 3 channels active for launch navigation.",
      completed: forge.channels.length >= 3,
      value: forge.channels.length,
      target: 3,
      action: "Add channels for key conversations.",
      recommendedAction: "SEED_CORE_CHANNELS" as const,
    },
    {
      id: "voice",
      label: "Voice ready",
      description: "Enable at least one voice or stage channel for live sessions.",
      completed: hasVoiceSurface,
      value: hasVoiceSurface ? 1 : 0,
      target: 1,
      action: "Create a voice channel for real-time sessions.",
      recommendedAction: "SEED_CORE_CHANNELS" as const,
    },
    {
      id: "invite",
      label: "Custom invite active",
      description: "Set a stable invite slug your audience can remember.",
      completed: Boolean(forge.inviteCode && forge.inviteCode.length >= 3),
      value: forge.inviteCode ? 1 : 0,
      target: 1,
      action: "Claim a custom invite slug in forge controls.",
      recommendedAction: null,
    },
    {
      id: "traffic",
      label: "Invite traffic",
      description: "Drive first audience flow to validate conversion loops.",
      completed: forge.inviteViewCount >= 25,
      value: forge.inviteViewCount,
      target: 25,
      action: "Share your tagged invite and collect first 25 views.",
      recommendedAction: "LAUNCH_SHARE_CAMPAIGNS" as const,
    },
    {
      id: "campaign-loop",
      label: "Conversion loop",
      description: "Optimize weak channels after traffic starts to lift join conversion.",
      completed: forge.inviteViewCount < 25 || inviteConversionRate >= 12,
      value: inviteConversionRate,
      target: 12,
      action: "Run source-level optimization on campaign performance.",
      recommendedAction: forge.inviteViewCount >= 25 ? ("OPTIMIZE_CAMPAIGNS" as const) : null,
    },
    {
      id: "members",
      label: "Early members",
      description: "Reach 5 members to unlock initial network effects.",
      completed: forge.members.length >= 5,
      value: forge.members.length,
      target: 5,
      action: "Invite trusted members to seed activity.",
      recommendedAction: "PUBLISH_MEMBER_RECRUITMENT_POST" as const,
    },
    {
      id: "roles",
      label: "Role structure",
      description: "Create at least one role beyond Owner for moderation scale.",
      completed: forge.roles.length >= 2,
      value: forge.roles.length,
      target: 2,
      action: "Add a moderator or operator role.",
      recommendedAction: "CREATE_MODERATOR_ROLE" as const,
    },
    {
      id: "automation",
      label: "Automation online",
      description: "Install one enabled bot to automate repetitive ops.",
      completed: forge.botInstallations.length >= 1,
      value: forge.botInstallations.length,
      target: 1,
      action: "Install a bot from Bot Studio and enable it.",
      recommendedAction: "ENABLE_STARTER_AUTOMATION" as const,
    },
  ];

  const completedCount = tasks.filter((task) => task.completed).length;
  const score = toOnboardingScore(completedCount, tasks.length);

  res.json({
    health: {
      summary: {
        completedCount,
        totalCount: tasks.length,
        score,
      },
      tasks,
      nextAction: tasks.find((task) => !task.completed)?.action ?? "Onboarding complete. Scale campaigns and retention loops.",
    },
  });
});

forgesRouter.post("/:id/onboarding-actions", async (req, res) => {
  const parsed = onboardingActionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const forge = await prisma.forge.findUnique({
    where: { id: req.params.id },
    select: { id: true, ownerId: true, inviteCode: true },
  });

  if (!forge) {
    res.status(404).json({ error: "Forge not found" });
    return;
  }

  if (forge.ownerId !== req.user!.id) {
    res.status(403).json({ error: "Only forge owners can run onboarding actions" });
    return;
  }

  if (parsed.data.action === "SEED_CORE_CHANNELS") {
    const targets = [
      { name: "general", type: "TEXT" as const },
      { name: "announcements", type: "ANNOUNCEMENT" as const },
      { name: "Squad Voice", type: "VOICE" as const },
    ];

    const existing = await prisma.channel.findMany({
      where: { forgeId: forge.id },
      select: { name: true, position: true },
    });

    const existingNames = new Set(existing.map((channel) => channel.name.trim().toLowerCase()));
    const highestPosition = existing.length ? Math.max(...existing.map((channel) => channel.position)) : -1;

    const data = targets
      .filter((target) => !existingNames.has(target.name.toLowerCase()))
      .map((target, index) => ({
        forgeId: forge.id,
        name: target.name,
        type: target.type,
        position: highestPosition + index + 1,
      }));

    if (data.length > 0) {
      await prisma.channel.createMany({ data });
    }

    res.status(200).json({
      ok: true,
      action: parsed.data.action,
      createdChannels: data.length,
      message: data.length > 0 ? "Core channels seeded" : "Core channels already configured",
    });
    return;
  }

  if (parsed.data.action === "CREATE_MODERATOR_ROLE") {
    const existingRole = await prisma.role.findFirst({
      where: {
        forgeId: forge.id,
        name: {
          equals: "Moderator",
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (!existingRole) {
      const maxRolePosition = await prisma.role.aggregate({
        where: { forgeId: forge.id },
        _max: { position: true },
      });

      await prisma.role.create({
        data: {
          forgeId: forge.id,
          name: "Moderator",
          color: "#f59e0b",
          permissions: {
            manageChannels: true,
            banUsers: true,
            kickUsers: true,
            manageRoles: false,
            moderateChat: true,
            streamAccess: true,
          },
          position: Math.max(1, (maxRolePosition._max.position ?? 0) - 1),
        },
      });
    }

    res.status(200).json({
      ok: true,
      action: parsed.data.action,
      message: existingRole ? "Moderator role already exists" : "Moderator role created",
    });
    return;
  }

  if (parsed.data.action === "LAUNCH_SHARE_CAMPAIGNS") {
    const channels = await prisma.channel.findMany({
      where: { forgeId: forge.id },
      select: { id: true, name: true, type: true, position: true },
      orderBy: { position: "asc" },
    });

    let announcementsChannel = channels.find((channel) => channel.type === "ANNOUNCEMENT");

    if (!announcementsChannel) {
      const nextPosition = channels.length ? Math.max(...channels.map((channel) => channel.position)) + 1 : 0;
      announcementsChannel = await prisma.channel.create({
        data: {
          forgeId: forge.id,
          name: "announcements",
          type: "ANNOUNCEMENT",
          position: nextPosition,
        },
        select: { id: true, name: true, type: true, position: true },
      });
    }

    const campaignTemplateTag = "[Growth Launch Blueprint]";
    const existingCampaignPost = await prisma.message.findFirst({
      where: {
        channelId: announcementsChannel.id,
        content: {
          contains: campaignTemplateTag,
        },
      },
      select: { id: true },
    });

    const relativeInvitePath = `/invite/${encodeURIComponent(forge.inviteCode)}`;
    const campaignSources = ["social", "stream", "partner", "campaign"];
    const campaignBody = [
      campaignTemplateTag,
      "Run this outbound sequence now:",
      `- Core invite: ${relativeInvitePath}`,
      ...campaignSources.map((source) => `- ${source}: ${relativeInvitePath}?src=${source}`),
      "Post all four links in their matching channels and track conversion in Invite Growth Intelligence.",
    ].join("\n");

    if (!existingCampaignPost) {
      await prisma.message.create({
        data: {
          channelId: announcementsChannel.id,
          content: campaignBody,
          type: "SYSTEM",
        },
      });
    }

    for (const source of ["direct", ...campaignSources]) {
      await prisma.inviteSourceStat.upsert({
        where: {
          forgeId_source: {
            forgeId: forge.id,
            source,
          },
        },
        update: {},
        create: {
          forgeId: forge.id,
          source,
        },
      });
    }

    res.status(200).json({
      ok: true,
      action: parsed.data.action,
      message: existingCampaignPost ? "Campaign blueprint already published" : "Campaign blueprint published",
    });
    return;
  }

  if (parsed.data.action === "PUBLISH_MEMBER_RECRUITMENT_POST") {
    const channels = await prisma.channel.findMany({
      where: { forgeId: forge.id },
      select: { id: true, name: true, type: true, position: true },
      orderBy: { position: "asc" },
    });

    let introductionsChannel = channels.find(
      (channel) => channel.type === "TEXT" && channel.name.trim().toLowerCase() === "introductions",
    );

    if (!introductionsChannel) {
      const nextPosition = channels.length ? Math.max(...channels.map((channel) => channel.position)) + 1 : 0;
      introductionsChannel = await prisma.channel.create({
        data: {
          forgeId: forge.id,
          name: "introductions",
          type: "TEXT",
          position: nextPosition,
        },
        select: { id: true, name: true, type: true, position: true },
      });
    }

    const role = await prisma.role.findFirst({
      where: {
        forgeId: forge.id,
        name: {
          equals: "Founding Member",
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (!role) {
      const maxRolePosition = await prisma.role.aggregate({
        where: { forgeId: forge.id },
        _max: { position: true },
      });

      await prisma.role.create({
        data: {
          forgeId: forge.id,
          name: "Founding Member",
          color: "#22d3ee",
          permissions: {
            manageChannels: false,
            banUsers: false,
            kickUsers: false,
            manageRoles: false,
            moderateChat: false,
            streamAccess: true,
          },
          position: Math.max(1, (maxRolePosition._max.position ?? 0) - 2),
        },
      });
    }

    const recruitmentTag = "[Founding Member Roll Call]";
    const existingRecruitmentPost = await prisma.message.findFirst({
      where: {
        channelId: introductionsChannel.id,
        content: {
          contains: recruitmentTag,
        },
      },
      select: { id: true },
    });

    if (!existingRecruitmentPost) {
      await prisma.message.create({
        data: {
          channelId: introductionsChannel.id,
          content: [
            recruitmentTag,
            "Welcome to launch week.",
            "Drop your intro, your timezone, and one thing you want from this forge.",
            "First members get the Founding Member role.",
          ].join("\n"),
          type: "SYSTEM",
        },
      });
    }

    res.status(200).json({
      ok: true,
      action: parsed.data.action,
      message: existingRecruitmentPost ? "Recruitment post already published" : "Recruitment post published",
    });
    return;
  }

  if (parsed.data.action === "OPTIMIZE_CAMPAIGNS") {
    const channels = await prisma.channel.findMany({
      where: { forgeId: forge.id },
      select: { id: true, name: true, type: true, position: true },
      orderBy: { position: "asc" },
    });

    let announcementsChannel = channels.find((channel) => channel.type === "ANNOUNCEMENT");

    if (!announcementsChannel) {
      const nextPosition = channels.length ? Math.max(...channels.map((channel) => channel.position)) + 1 : 0;
      announcementsChannel = await prisma.channel.create({
        data: {
          forgeId: forge.id,
          name: "announcements",
          type: "ANNOUNCEMENT",
          position: nextPosition,
        },
        select: { id: true, name: true, type: true, position: true },
      });
    }

    const sourceStats = await prisma.inviteSourceStat.findMany({
      where: {
        forgeId: forge.id,
        viewCount: {
          gte: 5,
        },
      },
      orderBy: [{ joinCount: "asc" }, { viewCount: "desc" }],
      take: 6,
    });

    if (sourceStats.length === 0) {
      res.status(200).json({
        ok: true,
        action: parsed.data.action,
        message: "Insufficient source volume for optimization yet",
      });
      return;
    }

    const weakestSources = sourceStats
      .map((source) => ({
        source: source.source,
        views: source.viewCount,
        joins: source.joinCount,
        conversionRate: toPercent(source.joinCount, source.viewCount),
      }))
      .sort((left, right) => left.conversionRate - right.conversionRate)
      .slice(0, 3);

    const recentOptimizationPost = await prisma.message.findFirst({
      where: {
        channelId: announcementsChannel.id,
        content: {
          contains: campaignOptimizationTag,
        },
        createdAt: {
          gte: new Date(Date.now() - 1000 * 60 * 60),
        },
      },
      select: { id: true },
    });

    if (recentOptimizationPost) {
      res.status(200).json({
        ok: true,
        action: parsed.data.action,
        message: "Optimization checklist already published recently",
      });
      return;
    }

    const snapshotPayload: CampaignSnapshot = {
      capturedAt: new Date().toISOString(),
      weakestSources,
    };

    const optimizationBody = [
      campaignOptimizationTag,
      "Prioritize these sources now:",
      ...weakestSources.map(
        (source, index) =>
          `${index + 1}. ${source.source} -> ${source.joins} joins / ${source.views} views (${source.conversionRate}%).`,
      ),
      "Actions:",
      "- Refresh creative for each weak source.",
      "- Repost with a stronger call-to-action and urgency.",
      "- Compare conversion again after the next 25 views.",
      `${campaignSnapshotPrefix}${JSON.stringify(snapshotPayload)}`,
    ].join("\n");

    await prisma.message.create({
      data: {
        channelId: announcementsChannel.id,
        content: optimizationBody,
        type: "SYSTEM",
      },
    });

    res.status(200).json({
      ok: true,
      action: parsed.data.action,
      message: "Optimization checklist published",
    });
    return;
  }

  const starterBotName = "NexusForge Ops Bot";
  const starterCommandName = "ops-pulse";

  let bot = await prisma.botApp.findFirst({
    where: {
      ownerId: req.user!.id,
      name: {
        equals: starterBotName,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (!bot) {
    bot = await prisma.botApp.create({
      data: {
        ownerId: req.user!.id,
        name: starterBotName,
        description: "Auto-seeded operations assistant for launch readiness.",
        inviteCode: `bot-${randomUUID().slice(0, 10)}`,
        isPublic: false,
        intents: ["moderation", "analytics", "automation"],
      },
      select: { id: true },
    });
  } else {
    await prisma.botApp.update({
      where: { id: bot.id },
      data: {
        isPublic: false,
        intents: ["moderation", "analytics", "automation"],
      },
    });
  }

  const installation = await prisma.forgeBotInstallation.upsert({
    where: {
      forgeId_botId: {
        forgeId: forge.id,
        botId: bot.id,
      },
    },
    update: {
      enabled: true,
      installedById: req.user!.id,
    },
    create: {
      forgeId: forge.id,
      botId: bot.id,
      installedById: req.user!.id,
      enabled: true,
    },
    select: { id: true },
  });

  const existingCommand = await prisma.botCommand.findFirst({
    where: {
      forgeId: forge.id,
      name: starterCommandName,
    },
    select: { id: true },
  });

  if (!existingCommand) {
    await prisma.botCommand.create({
      data: {
        forgeId: forge.id,
        installationId: installation.id,
        name: starterCommandName,
        description: "Reports launch operations status for the forge.",
        responseTemplate: "Ops pulse: {forge} is stable. Requested by {userName}.",
        commandPreset: "UTILITY",
        requiredPermission: "NONE",
        enabled: true,
      },
    });
  }

  res.status(200).json({
    ok: true,
    action: parsed.data.action,
    message: "Starter automation enabled",
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
