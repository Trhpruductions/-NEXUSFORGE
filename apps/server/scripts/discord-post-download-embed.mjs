import fs from "node:fs";
import path from "node:path";
import { config as loadDotEnv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ButtonStyle, ChannelType, REST, Routes } from "discord.js";

const localEnvPath = fileURLToPath(new URL("../.env", import.meta.url));
const envPaths = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "apps/server/.env"),
  localEnvPath,
];

for (const filePath of envPaths) {
  loadDotEnv({ path: filePath, override: false });
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHttpStatus(error) {
  const status = Number(error?.status ?? error?.response?.status ?? 0);
  return Number.isFinite(status) ? status : 0;
}

function getRetryAfterMs(error) {
  const retryAfterSeconds = Number(
    error?.data?.retry_after ?? error?.rawError?.retry_after ?? error?.retry_after ?? 0,
  );
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.ceil(retryAfterSeconds * 1000);
  }
  return 0;
}

function isRetryableError(error) {
  const status = getHttpStatus(error);
  if (status === 429 || status >= 500) {
    return true;
  }

  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("socket hang up")
  );
}

async function withDiscordRetry(operationName, action, maxAttempts = 5) {
  let attempt = 1;
  while (attempt <= maxAttempts) {
    try {
      return await action();
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableError(error)) {
        throw error;
      }

      const retryAfterMs = getRetryAfterMs(error);
      const backoffMs = Math.min(12000, 400 * 2 ** (attempt - 1));
      const delayMs = Math.max(retryAfterMs, backoffMs);
      const status = getHttpStatus(error);
      console.warn(
        `[discord:post:download] RETRY: ${operationName} attempt ${attempt}/${maxAttempts} failed (status=${status || "n/a"}); retrying in ${delayMs}ms`,
      );
      await sleep(delayMs);
      attempt += 1;
    }
  }

  throw new Error(`[discord:post:download] Unexpected retry state for ${operationName}`);
}

function getDownloadFolderUrl(downloadUrl) {
  const rawUrl = String(downloadUrl || "").trim();
  if (!rawUrl) {
    return "";
  }

  try {
    const url = new URL(rawUrl);
    url.pathname = url.pathname.replace(/\/[^/]*$/, "/");
    return url.toString().replace(/\/+$/, "/");
  } catch {
    const index = rawUrl.lastIndexOf("/");
    if (index < 0) {
      return rawUrl;
    }
    return `${rawUrl.slice(0, index + 1)}`;
  }
}

function loadDesktopManifest() {
  const candidates = [
    path.resolve(process.cwd(), "apps/web/public/desktop-update.json"),
    path.resolve(process.cwd(), "../web/public/desktop-update.json"),
  ];

  const manifestPath = candidates.find((item) => fs.existsSync(item));
  if (!manifestPath) {
    throw new Error("desktop-update.json not found in workspace");
  }

  const raw = fs.readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(raw);
  const downloadUrl = String(parsed.downloadUrl || "").trim();
  const downloadUrls = (Array.isArray(parsed.downloadUrls) ? parsed.downloadUrls : [])
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);

  return {
    path: manifestPath,
    version: String(parsed.version || "").trim(),
    downloadUrl,
    downloadUrls,
    downloadFolderUrl: getDownloadFolderUrl(downloadUrl),
    sha256: String(parsed.sha256 || "").trim(),
    forceUpdate: Boolean(parsed.forceUpdate),
  };
}

function resolveConfiguredAppUrl() {
  const configured = String(process.env.APP_WEB_URL || "").trim();
  if (!configured || /localhost|127\.0\.0\.1/i.test(configured)) {
    return "";
  }

  try {
    const url = new URL(configured);
    return `${url.origin}`;
  } catch {
    return configured.replace(/\/+$/, "");
  }
}

function resolveLauncherUrl() {
  const configured = resolveConfiguredAppUrl();
  if (configured) {
    return `${configured}/app`;
  }
  return "https://www.nexusforge.app/app";
}

function resolveManifestUrl() {
  const configured = resolveConfiguredAppUrl();
  if (configured) {
    return `${configured}/desktop-update.json`;
  }

  const manifestOverride = String(process.env.NEXUSFORGE_UPDATE_MANIFEST_URL || process.env.DESKTOP_UPDATE_MANIFEST_URL || "").trim();
  if (manifestOverride) {
    return manifestOverride;
  }

  return "https://www.nexusforge.app/desktop-update.json";
}

function isReleaseMessage(message, meId) {
  const authorId = String(message?.author?.id || "");
  if (!authorId || authorId !== meId) {
    return false;
  }

  const title = String(message?.embeds?.[0]?.title || "");
  if (title === "NexusForge App Download + Updates") {
    return true;
  }

  const content = String(message?.content || "");
  return content.includes("Official NexusForge release links.");
}

async function findExistingReleaseMessage(rest, channelId, meId, preferredMessageId) {
  const messageId = String(preferredMessageId || "").trim();
  if (messageId) {
    try {
      const candidate = await withDiscordRetry("fetch preferred release message", () =>
        rest.get(Routes.channelMessage(channelId, messageId)),
      );
      if (isReleaseMessage(candidate, meId)) {
        return candidate;
      }
    } catch {
      // Fall through to paginated discovery.
    }
  }

  let before = undefined;
  for (let page = 0; page < 5; page += 1) {
    const batch = asArray(
      await withDiscordRetry("scan release messages", () =>
        rest.get(
          Routes.channelMessages(channelId, {
            limit: 100,
            ...(before ? { before } : {}),
          }),
        ),
      ),
    );

    if (batch.length === 0) {
      break;
    }

    const existing = batch.find((message) => isReleaseMessage(message, meId));
    if (existing) {
      return existing;
    }

    before = String(batch[batch.length - 1]?.id || "").trim();
    if (!before) {
      break;
    }
  }

  return null;
}

async function resolveGuildAndChannel(rest, targetId, channelName) {
  let guildId = String(process.env.DISCORD_GUILD_ID || "").trim();
  let parentCategoryId = null;
  let channelId = null;

  if (targetId) {
    try {
      const guild = await withDiscordRetry("resolve guild", () => rest.get(Routes.guild(targetId)));
      if (guild?.id) {
        guildId = String(guild.id);
      }
    } catch {
      const targetChannel = await withDiscordRetry("resolve channel", () => rest.get(Routes.channel(targetId)));
      if (!targetChannel?.guild_id) {
        throw new Error(`Target ${targetId} is not a guild or guild channel.`);
      }
      guildId = String(targetChannel.guild_id);
      if (targetChannel.type === ChannelType.GuildCategory) {
        parentCategoryId = String(targetChannel.id);
      }
      if (targetChannel.type === ChannelType.GuildText) {
        channelId = String(targetChannel.id);
      }
    }
  }

  if (!guildId) {
    throw new Error("Unable to resolve guild. Provide guild/category/text channel ID or DISCORD_GUILD_ID.");
  }

  if (!channelId) {
    const channels = asArray(await withDiscordRetry("list guild channels", () => rest.get(Routes.guildChannels(guildId))));
    const desired = normalizeName(channelName);
    const existing = channels.find((channel) => {
      const matchesName = normalizeName(channel.name) === desired;
      const isText = channel.type === ChannelType.GuildText;
      if (!matchesName || !isText) return false;
      if (!parentCategoryId) return true;
      return String(channel.parent_id || "") === String(parentCategoryId);
    });

    if (existing) {
      channelId = String(existing.id);
    } else {
      const created = await withDiscordRetry("create download channel", () =>
        rest.post(Routes.guildChannels(guildId), {
          body: {
            name: channelName,
            type: ChannelType.GuildText,
            topic: "Official NexusForge installer, launcher, and update manifest links.",
            parent_id: parentCategoryId,
          },
        }),
      );
      channelId = String(created.id);
    }
  }

  return { guildId, channelId };
}

async function main() {
  const token = String(process.env.DISCORD_BOT_TOKEN || "").trim();
  const targetId = String(process.argv[2] || process.env.DISCORD_REPORT_GUILD_ID || process.env.DISCORD_GUILD_ID || "").trim();
  const channelName = String(process.argv[3] || "app-downloads").trim();
  const preferredMessageId = String(process.env.DISCORD_DOWNLOAD_MESSAGE_ID || "").trim();

  if (!token) {
    console.error("[discord:post:download] FAIL: DISCORD_BOT_TOKEN is missing");
    process.exitCode = 1;
    return;
  }

  const manifest = loadDesktopManifest();
  if (!manifest.version || !manifest.downloadUrl) {
    throw new Error("desktop-update.json is missing required version/downloadUrl fields");
  }

  const launcherUrl = resolveLauncherUrl();
  const updateManifestUrl = resolveManifestUrl();

  const rest = new REST({ version: "10" }).setToken(token);
  const { guildId, channelId } = await resolveGuildAndChannel(rest, targetId, channelName);

  const fields = [
    { name: "Version", value: manifest.version, inline: true },
    { name: "Force Update", value: manifest.forceUpdate ? "Yes" : "No", inline: true },
    { name: "SHA256", value: manifest.sha256 || "Not provided", inline: false },
    { name: "Installer", value: manifest.downloadUrl, inline: false },
  ];

  if (manifest.downloadFolderUrl) {
    fields.push({ name: "Download Folder", value: manifest.downloadFolderUrl, inline: false });
  }

  if (manifest.downloadUrls.length > 1) {
    fields.push({
      name: "Available installers",
      value: manifest.downloadUrls.map((entry) => `• ${entry}`).join("\n"),
      inline: false,
    });
  }

  fields.push({ name: "Launcher", value: launcherUrl, inline: false });
  fields.push({ name: "Update Manifest", value: updateManifestUrl, inline: false });

  const embed = {
    title: "NexusForge App Download + Updates",
    description:
      "These are the official NexusForge release links. Download the desktop installer, open the launcher, or view the update manifest from this message.",
    color: 0x22d3ee,
    fields,
    footer: { text: `Source: ${manifest.path}` },
    timestamp: new Date().toISOString(),
  };

  const components = [
    {
      type: 1,
      components: [
        { type: 2, style: ButtonStyle.Link, label: "Download installer", url: manifest.downloadUrl },
        ...(manifest.downloadFolderUrl
          ? [{ type: 2, style: ButtonStyle.Link, label: "Browse downloads", url: manifest.downloadFolderUrl }]
          : []),
        { type: 2, style: ButtonStyle.Link, label: "Open launcher", url: launcherUrl },
        { type: 2, style: ButtonStyle.Link, label: "View manifest", url: updateManifestUrl },
      ],
    },
  ];

  const payload = {
    content: "Use these official NexusForge release links to install the desktop app, open the launcher, or load the latest update manifest.",
    embeds: [embed],
    components,
    allowed_mentions: { parse: [] },
  };

  const me = await withDiscordRetry("resolve bot identity", () => rest.get(Routes.user("@me")));
  const meId = String(me?.id || "");
  const existing = await findExistingReleaseMessage(rest, channelId, meId, preferredMessageId);

  let mode = "posted";
  let messageId = "";
  if (existing?.id) {
    const updated = await withDiscordRetry("update download embed", () =>
      rest.patch(Routes.channelMessage(channelId, String(existing.id)), {
        body: payload,
      }),
    );
    mode = "updated";
    messageId = String(updated?.id || existing.id || "");
  } else {
    const posted = await withDiscordRetry("post download embed", () =>
      rest.post(Routes.channelMessages(channelId), {
        body: payload,
      }),
    );
    messageId = String(posted?.id || "");
  }

  console.log(
    `[discord:post:download] OK: ${mode}; guild=${guildId} channel=${channelId} channelName=${channelName} messageId=${messageId || "unknown"}`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[discord:post:download] FAIL: ${message}`);
  process.exit(1);
});
