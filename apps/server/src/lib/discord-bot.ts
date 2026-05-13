import { Client, Events, GatewayIntentBits, PermissionFlagsBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import { env } from "../config/env.js";
import { getLaunchMode, setLaunchModeDesktopOnly } from "./launch-mode.js";

let discordClient: Client | null = null;
let readyUsername: string | null = null;
let readyUserId: string | null = null;
let connectedGuildId: string | null = null;
let lastStartupError: string | null = null;
let lastCommandRegistrationError: string | null = null;
let reportChannelsResolved = false;
let reportStatusChannelId: string | null = null;
let reportErrorsChannelId: string | null = null;
let reportAlertsChannelId: string | null = null;

type ReportKind = "status" | "errors" | "alerts";

function hasDiscordConfig() {
  return Boolean(env.DISCORD_BOT_TOKEN && env.DISCORD_CLIENT_ID);
}

function buildInstallUrl() {
  if (env.DISCORD_INSTALL_URL) {
    return env.DISCORD_INSTALL_URL;
  }

  if (!env.DISCORD_CLIENT_ID) {
    return null;
  }

  const base = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(env.DISCORD_CLIENT_ID)}&scope=bot%20applications.commands`;
  if (env.DISCORD_GUILD_ID) {
    return `${base}&guild_id=${encodeURIComponent(env.DISCORD_GUILD_ID)}&disable_guild_select=true`;
  }

  return base;
}

function createCommands() {
  const commands = [
    new SlashCommandBuilder().setName("ping").setDescription("Check bot latency and status."),
    new SlashCommandBuilder().setName("app").setDescription("Get NexusForge app links."),
    new SlashCommandBuilder().setName("status").setDescription("Show NexusForge API and launch mode status."),
    new SlashCommandBuilder()
      .setName("launchmode")
      .setDescription("View or set NexusForge launch mode.")
      .addBooleanOption((option) =>
        option
          .setName("desktop_only")
          .setDescription("Set true for desktop-only, false for web + desktop."),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  ];

  return commands.map((command) => command.toJSON());
}

function getReportGuildId() {
  return env.DISCORD_REPORT_GUILD_ID || env.DISCORD_GUILD_ID || null;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function getReportChannelId(kind: ReportKind) {
  if (kind === "status") {
    return reportStatusChannelId;
  }
  if (kind === "errors") {
    return reportErrorsChannelId;
  }
  return reportAlertsChannelId;
}

function setReportChannelId(kind: ReportKind, value: string | null) {
  if (kind === "status") {
    reportStatusChannelId = value;
    return;
  }
  if (kind === "errors") {
    reportErrorsChannelId = value;
    return;
  }
  reportAlertsChannelId = value;
}

async function resolveReportChannels(rest: REST) {
  if (!env.DISCORD_REPORT_ENABLED) {
    reportChannelsResolved = false;
    return;
  }

  const reportGuildId = getReportGuildId();
  if (!reportGuildId) {
    reportChannelsResolved = false;
    return;
  }

  const channels = await rest.get(Routes.guildChannels(reportGuildId));
  const list = Array.isArray(channels) ? channels : [];

  const statusName = normalizeName(env.DISCORD_REPORT_CHANNEL_STATUS);
  const errorsName = normalizeName(env.DISCORD_REPORT_CHANNEL_ERRORS);
  const alertsName = normalizeName(env.DISCORD_REPORT_CHANNEL_ALERTS);

  setReportChannelId(
    "status",
    String(list.find((channel) => normalizeName(String((channel as { name?: string }).name || "")) === statusName)?.id || "") || null,
  );
  setReportChannelId(
    "errors",
    String(list.find((channel) => normalizeName(String((channel as { name?: string }).name || "")) === errorsName)?.id || "") || null,
  );
  setReportChannelId(
    "alerts",
    String(list.find((channel) => normalizeName(String((channel as { name?: string }).name || "")) === alertsName)?.id || "") || null,
  );

  reportChannelsResolved = true;
}

async function postReport(kind: ReportKind, content: string) {
  if (!env.DISCORD_REPORT_ENABLED || !env.DISCORD_BOT_TOKEN) {
    return;
  }

  const channelId = getReportChannelId(kind);
  if (!channelId) {
    return;
  }

  const rest = new REST({ version: "10" }).setToken(env.DISCORD_BOT_TOKEN);
  await rest.post(Routes.channelMessages(channelId), {
    body: {
      content,
      allowed_mentions: { parse: [] },
    },
  });
}

function isSevereIssue(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("token") ||
    lower.includes("missing access") ||
    lower.includes("unknown guild") ||
    lower.includes("mismatch") ||
    lower.includes("forbidden") ||
    lower.includes("unauthorized") ||
    lower.includes("econn") ||
    lower.includes("timed out")
  );
}

function kindForIssue(message: string): ReportKind {
  return isSevereIssue(message) ? "alerts" : "errors";
}

async function postReportSafe(kind: ReportKind, content: string) {
  try {
    await postReport(kind, content);
  } catch (error) {
    console.warn("[discord] Failed to post report message:", error instanceof Error ? error.message : String(error));
  }
}

async function postIssue(context: string, message: string) {
  const kind = kindForIssue(message);
  await postReportSafe(kind, `[${context}] ${message}`);
}

export async function reportDiscordAlert(message: string) {
  await postReportSafe("alerts", `[alert] ${message}`);
}

export async function reportDiscordError(message: string) {
  await postReportSafe("errors", `[error] ${message}`);
}

export function getDiscordBotStatus() {
  const configuredClientId = env.DISCORD_CLIENT_ID ?? null;
  const clientIdMatchesToken =
    configuredClientId && readyUserId ? configuredClientId === readyUserId : null;
  const guildMatchesConfigured =
    env.DISCORD_GUILD_ID && connectedGuildId ? env.DISCORD_GUILD_ID === connectedGuildId : null;

  return {
    enabled: env.DISCORD_BOT_ENABLED,
    configured: hasDiscordConfig(),
    connected: Boolean(discordClient?.isReady()),
    username: readyUsername,
    userId: readyUserId,
    clientId: configuredClientId,
    clientIdMatchesToken,
    guildId: env.DISCORD_GUILD_ID ?? null,
    guildMatchesConfigured,
    reportGuildId: getReportGuildId(),
    reportChannelsResolved,
    installUrl: buildInstallUrl(),
    lastStartupError,
    lastCommandRegistrationError,
  };
}

async function verifyConfiguredGuildMembership() {
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_GUILD_ID) {
    connectedGuildId = null;
    return;
  }

  const rest = new REST({ version: "10" }).setToken(env.DISCORD_BOT_TOKEN);
  const guild = await rest.get(Routes.guild(env.DISCORD_GUILD_ID));
  const guildId = String((guild as { id?: string }).id || "");

  if (guildId !== env.DISCORD_GUILD_ID) {
    throw new Error(
      `Configured DISCORD_GUILD_ID (${env.DISCORD_GUILD_ID}) could not be verified from Discord response.`,
    );
  }

  connectedGuildId = guildId;
}

async function registerSlashCommands() {
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_CLIENT_ID) {
    return;
  }

  const rest = new REST({ version: "10" }).setToken(env.DISCORD_BOT_TOKEN);
  const payload = createCommands();

  if (env.DISCORD_GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), {
      body: payload,
    });
    console.log(`[discord] Registered ${payload.length} guild command(s) for guild ${env.DISCORD_GUILD_ID}.`);
    return;
  }

  await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
    body: payload,
  });
  console.log(`[discord] Registered ${payload.length} global command(s).`);
}

export async function startDiscordBot() {
  if (!env.DISCORD_BOT_ENABLED) {
    return;
  }

  if (!hasDiscordConfig()) {
    console.warn("[discord] Bot is enabled but DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID is missing.");
    lastStartupError = "Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID";
    return;
  }

  lastStartupError = null;
  lastCommandRegistrationError = null;
  reportChannelsResolved = false;
  reportStatusChannelId = null;
  reportErrorsChannelId = null;
  reportAlertsChannelId = null;

  discordClient = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  discordClient.once(Events.ClientReady, (readyClient) => {
    readyUsername = readyClient.user.tag;
    readyUserId = readyClient.user.id;
    const readyId = readyClient.user.id;
    if (env.DISCORD_CLIENT_ID && readyId !== env.DISCORD_CLIENT_ID) {
      const mismatchMessage = `Logged in bot user ID (${readyId}) does not match DISCORD_CLIENT_ID (${env.DISCORD_CLIENT_ID}).`;
      console.warn(`[discord] ${mismatchMessage}`);
      lastStartupError = mismatchMessage;
    }
    console.log(`[discord] Logged in as ${readyClient.user.tag}.`);
  });

  discordClient.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    try {
      if (interaction.commandName === "ping") {
        const wsPing = interaction.client.ws.ping;
        await interaction.reply({ content: `Pong. Gateway latency: ${wsPing}ms`, ephemeral: true });
        return;
      }

      if (interaction.commandName === "app") {
        const installUrl = buildInstallUrl();
        const appUrl = env.APP_WEB_URL;
        const lines = [
          `App: ${appUrl}`,
          installUrl ? `Install bot: ${installUrl}` : null,
        ].filter(Boolean);

        await interaction.reply({ content: lines.join("\n"), ephemeral: true });
        return;
      }

      if (interaction.commandName === "status") {
        const launchMode = await getLaunchMode();
        await interaction.reply({
          content: `NexusForge API is online. Launch mode: ${launchMode.desktopOnly ? "desktop-only" : "web + desktop"}.`,
          ephemeral: true,
        });
        return;
      }

      if (interaction.commandName === "launchmode") {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.reply({
            content: "You need Manage Server permission to use this command.",
            ephemeral: true,
          });
          return;
        }

        const desktopOnly = interaction.options.getBoolean("desktop_only");
        if (desktopOnly === null) {
          const current = await getLaunchMode();
          await interaction.reply({
            content: `Current launch mode: ${current.desktopOnly ? "desktop-only" : "web + desktop"}`,
            ephemeral: true,
          });
          return;
        }

        const actorId = interaction.user.id;
        const actorUsername = interaction.user.username;
        const updated = await setLaunchModeDesktopOnly(desktopOnly, {
          id: actorId,
          username: actorUsername,
        });

        await interaction.reply({
          content: `Launch mode updated: ${updated.desktopOnly ? "desktop-only" : "web + desktop"}`,
          ephemeral: true,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[discord] Interaction handler failed:", message);
      await postIssue("interaction-error", message);
      if (interaction.isRepliable()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: "Command failed. Check server logs.", ephemeral: true });
        } else {
          await interaction.reply({ content: "Command failed. Check server logs.", ephemeral: true });
        }
      }
    }
  });

  try {
    await discordClient.login(env.DISCORD_BOT_TOKEN);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lastStartupError = message;
    await postIssue("startup-error", message);
    throw error;
  }

  const loggedInUserId = discordClient.user?.id;
  if (
    env.DISCORD_ENFORCE_CLIENT_ID_MATCH &&
    env.DISCORD_CLIENT_ID &&
    loggedInUserId &&
    loggedInUserId !== env.DISCORD_CLIENT_ID
  ) {
    const mismatchMessage = `Bot token client mismatch: logged in as ${loggedInUserId}, expected ${env.DISCORD_CLIENT_ID}.`;
    lastStartupError = mismatchMessage;
    await postIssue("startup-blocked", mismatchMessage);
    await stopDiscordBot();
    throw new Error(mismatchMessage);
  }

  try {
    await verifyConfiguredGuildMembership();
  } catch (error) {
    const message =
      `Bot is not connected to configured DISCORD_GUILD_ID (${env.DISCORD_GUILD_ID}): ${error instanceof Error ? error.message : String(error)}`;
    lastStartupError = message;
    await postIssue("startup-blocked", message);
    await stopDiscordBot();
    throw new Error(message);
  }

  if (env.DISCORD_REPORT_ENABLED) {
    try {
      const reportToken = env.DISCORD_BOT_TOKEN;
      if (reportToken) {
        const rest = new REST({ version: "10" }).setToken(reportToken);
        await resolveReportChannels(rest);
      }
    } catch (error) {
      console.warn("[discord] Failed to resolve report channels:", error instanceof Error ? error.message : String(error));
    }
  }

  if (env.DISCORD_REGISTER_COMMANDS_ON_START) {
    try {
      await registerSlashCommands();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastCommandRegistrationError = message;
      console.error("[discord] Command registration failed:", message);
      await postIssue("command-registration-error", message);
    }
  } else {
    console.log("[discord] Skipping command registration on startup (DISCORD_REGISTER_COMMANDS_ON_START=false).");
  }

  await postReportSafe(
    "status",
    `[online] ${readyUsername || "discord-bot"} is online. Commands: ${env.DISCORD_REGISTER_COMMANDS_ON_START ? "registered" : "skipped"}.`,
  );
}

export async function stopDiscordBot() {
  if (!discordClient) {
    return;
  }

  await postReportSafe("status", `[offline] ${readyUsername || "discord-bot"} is shutting down.`);

  await discordClient.destroy();
  discordClient = null;
  readyUsername = null;
  readyUserId = null;
  connectedGuildId = null;
  lastStartupError = null;
  lastCommandRegistrationError = null;
  reportChannelsResolved = false;
  reportStatusChannelId = null;
  reportErrorsChannelId = null;
  reportAlertsChannelId = null;
}
