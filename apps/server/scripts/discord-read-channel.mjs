import { config as loadDotEnv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { REST, Routes } from "discord.js";

const localEnvPath = fileURLToPath(new URL("../.env", import.meta.url));
const envPaths = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "apps/server/.env"),
  localEnvPath,
];

for (const path of envPaths) {
  loadDotEnv({ path, override: false });
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is missing`);
  }
  return value;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatMessage(message) {
  const author = message.author ? `${message.author.username || "unknown"}#${message.author.discriminator || "----"}` : "<unknown>";
  return {
    id: message.id,
    author,
    content: message.content ?? "",
    createdAt: message.timestamp ?? message.created_at ?? null,
    pinned: Boolean(message.pinned),
    embeds: Array.isArray(message.embeds) ? message.embeds.map((embed) => ({ title: embed.title, description: embed.description })) : [],
  };
}

async function fetchMessages(rest, channelId, limit) {
  const accumulated = [];
  let before = undefined;
  let remaining = limit;

  while (remaining > 0) {
    const pageSize = Math.min(100, remaining);
    const page = await rest.get(Routes.channelMessages(channelId, { limit: pageSize, ...(before ? { before } : {}) }));
    if (!Array.isArray(page)) {
      throw new Error("Unexpected response from Discord API.");
    }

    accumulated.push(...page);
    if (page.length < pageSize) {
      break;
    }

    before = page[page.length - 1]?.id;
    if (!before) {
      break;
    }

    remaining -= page.length;
  }

  return accumulated;
}

async function main() {
  const token = requiredEnv("DISCORD_BOT_TOKEN");
  const channelId = String(process.argv[2] || process.env.DISCORD_CHANNEL_ID || "").trim();
  const limit = Math.max(1, Math.min(parsePositiveInt(process.argv[3] || process.env.DISCORD_READ_LIMIT, 50), 500));

  if (!channelId) {
    throw new Error("Provide a Discord channel ID as the first argument, or set DISCORD_CHANNEL_ID.");
  }

  const rest = new REST({ version: "10" }).setToken(token);
  const messages = await fetchMessages(rest, channelId, limit);
  const formatted = messages.map(formatMessage);

  console.log(JSON.stringify({ channelId, count: formatted.length, limit, messages: formatted }, null, 2));
}

main().catch((error) => {
  console.error(`[discord:read-channel] FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
