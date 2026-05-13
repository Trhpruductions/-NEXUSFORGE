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
  return {
    path: manifestPath,
    version: String(parsed.version || "").trim(),
    downloadUrl: String(parsed.downloadUrl || "").trim(),
    sha256: String(parsed.sha256 || "").trim(),
    forceUpdate: Boolean(parsed.forceUpdate),
  };
}

function resolveLauncherUrl(downloadUrl) {
  const configured = String(process.env.APP_WEB_URL || "").trim();
  if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) {
    return configured.endsWith("/app") ? configured : `${configured.replace(/\/+$/, "")}/app`;
  }

  try {
    const origin = new URL(downloadUrl).origin;
    return `${origin}/app`;
  } catch {
    return "https://www.nexusforge.app/app";
  }
}

function resolveManifestUrl(downloadUrl) {
  try {
    const origin = new URL(downloadUrl).origin;
    return `${origin}/desktop-update.json`;
  } catch {
    return "https://www.nexusforge.app/desktop-update.json";
  }
}

async function resolveGuildAndChannel(rest, targetId, channelName) {
  let guildId = String(process.env.DISCORD_GUILD_ID || "").trim();
  let parentCategoryId = null;
  let channelId = null;

  if (targetId) {
    try {
      const guild = await rest.get(Routes.guild(targetId));
      if (guild?.id) {
        guildId = String(guild.id);
      }
    } catch {
      const targetChannel = await rest.get(Routes.channel(targetId));
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
    const channels = asArray(await rest.get(Routes.guildChannels(guildId)));
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
      const created = await rest.post(Routes.guildChannels(guildId), {
        body: {
          name: channelName,
          type: ChannelType.GuildText,
          topic: "Official NexusForge installer, launcher, and update manifest links.",
          parent_id: parentCategoryId,
        },
      });
      channelId = String(created.id);
    }
  }

  return { guildId, channelId };
}

async function main() {
  const token = String(process.env.DISCORD_BOT_TOKEN || "").trim();
  const targetId = String(process.argv[2] || process.env.DISCORD_REPORT_GUILD_ID || process.env.DISCORD_GUILD_ID || "").trim();
  const channelName = String(process.argv[3] || "app-downloads").trim();

  if (!token) {
    console.error("[discord:post:download] FAIL: DISCORD_BOT_TOKEN is missing");
    process.exitCode = 1;
    return;
  }

  const manifest = loadDesktopManifest();
  if (!manifest.version || !manifest.downloadUrl) {
    throw new Error("desktop-update.json is missing required version/downloadUrl fields");
  }

  const launcherUrl = resolveLauncherUrl(manifest.downloadUrl);
  const updateManifestUrl = resolveManifestUrl(manifest.downloadUrl);

  const rest = new REST({ version: "10" }).setToken(token);
  const { guildId, channelId } = await resolveGuildAndChannel(rest, targetId, channelName);

  const embed = {
    title: "NexusForge App Download + Updates",
    description:
      "Use this message for the latest installer, launcher, and update manifest. Always use these links to stay on the correct version.",
    color: 0x22d3ee,
    fields: [
      { name: "Version", value: manifest.version, inline: true },
      { name: "Force Update", value: manifest.forceUpdate ? "Yes" : "No", inline: true },
      { name: "SHA256", value: manifest.sha256 || "Not provided", inline: false },
      { name: "Installer", value: manifest.downloadUrl, inline: false },
      { name: "Launcher", value: launcherUrl, inline: false },
      { name: "Update Manifest", value: updateManifestUrl, inline: false },
    ],
    footer: { text: `Source: ${manifest.path}` },
    timestamp: new Date().toISOString(),
  };

  const components = [
    {
      type: 1,
      components: [
        { type: 2, style: ButtonStyle.Link, label: "Download Installer", url: manifest.downloadUrl },
        { type: 2, style: ButtonStyle.Link, label: "Open Launcher", url: launcherUrl },
        { type: 2, style: ButtonStyle.Link, label: "Update Manifest", url: updateManifestUrl },
      ],
    },
  ];

  const payload = {
    content: "Official NexusForge release links.",
    embeds: [embed],
    components,
    allowed_mentions: { parse: [] },
  };

  const me = await rest.get(Routes.user("@me"));
  const meId = String(me?.id || "");
  const messages = asArray(await rest.get(Routes.channelMessages(channelId, { limit: 100 })));
  const existing = messages.find((message) => {
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
  });

  let mode = "posted";
  if (existing?.id) {
    await rest.patch(Routes.channelMessage(channelId, String(existing.id)), {
      body: payload,
    });
    mode = "updated";
  } else {
    await rest.post(Routes.channelMessages(channelId), {
      body: payload,
    });
  }

  console.log(`[discord:post:download] OK: ${mode}; guild=${guildId} channel=${channelId} channelName=${channelName}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[discord:post:download] FAIL: ${message}`);
  process.exit(1);
});
