import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { botCommandPresetOptions, botPermissionOptions, getBotCommandPreset, renderBotCommandResponse } from "../lib/bot-commands.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

const createBotSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(300).optional(),
  avatar: z.string().url().optional(),
  isPublic: z.boolean().default(true),
  intents: z.array(z.string().min(2).max(40)).max(20).default([]),
});

const updateBotSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  description: z.string().max(300).optional(),
  avatar: z.string().url().optional(),
  isPublic: z.boolean().optional(),
  intents: z.array(z.string().min(2).max(40)).max(20).optional(),
});

const installBotSchema = z.object({
  forgeId: z.string().uuid(),
  inviteCode: z.string().min(6).max(40),
});

const toggleInstallationSchema = z.object({
  enabled: z.boolean(),
});

const createCommandSchema = z.object({
  forgeId: z.string().uuid(),
  installationId: z.string().uuid(),
  name: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/i),
  description: z.string().max(180).optional(),
  responseTemplate: z.string().min(1).max(1200),
  requiredPermission: z.enum(botPermissionOptions).default("NONE"),
  preset: z.enum(botCommandPresetOptions).default("CUSTOM"),
});

const updateCommandSchema = z.object({
  description: z.string().max(180).optional(),
  responseTemplate: z.string().min(1).max(1200).optional(),
  requiredPermission: z.enum(botPermissionOptions).optional(),
  enabled: z.boolean().optional(),
});

const executeCommandSchema = z.object({
  forgeId: z.string().uuid(),
  name: z.string().min(2).max(40),
});

async function isForgeOwner(userId: string, forgeId: string): Promise<boolean> {
  const forge = await prisma.forge.findUnique({
    where: { id: forgeId },
    select: { ownerId: true },
  });

  return Boolean(forge && forge.ownerId === userId);
}

async function hasForgePermission(userId: string, forgeId: string, permissionKey: string): Promise<boolean> {
  if (permissionKey === "NONE") {
    return true;
  }

  const member = await prisma.forgeMember.findUnique({
    where: {
      userId_forgeId: {
        userId,
        forgeId,
      },
    },
    include: {
      roleLinks: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!member) {
    return false;
  }

  return member.roleLinks.some((link) => {
    const permissions = link.role.permissions as Record<string, boolean>;
    return Boolean(permissions[permissionKey]);
  });
}

export const botsRouter = Router();

botsRouter.use(requireAuth);

botsRouter.get("/my", async (req, res) => {
  const bots = await prisma.botApp.findMany({
    where: { ownerId: req.user!.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      avatar: true,
      inviteCode: true,
      isPublic: true,
      intents: true,
      createdAt: true,
    },
  });

  res.json({ bots });
});

botsRouter.get("/catalog", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  const bots = await prisma.botApp.findMany({
    where: {
      AND: [
        {
          OR: [{ ownerId: req.user!.id }, { isPublic: true }],
        },
        ...(q
          ? [
              {
                OR: [
                  { name: { contains: q, mode: "insensitive" as const } },
                  { description: { contains: q, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ ownerId: "asc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      name: true,
      description: true,
      avatar: true,
      inviteCode: true,
      isPublic: true,
      intents: true,
      ownerId: true,
      createdAt: true,
    },
  });

  res.json({ bots });
});

botsRouter.use(requireCsrf);

botsRouter.post("/", async (req, res) => {
  const parsed = createBotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const inviteCode = `bot-${randomUUID().slice(0, 10)}`;

  const bot = await prisma.botApp.create({
    data: {
      ownerId: req.user!.id,
      name: parsed.data.name,
      description: parsed.data.description,
      avatar: parsed.data.avatar,
      inviteCode,
      isPublic: parsed.data.isPublic,
      intents: parsed.data.intents,
    },
    select: {
      id: true,
      name: true,
      description: true,
      avatar: true,
      inviteCode: true,
      isPublic: true,
      intents: true,
      createdAt: true,
    },
  });

  res.status(201).json({ bot });
});

botsRouter.patch("/:botId", async (req, res) => {
  const parsed = updateBotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.botApp.findUnique({
    where: { id: req.params.botId },
    select: { id: true, ownerId: true },
  });

  if (!existing) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  if (existing.ownerId !== req.user!.id) {
    res.status(403).json({ error: "Only bot owners can edit bot settings" });
    return;
  }

  const bot = await prisma.botApp.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.avatar !== undefined ? { avatar: parsed.data.avatar } : {}),
      ...(parsed.data.isPublic !== undefined ? { isPublic: parsed.data.isPublic } : {}),
      ...(parsed.data.intents ? { intents: parsed.data.intents } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      avatar: true,
      inviteCode: true,
      isPublic: true,
      intents: true,
      createdAt: true,
    },
  });

  res.status(200).json({ bot });
});

botsRouter.post("/install", async (req, res) => {
  const parsed = installBotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const [forge, bot] = await Promise.all([
    prisma.forge.findUnique({
      where: { id: parsed.data.forgeId },
      select: { id: true, ownerId: true },
    }),
    prisma.botApp.findUnique({
      where: { inviteCode: parsed.data.inviteCode },
      select: { id: true, inviteCode: true, isPublic: true, ownerId: true },
    }),
  ]);

  if (!forge) {
    res.status(404).json({ error: "Forge not found" });
    return;
  }

  if (forge.ownerId !== req.user!.id) {
    res.status(403).json({ error: "Only forge owners can install bots" });
    return;
  }

  if (!bot) {
    res.status(404).json({ error: "Bot invite is invalid" });
    return;
  }

  if (!bot.isPublic && bot.ownerId !== req.user!.id) {
    res.status(403).json({ error: "This bot is private" });
    return;
  }

  const installation = await prisma.forgeBotInstallation.upsert({
    where: {
      forgeId_botId: {
        forgeId: forge.id,
        botId: bot.id,
      },
    },
    update: {
      installedById: req.user!.id,
      enabled: true,
    },
    create: {
      forgeId: forge.id,
      botId: bot.id,
      installedById: req.user!.id,
      enabled: true,
    },
    select: {
      id: true,
      enabled: true,
      createdAt: true,
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
  });

  res.status(201).json({ installation });
});

botsRouter.patch("/installations/:installationId", async (req, res) => {
  const parsed = toggleInstallationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const installation = await prisma.forgeBotInstallation.findUnique({
    where: { id: req.params.installationId },
    include: {
      forge: {
        select: {
          id: true,
          ownerId: true,
        },
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
  });

  if (!installation) {
    res.status(404).json({ error: "Bot installation not found" });
    return;
  }

  if (installation.forge.ownerId !== req.user!.id) {
    res.status(403).json({ error: "Only forge owners can manage installed bots" });
    return;
  }

  const updated = await prisma.forgeBotInstallation.update({
    where: { id: installation.id },
    data: {
      enabled: parsed.data.enabled,
    },
    select: {
      id: true,
      enabled: true,
      createdAt: true,
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
  });

  res.status(200).json({ installation: updated });
});

botsRouter.post("/commands", async (req, res) => {
  const parsed = createCommandSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const owner = await isForgeOwner(req.user!.id, parsed.data.forgeId);
  if (!owner) {
    res.status(403).json({ error: "Only forge owners can register bot commands" });
    return;
  }

  const installation = await prisma.forgeBotInstallation.findUnique({
    where: { id: parsed.data.installationId },
    select: { id: true, forgeId: true },
  });

  if (!installation || installation.forgeId !== parsed.data.forgeId) {
    res.status(400).json({ error: "Invalid bot installation for this forge" });
    return;
  }

  const presetConfig = getBotCommandPreset(parsed.data.preset);

  const command = await prisma.botCommand.create({
    data: {
      forgeId: parsed.data.forgeId,
      installationId: parsed.data.installationId,
      name: (presetConfig?.name ?? parsed.data.name).toLowerCase(),
      description: presetConfig?.description ?? parsed.data.description,
      responseTemplate: presetConfig?.responseTemplate ?? parsed.data.responseTemplate,
      commandPreset: parsed.data.preset,
      requiredPermission: presetConfig?.requiredPermission ?? parsed.data.requiredPermission,
      enabled: true,
    },
  });

  res.status(201).json({ command });
});

botsRouter.patch("/commands/:commandId", async (req, res) => {
  const parsed = updateCommandSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.botCommand.findUnique({
    where: { id: req.params.commandId },
    select: { id: true, forgeId: true, commandPreset: true },
  });

  if (!existing) {
    res.status(404).json({ error: "Bot command not found" });
    return;
  }

  const owner = await isForgeOwner(req.user!.id, existing.forgeId);
  if (!owner) {
    res.status(403).json({ error: "Only forge owners can update bot commands" });
    return;
  }

  const presetConfig = getBotCommandPreset(existing.commandPreset);

  const command = await prisma.botCommand.update({
    where: { id: existing.id },
    data: {
      ...(presetConfig
        ? {
            description: presetConfig.description,
            responseTemplate: presetConfig.responseTemplate,
            requiredPermission: presetConfig.requiredPermission,
          }
        : {}),
      ...(!presetConfig && parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(!presetConfig && parsed.data.responseTemplate !== undefined ? { responseTemplate: parsed.data.responseTemplate } : {}),
      ...(!presetConfig && parsed.data.requiredPermission !== undefined ? { requiredPermission: parsed.data.requiredPermission } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
    },
  });

  res.status(200).json({ command });
});

botsRouter.post("/commands/execute", async (req, res) => {
  const parsed = executeCommandSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const command = await prisma.botCommand.findFirst({
    where: {
      forgeId: parsed.data.forgeId,
      name: parsed.data.name.toLowerCase(),
      enabled: true,
      installation: {
        enabled: true,
      },
    },
    include: {
      installation: {
        include: {
          bot: {
            select: {
              id: true,
              name: true,
              intents: true,
            },
          },
        },
      },
    },
  });

  if (!command) {
    res.status(404).json({ error: "Bot command not found or disabled" });
    return;
  }

  const hasPermission = await hasForgePermission(req.user!.id, parsed.data.forgeId, command.requiredPermission);
  if (!hasPermission) {
    res.status(403).json({
      error: "Missing required permission for this bot command",
      requiredPermission: command.requiredPermission,
    });
    return;
  }

  const forge = await prisma.forge.findUnique({
    where: { id: parsed.data.forgeId },
    select: { name: true },
  });

  res.status(200).json({
    ok: true,
    output: {
      command: command.name,
      botName: command.installation.bot.name,
      intents: command.installation.bot.intents,
      response: renderBotCommandResponse(command.responseTemplate, {
        userId: req.user!.id,
        userName: req.user!.username,
        forgeName: forge?.name ?? "Unknown Forge",
        channelName: "command-center",
        commandName: command.name,
        botName: command.installation.bot.name,
        args: "",
      }),
    },
  });
});