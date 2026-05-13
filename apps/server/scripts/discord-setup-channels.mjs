import { config as loadDotEnv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ChannelType, REST, Routes } from "discord.js";

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

async function ensureCategory(rest, guildId, channels) {
  const existing = channels.find(
    (channel) => channel.type === ChannelType.GuildCategory && normalizeName(channel.name) === normalizeName(categoryName),
  );

  if (existing) {
    return { categoryId: existing.id, created: false };
  }

  const created = await rest.post(Routes.guildChannels(guildId), {
    body: {
      name: categoryName,
      type: ChannelType.GuildCategory,
      position: 0,
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
  const targetId = process.argv[2] || process.env.DISCORD_GUILD_ID || "";

  if (!token) {
    console.error("[discord:setup:channels] FAIL: DISCORD_BOT_TOKEN is missing");
    process.exitCode = 1;
    return;
  }

  if (!targetId) {
    console.error("[discord:setup:channels] FAIL: Provide guild/category ID as argv[2] or DISCORD_GUILD_ID");
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
      const channel = await rest.get(Routes.channel(targetId));
      if (!channel?.guild_id) {
        throw new Error(`Target ${targetId} is not a guild or guild channel.`);
      }
      if (channel.type !== ChannelType.GuildCategory) {
        throw new Error(`Target channel ${targetId} is not a category channel.`);
      }
      guildId = String(channel.guild_id);
      parentCategoryId = String(channel.id);
      guild = await rest.get(Routes.guild(guildId));
    }

    const guildName = guild?.name || guildId;

    const existingChannels = asArray(await rest.get(Routes.guildChannels(guildId)));

    let categoryId = parentCategoryId;
    let categoryCreated = false;
    if (!categoryId) {
      const categoryResult = await ensureCategory(rest, guildId, existingChannels);
      categoryId = categoryResult.categoryId;
      categoryCreated = categoryResult.created;
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
