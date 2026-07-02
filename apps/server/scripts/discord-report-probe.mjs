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

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is missing`);
  }
  return value;
}

async function resolveGuildId(rest, rawTarget) {
  const targetId = String(rawTarget || "").trim();
  if (!targetId) {
    return "";
  }

  try {
    const guild = await rest.get(Routes.guild(targetId));
    const guildId = String(guild?.id || "").trim();
    if (guildId) {
      return guildId;
    }
  } catch {
    // Fall back to channel/category lookup.
  }

  const channel = await rest.get(Routes.channel(targetId));
  const guildId = String(channel?.guild_id || "").trim();
  if (!guildId) {
    throw new Error(`Unable to resolve guild from target ${targetId}`);
  }
  return guildId;
}

async function fetchDiscordRuntime(apiBase) {
  const target = `${apiBase.replace(/\/$/, "")}/api/health/discord`;
  const response = await fetch(target, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Discord health endpoint failed (${response.status})`);
  }
  return response.json();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePositiveInt(value, fallback) {
  const num = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(num) || num <= 0) {
    return fallback;
  }
  return num;
}

async function waitForConnectedRuntime(apiBase) {
  const timeoutMs = parsePositiveInt(process.env.DISCORD_PROBE_WAIT_MS, 45000);
  const pollMs = parsePositiveInt(process.env.DISCORD_PROBE_POLL_MS, 1500);
  const deadline = Date.now() + timeoutMs;
  let lastRuntime = null;
  let lastError = null;

  while (Date.now() <= deadline) {
    try {
      const runtime = await fetchDiscordRuntime(apiBase);
      lastRuntime = runtime;
      const bot = runtime?.bot || runtime?.discord || {};

      const botEnabled = Boolean(bot.enabled);
      const botConfigured = bot.configured === undefined ? true : Boolean(bot.configured);
      const botConnected = bot.connected === undefined ? Boolean(bot.healthy) : Boolean(bot.connected);

      if (!botEnabled) {
        throw new Error("Bot is disabled (DISCORD_BOT_ENABLED=false)");
      }
      if (!botConfigured) {
        throw new Error("Bot is not configured (missing token/client id)");
      }
      if (botConnected) {
        return runtime;
      }

      lastError = `Bot is not connected yet. lastStartupError=${String(bot.lastStartupError || "n/a")}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await sleep(pollMs);
  }

  if (lastRuntime) {
    const bot = lastRuntime?.bot || lastRuntime?.discord || {};
    throw new Error(`Bot did not become connected within ${timeoutMs}ms. lastStartupError=${String(bot.lastStartupError || "n/a")}`);
  }

  throw new Error(`Bot runtime check failed within ${timeoutMs}ms. lastError=${lastError || "n/a"}`);
}

async function resolveReportChannels(rest, guildId, statusName, errorsName, alertsName) {
  const channels = await rest.get(Routes.guildChannels(guildId));
  const list = Array.isArray(channels) ? channels : [];

  const pick = (names) => {
    const wanted = (Array.isArray(names) ? names : [names]).map((name) => normalizeName(name)).filter(Boolean);
    for (const name of wanted) {
      const found = list.find((channel) => normalizeName(String(channel?.name || "")) === name)?.id;
      if (found) {
        return found;
      }
    }
    return null;
  };

  return {
    status: pick([statusName, "bot-status", "announcements"]),
    appHealth: pick([String(process.env.DISCORD_REPORT_CHANNEL_APP_HEALTH || "app-health").trim(), "app-health"]),
    errors: pick([errorsName, "bot-errors", "bug-reports", "bugs"]),
    alerts: pick([alertsName, "bot-alerts", "incident-log", "alerts"]),
  };
}

async function postChannelMessage(rest, channelId, content) {
  const normalized = String(content || "").trim();
  const lower = normalized.toLowerCase();
  const isAlert = lower.includes("[probe][alert]");
  const isError = lower.includes("[probe][error]");
  const title = isAlert ? "Alert Probe" : isError ? "Error Probe" : "Status Probe";
  const color = isAlert ? 0xef4444 : isError ? 0xf59e0b : 0x22d3ee;

  await rest.post(Routes.channelMessages(channelId), {
    body: {
      embeds: [
        {
          title,
          color,
          fields: [
            {
              name: "Details",
              value: normalized.slice(0, 1024),
              inline: false,
            },
          ],
          footer: { text: "NexusForge Bot Operations" },
          timestamp: new Date().toISOString(),
        },
      ],
      allowed_mentions: { parse: [] },
    },
  });
}

async function main() {
  const token = requiredEnv("DISCORD_BOT_TOKEN");
  const configuredApiBase = String(process.env.NEXUSFORGE_API_BASE || "").trim();
  const configuredPort = String(process.env.PORT || "").trim();
  const apiBase = configuredApiBase || (configuredPort ? `http://127.0.0.1:${configuredPort}` : "http://127.0.0.1:4000");
  const runtime = await waitForConnectedRuntime(apiBase);
  const bot = runtime?.bot || runtime?.discord || {};

  const botEnabled = Boolean(bot.enabled);
  const botConfigured = bot.configured === undefined ? true : Boolean(bot.configured);
  const botConnected = bot.connected === undefined ? Boolean(bot.healthy) : Boolean(bot.connected);

  if (!botEnabled) {
    throw new Error("Bot is disabled (DISCORD_BOT_ENABLED=false)");
  }
  if (!botConfigured) {
    throw new Error("Bot is not configured (missing token/client id)");
  }
  if (!botConnected) {
    throw new Error(`Bot is not connected. lastStartupError=${String(bot.lastStartupError || "n/a")}`);
  }

  const rest = new REST({ version: "10" }).setToken(token);

  const runtimeRouteTarget = String(bot?.routes?.[0]?.channelId || "").trim();

  const rawTarget =
    String(process.argv[2] || "").trim() ||
    String(process.env.DISCORD_REPORT_GUILD_ID || "").trim() ||
    String(process.env.DISCORD_GUILD_ID || "").trim() ||
    String(process.env.DISCORD_DOWNLOAD_TARGET_ID || "").trim() ||
    String(bot.reportGuildId || "").trim() ||
    String(bot.guildId || "").trim() ||
    runtimeRouteTarget;

  if (!rawTarget) {
    throw new Error("Provide target via argv[2], DISCORD_REPORT_GUILD_ID, DISCORD_GUILD_ID, or DISCORD_DOWNLOAD_TARGET_ID");
  }

  const guildId = await resolveGuildId(rest, rawTarget);

  const statusChannelName = String(process.env.DISCORD_REPORT_CHANNEL_STATUS || "bot-status").trim();
  const errorsChannelName = String(process.env.DISCORD_REPORT_CHANNEL_ERRORS || "bot-errors").trim();
  const alertsChannelName = String(process.env.DISCORD_REPORT_CHANNEL_ALERTS || "bot-alerts").trim();

  const channels = await resolveReportChannels(rest, guildId, statusChannelName, errorsChannelName, alertsChannelName);

  if ((!channels.status && !channels.appHealth) || !channels.errors || !channels.alerts) {
    throw new Error(
      `Missing report channels. resolved status=${channels.status || "none"}, appHealth=${channels.appHealth || "none"}, errors=${channels.errors || "none"}, alerts=${channels.alerts || "none"}`,
    );
  }

  const stamp = new Date().toISOString();
  await postChannelMessage(rest, channels.appHealth || channels.status, `[probe][status] Bot runtime healthy at ${stamp}`);
  await postChannelMessage(rest, channels.errors, `[probe][error] Test issue message from NexusForge ops probe at ${stamp}`);
  await postChannelMessage(rest, channels.alerts, `[probe][alert] Test alert message from NexusForge ops probe at ${stamp}`);

  console.log(`[discord:probe] PASS: bot connected and report messages posted (status/errors/alerts) for guild ${guildId}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[discord:probe] FAIL: ${message}`);
  process.exitCode = 1;
});
