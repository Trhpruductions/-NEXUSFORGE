import { config as loadDotEnv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ChannelType, PermissionFlagsBits, REST, Routes } from "discord.js";

const localEnvPath = fileURLToPath(new URL("../.env", import.meta.url));
const envPaths = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "apps/server/.env"),
  localEnvPath,
];

for (const path of envPaths) {
  loadDotEnv({ path, override: false });
}

const categoryName = "NexusForge Ops";

const channelPlan = [
  { name: "app-downloads", topic: "Official NexusForge app installer, launcher links, and update notices." },
  { name: "app-health", topic: "Service uptime checks, API health, and runtime readiness updates." },
  { name: "app-runtime", topic: "Runtime mode changes, startup diagnostics, and operational state transitions." },
  { name: "app-release-ops", topic: "Release readiness checks, deployment notes, and rollback coordination." },
  { name: "app-security", topic: "Security findings, hardening actions, and incident triage updates." },
  { name: "app-performance", topic: "Performance regressions, latency trends, and optimization tracking." },
  { name: "app-user-feedback", topic: "User-facing issues, UX pain points, and improvement requests." },
  { name: "bot-status", topic: "Bot heartbeat, startup/shutdown, and service state updates." },
  { name: "bot-errors", topic: "Runtime exceptions and command failures from the NexusForge bot." },
  { name: "bot-alerts", topic: "Actionable alerts requiring moderator/admin attention." },
  { name: "bug-reports", topic: "User-reported issues and reproducible bug reports." },
  { name: "incident-log", topic: "Incident timeline, mitigation notes, and postmortem breadcrumbs." },
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

const roleName = "NexusForge";
const rolePermissionOverwriteBits =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.ReadMessageHistory;

function findRole(roles, name) {
  return roles.find((role) => normalizeName(role.name) === normalizeName(name));
}

async function ensureRole(rest, guildId) {
  const existingRoles = asArray(await rest.get(Routes.guildRoles(guildId)));
  const existing = findRole(existingRoles, roleName);
  if (existing) {
    return { roleId: existing.id, created: false };
  }

  const created = await rest.post(Routes.guildRoles(guildId), {
    body: {
      name: roleName,
      permissions: "0",
      mentionable: true,
      hoist: false,
    },
  });

  return { roleId: created.id, created: true };
}

function buildCategoryPermissionOverwrites(guildId, roleId) {
  return [
    {
      id: guildId,
      type: 0,
      deny: String(PermissionFlagsBits.ViewChannel),
    },
    {
      id: roleId,
      type: 0,
      allow: String(rolePermissionOverwriteBits),
    },
  ];
}

async function ensureCategoryPermissions(rest, categoryId, guildId, roleId) {
  const category = await rest.get(Routes.channel(categoryId));
  const existingOverwrites = asArray(category.permission_overwrites ?? []);
  const desired = buildCategoryPermissionOverwrites(guildId, roleId);

  const needsUpdate = desired.some((expected) => {
    const existing = existingOverwrites.find(
      (overwrite) => String(overwrite.id) === String(expected.id),
    );
    return (
      !existing ||
      String(existing.allow || "") !== String(expected.allow || "") ||
      String(existing.deny || "") !== String(expected.deny || "")
    );
  });

  if (needsUpdate) {
    await rest.patch(Routes.channel(categoryId), {
      body: {
        permission_overwrites: desired,
      },
    });
  }
}

async function ensureCategory(rest, guildId, channels, roleId) {
  const existing = channels.find(
    (channel) => channel.type === ChannelType.GuildCategory && normalizeName(channel.name) === normalizeName(categoryName),
  );

  if (existing) {
    if (roleId) {
      await ensureCategoryPermissions(rest, existing.id, guildId, roleId);
    }
    return { categoryId: existing.id, created: false };
  }

  const created = await rest.post(Routes.guildChannels(guildId), {
    body: {
      name: categoryName,
      type: ChannelType.GuildCategory,
      position: 0,
      permission_overwrites: buildCategoryPermissionOverwrites(guildId, roleId),
    },
  });

  return { categoryId: created.id, created: true };
}

async function ensureTextChannel(rest, guildId, channels, parentId, spec) {
  const existing = channels.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      normalizeName(channel.name) === normalizeName(spec.name) &&
      String(channel.parent_id || "") === String(parentId),
  );

  if (existing) {
    return { id: existing.id, created: false };
  }

  const created = await rest.post(Routes.guildChannels(guildId), {
    body: {
      name: spec.name,
      type: ChannelType.GuildText,
      topic: spec.topic,
      parent_id: parentId,
    },
  });

  return { id: created.id, created: true };
}

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN || "";
  const targetId =
    process.argv[2] ||
    process.env.DISCORD_REPORT_CATEGORY_ID ||
    process.env.DISCORD_GUILD_ID ||
    "";

  if (!token) {
    console.error("[discord:setup:channels] FAIL: DISCORD_BOT_TOKEN is missing");
    process.exitCode = 1;
    return;
  }

  if (!targetId) {
    console.error("[discord:setup:channels] FAIL: Provide guild/category ID as argv[2], DISCORD_REPORT_CATEGORY_ID, or DISCORD_GUILD_ID");
    process.exitCode = 1;
    return;
  }

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    let guildId = targetId;
    let parentCategoryId = null;

    let guild = null;
    try {
      guild = await rest.get(Routes.guild(targetId));
    } catch {
      guild = null;
    }

    if (!guild) {
      let channel = null;
      try {
        channel = await rest.get(Routes.channel(targetId));
      } catch {
        channel = null;
      }

      if (!channel?.guild_id) {
        throw new Error(`Target ${targetId} is not a guild or resolvable channel.`);
      }

      guildId = String(channel.guild_id);
      if (channel.type === ChannelType.GuildCategory) {
        parentCategoryId = String(channel.id);
      }

      guild = await rest.get(Routes.guild(guildId));
    }

    const guildName = guild?.name || guildId;

    const roleResult = await ensureRole(rest, guildId);

    const existingChannels = asArray(await rest.get(Routes.guildChannels(guildId)));

    let categoryId = parentCategoryId;
    let categoryCreated = false;
    if (!categoryId) {
      const categoryResult = await ensureCategory(rest, guildId, existingChannels, roleResult.roleId);
      categoryId = categoryResult.categoryId;
      categoryCreated = categoryResult.created;
    } else if (roleResult.roleId) {
      await ensureCategoryPermissions(rest, categoryId, guildId, roleResult.roleId);
    }

    const refreshedChannels = asArray(await rest.get(Routes.guildChannels(guildId)));

    const results = [];
    for (const spec of channelPlan) {
      const result = await ensureTextChannel(rest, guildId, refreshedChannels, categoryId, spec);
      results.push({ name: spec.name, ...result });
      if (result.created) {
        refreshedChannels.push({
          id: result.id,
          name: spec.name,
          type: ChannelType.GuildText,
          parent_id: categoryId,
        });
      }
    }

    console.log(`[discord:setup:channels] OK: ${guildName} (${guildId})`);
    console.log(
      `[discord:setup:channels] Role: ${roleName} (${roleResult.roleId}) (${roleResult.created ? "created" : "exists"})`,
    );
    const resolvedCategory = refreshedChannels.find((channel) => String(channel.id) === String(categoryId));
    const resolvedCategoryName = resolvedCategory?.name || categoryName;
    console.log(
      `[discord:setup:channels] Category: ${resolvedCategoryName} (${categoryCreated ? "created" : "exists"})`,
    );
    for (const item of results) {
      console.log(`[discord:setup:channels] #${item.name}: ${item.created ? "created" : "exists"}`);
    }
    process.exitCode = 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[discord:setup:channels] FAIL: ${message}`);
    process.exitCode = 1;
  }
}

void main();
