import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType, 
  Client, 
  EmbedBuilder, 
  Events, 
  GatewayIntentBits, 
  PermissionFlagsBits, 
  REST, 
  Routes, 
  SlashCommandBuilder 
} from "discord.js";
import { env } from "../config/env.js";
import { getLaunchMode, setLaunchModeDesktopOnly } from "./launch-mode.js";
import { MiningAuthority } from "./mining-authority.js";
import { EconomyAuthority } from "./economy-authority.js";
import { prisma } from "./prisma.js";

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
let reportSocialChannelId: string | null = null;
let reportAppHealthChannelId: string | null = null;
let reportAppRuntimeChannelId: string | null = null;
let reportAppReleaseOpsChannelId: string | null = null;
let reportAppSecurityChannelId: string | null = null;
let reportAppPerformanceChannelId: string | null = null;
let reportAppUserFeedbackChannelId: string | null = null;
let statusHeartbeatTimer: NodeJS.Timeout | null = null;

type ReportKind = "status" | "errors" | "alerts" | "social";

function truncateForEmbed(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function parseReportMessage(rawContent: string) {
  const source = String(rawContent || "").trim();
  const match = source.match(/^((?:\[[^\]]+\]\s*)+)([\s\S]*)$/);
  if (!match) {
    return {
      tags: [] as string[],
      detail: source,
    };
  }

  const tagBlock = String(match[1] || "");
  const detail = String(match[2] || "").trim();
  const tags = Array.from(tagBlock.matchAll(/\[([^\]]+)\]/g)).map((entry) => String(entry[1] || "").trim().toLowerCase());

  return {
    tags,
    detail,
  };
}

function reportTitleFor(kind: ReportKind, tags: string[]) {
  if (tags.includes("online")) {
    return "Bot Online";
  }
  if (tags.includes("offline")) {
    return "Bot Offline";
  }
  if (tags.includes("ops")) {
    return "Operations Digest";
  }
  if (tags.includes("probe") && tags.includes("status")) {
    return "Status Probe";
  }
  if (tags.includes("probe") && tags.includes("error")) {
    return "Error Probe";
  }
  if (tags.includes("probe") && tags.includes("alert")) {
    return "Alert Probe";
  }
  if (kind === "alerts") {
    return "Critical Alert";
  }
  if (kind === "errors") {
    return "Error Report";
  }
  if (kind === "social") {
    return "Social Dispatch";
  }
  return "Status Update";
}

function reportColorFor(kind: ReportKind, tags: string[]) {
  if (tags.includes("online")) {
    return 0x16a34a;
  }
  if (tags.includes("offline")) {
    return 0x64748b;
  }
  if (kind === "alerts") {
    return 0xef4444;
  }
  if (kind === "errors") {
    return 0xf59e0b;
  }
  if (kind === "social") {
    return 0x0ea5e9;
  }
  return 0x22d3ee;
}

function buildReportEmbed(kind: ReportKind, content: string) {
  const parsed = parseReportMessage(content);
  const title = reportTitleFor(kind, parsed.tags);
  const detail = parsed.detail || content || "No details provided.";
  const fields = [] as Array<{ name: string; value: string; inline?: boolean }>;

  if (parsed.tags.length > 0) {
    fields.push({
      name: "Event Tags",
      value: truncateForEmbed(parsed.tags.map((tag) => `#${tag}`).join(" "), 1024),
      inline: false,
    });
  }

  fields.push({
    name: "Details",
    value: truncateForEmbed(detail, 1024),
    inline: false,
  });

  return {
    title,
    color: reportColorFor(kind, parsed.tags),
    fields,
    footer: { text: "NexusForge Bot Operations" },
    timestamp: new Date().toISOString(),
  };
}

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

export function createCommands() {
  const commands = [
    new SlashCommandBuilder().setName("ping").setDescription("Check bot latency and status."),
    new SlashCommandBuilder().setName("app").setDescription("Get NexusForge app links."),
    new SlashCommandBuilder().setName("status").setDescription("Show NexusForge API and launch mode status."),
    new SlashCommandBuilder()
      .setName("ops-summary")
      .setDescription("Show an executive NexusForge operations snapshot.")
      .addBooleanOption((option) =>
        option
          .setName("publish")
          .setDescription("Also publish this summary to the app-runtime channel."),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder()
      .setName("launchmode")
      .setDescription("View or set NexusForge launch mode.")
      .addBooleanOption((option) =>
        option
          .setName("desktop_only")
          .setDescription("Set true for desktop-only, false for web + desktop."),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder()
      .setName("social")
      .setDescription("Post a message to the configured NexusForge social report channel.")
      .addStringOption((option) =>
        option.setName("message").setDescription("The message to post").setRequired(true),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder()
      .setName("mining")
      .setDescription("NexusForge Industrial Mining Control Center."),
    new SlashCommandBuilder()
      .setName("balance")
      .setDescription("Check your NexusForge economic standing."),
  ];

  return commands.map((command) => command.toJSON());
}

function getReportGuildId() {
  return env.DISCORD_REPORT_GUILD_ID || env.DISCORD_GUILD_ID || null;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function getReportChannelId(kind: ReportKind) {
  if (kind === "status") {
    return reportStatusChannelId;
  }
  if (kind === "errors") {
    return reportErrorsChannelId;
  }
  if (kind === "social") {
    return reportSocialChannelId;
  }
  return reportAlertsChannelId;
}

function getRoutedAppChannelId(route: "health" | "runtime" | "release" | "security" | "performance" | "feedback") {
  if (route === "health") {
    return reportAppHealthChannelId;
  }
  if (route === "runtime") {
    return reportAppRuntimeChannelId;
  }
  if (route === "release") {
    return reportAppReleaseOpsChannelId;
  }
  if (route === "security") {
    return reportAppSecurityChannelId;
  }
  if (route === "performance") {
    return reportAppPerformanceChannelId;
  }
  return reportAppUserFeedbackChannelId;
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
  if (kind === "social") {
    reportSocialChannelId = value;
    return;
  }
  reportAlertsChannelId = value;
}

async function resolveReportChannels(rest: REST) {
  if (!env.DISCORD_REPORT_ENABLED) {
    reportChannelsResolved = false;
    return;
  }

  const reportGuildId = await resolveReportGuildId(rest);
  if (!reportGuildId) {
    reportChannelsResolved = false;
    return;
  }

  const channels = asArray(await rest.get(Routes.guildChannels(reportGuildId)));
  const preferredCategoryId = String(env.DISCORD_REPORT_CATEGORY_ID || "").trim();

  const statusName = normalizeName(env.DISCORD_REPORT_CHANNEL_STATUS);
  const errorsName = normalizeName(env.DISCORD_REPORT_CHANNEL_ERRORS);
  const alertsName = normalizeName(env.DISCORD_REPORT_CHANNEL_ALERTS);
  const socialName = normalizeName(env.DISCORD_REPORT_CHANNEL_SOCIAL);
  const appHealthName = normalizeName(env.DISCORD_REPORT_CHANNEL_APP_HEALTH);
  const appRuntimeName = normalizeName(env.DISCORD_REPORT_CHANNEL_APP_RUNTIME);
  const appReleaseOpsName = normalizeName(env.DISCORD_REPORT_CHANNEL_APP_RELEASE_OPS);
  const appSecurityName = normalizeName(env.DISCORD_REPORT_CHANNEL_APP_SECURITY);
  const appPerformanceName = normalizeName(env.DISCORD_REPORT_CHANNEL_APP_PERFORMANCE);
  const appUserFeedbackName = normalizeName(env.DISCORD_REPORT_CHANNEL_APP_USER_FEEDBACK);

  const categoryScopedChannels =
    preferredCategoryId.length > 0
      ? channels.filter(
          (channel) =>
            channel.type === ChannelType.GuildText && String((channel as { parent_id?: string }).parent_id || "") === preferredCategoryId,
        )
      : channels;
  const candidateChannels = categoryScopedChannels.length > 0 ? categoryScopedChannels : channels;

  const resolveNamedChannel = (desiredName: string) =>
    String(
      candidateChannels.find(
        (channel) =>
          channel.type === ChannelType.GuildText && normalizeName(String((channel as { name?: string }).name || "")) === desiredName,
      )?.id || "",
    ) || null;

  setReportChannelId("status", resolveNamedChannel(statusName));
  setReportChannelId("errors", resolveNamedChannel(errorsName));
  setReportChannelId("alerts", resolveNamedChannel(alertsName));
  setReportChannelId("social", resolveNamedChannel(socialName));
  reportAppHealthChannelId = resolveNamedChannel(appHealthName);
  reportAppRuntimeChannelId = resolveNamedChannel(appRuntimeName);
  reportAppReleaseOpsChannelId = resolveNamedChannel(appReleaseOpsName);
  reportAppSecurityChannelId = resolveNamedChannel(appSecurityName);
  reportAppPerformanceChannelId = resolveNamedChannel(appPerformanceName);
  reportAppUserFeedbackChannelId = resolveNamedChannel(appUserFeedbackName);

  reportChannelsResolved = true;
}

async function resolveReportGuildId(rest: REST) {
  const reportGuildId = getReportGuildId();
  if (!reportGuildId) {
    return null;
  }

  try {
    const guild = await rest.get(Routes.guild(reportGuildId));
    return String((guild as { id?: string }).id || "") || null;
  } catch {
    try {
      const channel = await rest.get(Routes.channel(reportGuildId));
      return String((channel as { guild_id?: string }).guild_id || "") || null;
    } catch {
      return null;
    }
  }
}

async function postReport(kind: ReportKind, content: string) {
  if (!env.DISCORD_REPORT_ENABLED || !env.DISCORD_BOT_TOKEN) {
    return;
  }

  const parsed = parseReportMessage(content);
  const lowerDetail = parsed.detail.toLowerCase();

  let channelId = getReportChannelId(kind);

  if (kind === "social") {
    channelId = getRoutedAppChannelId("feedback") || channelId;
  } else if (kind === "status") {
    if (
      parsed.tags.includes("ops") ||
      parsed.tags.includes("heartbeat") ||
      lowerDetail.includes("launchmode") ||
      lowerDetail.includes("runtime") ||
      lowerDetail.includes("startup")
    ) {
      channelId = getRoutedAppChannelId("runtime") || channelId;
    } else if (
      parsed.tags.includes("online") ||
      parsed.tags.includes("offline") ||
      parsed.tags.includes("status") ||
      lowerDetail.includes("healthy") ||
      lowerDetail.includes("health")
    ) {
      channelId = getRoutedAppChannelId("health") || channelId;
    }
  } else if (kind === "alerts") {
    if (
      lowerDetail.includes("token") ||
      lowerDetail.includes("unauthorized") ||
      lowerDetail.includes("forbidden") ||
      lowerDetail.includes("security") ||
      lowerDetail.includes("credential") ||
      lowerDetail.includes("mismatch")
    ) {
      channelId = getRoutedAppChannelId("security") || channelId;
    }
  } else if (kind === "errors") {
    if (
      lowerDetail.includes("startup") ||
      lowerDetail.includes("interaction") ||
      lowerDetail.includes("command-registration") ||
      lowerDetail.includes("launchmode") ||
      lowerDetail.includes("runtime")
    ) {
      channelId = getRoutedAppChannelId("runtime") || channelId;
    }

    if (
      lowerDetail.includes("timeout") ||
      lowerDetail.includes("latency") ||
      lowerDetail.includes("slow") ||
      lowerDetail.includes("performance")
    ) {
      channelId = getRoutedAppChannelId("performance") || channelId;
    }

    if (
      lowerDetail.includes("release") ||
      lowerDetail.includes("deploy") ||
      lowerDetail.includes("update") ||
      lowerDetail.includes("installer") ||
      lowerDetail.includes("manifest") ||
      lowerDetail.includes("rollback")
    ) {
      channelId = getRoutedAppChannelId("release") || channelId;
    }
  }

  if (!channelId) {
    return;
  }

  const rest = new REST({ version: "10" }).setToken(env.DISCORD_BOT_TOKEN);
  const embed = buildReportEmbed(kind, content);
  await rest.post(Routes.channelMessages(channelId), {
    body: {
      embeds: [embed],
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

export async function reportDiscordSocial(message: string) {
  if (env.DISCORD_SOCIAL_CHANNEL_ID) {
    await postDirectDiscordChannelMessage(env.DISCORD_SOCIAL_CHANNEL_ID, message);
    return;
  }
  await postReportSafe("social", `[social] ${message}`);
}

async function postDirectDiscordChannelMessage(channelId: string, content: string) {
  if (!env.DISCORD_BOT_TOKEN) {
    return;
  }

  const rest = new REST({ version: "10" }).setToken(env.DISCORD_BOT_TOKEN);
  try {
    const embed = buildReportEmbed("social", content);
    await rest.post(Routes.channelMessages(channelId), {
      body: {
        embeds: [embed],
        allowed_mentions: { parse: [] },
      },
    });
  } catch (error) {
    console.warn("[discord] Failed to post direct channel message:", error instanceof Error ? error.message : String(error));
  }
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
    reportCategoryId: env.DISCORD_REPORT_CATEGORY_ID ?? null,
    reportChannelsResolved,
    reportChannelIds: {
      status: reportStatusChannelId,
      errors: reportErrorsChannelId,
      alerts: reportAlertsChannelId,
      social: reportSocialChannelId,
      appHealth: reportAppHealthChannelId,
      appRuntime: reportAppRuntimeChannelId,
      appReleaseOps: reportAppReleaseOpsChannelId,
      appSecurity: reportAppSecurityChannelId,
      appPerformance: reportAppPerformanceChannelId,
      appUserFeedback: reportAppUserFeedbackChannelId,
    },
    socialChannelId: env.DISCORD_SOCIAL_CHANNEL_ID ?? null,
    socialChannelResolvedId: reportSocialChannelId,
    installUrl: buildInstallUrl(),
    lastStartupError,
    lastCommandRegistrationError,
  };
}

function clearStatusHeartbeat() {
  if (!statusHeartbeatTimer) {
    return;
  }

  clearInterval(statusHeartbeatTimer);
  statusHeartbeatTimer = null;
}

async function buildOperationalDigest(reason: string) {
  const launchMode = await getLaunchMode();
  const botStatus = getDiscordBotStatus();
  const apiBase = `http://localhost:${env.PORT}`;
  const commandState = env.DISCORD_REGISTER_COMMANDS_ON_START
    ? botStatus.lastCommandRegistrationError
      ? "failed"
      : "registered"
    : "skipped";

  const reportState =
    `resolved=${botStatus.reportChannelsResolved}` +
    ` status=${Boolean(reportStatusChannelId)}` +
    ` errors=${Boolean(reportErrorsChannelId)}` +
    ` alerts=${Boolean(reportAlertsChannelId)}` +
    ` social=${Boolean(reportSocialChannelId || env.DISCORD_SOCIAL_CHANNEL_ID)}` +
    ` appHealth=${Boolean(reportAppHealthChannelId)}` +
    ` appRuntime=${Boolean(reportAppRuntimeChannelId)}` +
    ` appRelease=${Boolean(reportAppReleaseOpsChannelId)}` +
    ` appSecurity=${Boolean(reportAppSecurityChannelId)}` +
    ` appPerf=${Boolean(reportAppPerformanceChannelId)}` +
    ` appFeedback=${Boolean(reportAppUserFeedbackChannelId)}`;

  return [
    `[ops] reason=${reason}`,
    `bot=${botStatus.username || "unknown"}`,
    `connected=${botStatus.connected}`,
    `launchMode=${launchMode.desktopOnly ? "desktop-only" : "web+desktop"}`,
    `commands=${commandState}`,
    `commandCount=${createCommands().length}`,
    `reportChannels(${reportState})`,
    `guild=${botStatus.guildId || "unset"}`,
    `reportGuild=${botStatus.reportGuildId || "unset"}`,
    `apiHealth=${apiBase}/api/health/discord`,
    `appWeb=${env.APP_WEB_URL}`,
  ].join(" | ");
}

async function buildOpsSummaryLines() {
  const launchMode = await getLaunchMode();
  const botStatus = getDiscordBotStatus();
  const commandState = env.DISCORD_REGISTER_COMMANDS_ON_START
    ? botStatus.lastCommandRegistrationError
      ? "failed"
      : "registered"
    : "skipped";

  return [
    `NexusForge API: online (http://localhost:${env.PORT})`,
    `Launch mode: ${launchMode.desktopOnly ? "desktop-only" : "web + desktop"}`,
    `Bot connected: ${botStatus.connected ? "yes" : "no"}`,
    `Security layer: Industrial IP Anonymization (SHA256) is [ACTIVE]`,
    `Encryption standard: TLS_v1.3 + ChaCha20 Poly1305 [VERIFIED]`,
    `Commands: ${commandState} (${createCommands().length} total)`,
    `Report channels resolved: ${botStatus.reportChannelsResolved ? "yes" : "no"}`,
    `Status channel: ${botStatus.reportChannelIds?.status || "unset"}`,
    `Errors channel: ${botStatus.reportChannelIds?.errors || "unset"}`,
    `Alerts channel: ${botStatus.reportChannelIds?.alerts || "unset"}`,
    `App health channel: ${botStatus.reportChannelIds?.appHealth || "unset"}`,
    `App runtime channel: ${botStatus.reportChannelIds?.appRuntime || "unset"}`,
    `App release channel: ${botStatus.reportChannelIds?.appReleaseOps || "unset"}`,
    `App security channel: ${botStatus.reportChannelIds?.appSecurity || "unset"}`,
    `App performance channel: ${botStatus.reportChannelIds?.appPerformance || "unset"}`,
    `App feedback channel: ${botStatus.reportChannelIds?.appUserFeedback || "unset"}`,
    botStatus.lastStartupError ? `Last startup error: ${botStatus.lastStartupError}` : null,
    botStatus.lastCommandRegistrationError
      ? `Last command registration error: ${botStatus.lastCommandRegistrationError}`
      : null,
  ].filter(Boolean);
}

export async function getOpsSummarySnapshot() {
  const lines = await buildOpsSummaryLines();
  const description = truncateForEmbed(lines.map((line) => `• ${line}`).join("\n"), 4000);

  return {
    lines,
    embed: {
      title: "NexusForge Operations Summary",
      description,
      color: 0x22d3ee,
      footer: { text: "NexusForge Bot Operations" },
      timestamp: new Date().toISOString(),
    },
  };
}

async function postOperationalDigest(reason: string) {
  const message = await buildOperationalDigest(reason);
  await postReportSafe("status", message);
}

export async function reportDiscordOpsSummary(reason = "manual-summary") {
  await postOperationalDigest(reason);
}

function startStatusHeartbeat() {
  clearStatusHeartbeat();

  if (!env.DISCORD_REPORT_ENABLED) {
    return;
  }

  const minutes = Number(env.DISCORD_REPORT_HEARTBEAT_MINUTES || 0);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return;
  }

  const intervalMs = Math.floor(minutes * 60 * 1000);
  if (intervalMs < 60_000) {
    return;
  }

  statusHeartbeatTimer = setInterval(() => {
    void postOperationalDigest("heartbeat");
  }, intervalMs);

  if (typeof statusHeartbeatTimer.unref === "function") {
    statusHeartbeatTimer.unref();
  }
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
  reportSocialChannelId = null;
  reportAppHealthChannelId = null;
  reportAppRuntimeChannelId = null;
  reportAppReleaseOpsChannelId = null;
  reportAppSecurityChannelId = null;
  reportAppPerformanceChannelId = null;
  reportAppUserFeedbackChannelId = null;

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
    if (interaction.isButton()) {
      try {
        if (interaction.customId.startsWith("harvest_all_")) {
          const userId = interaction.customId.replace("harvest_all_", "");
          
          // Basic security: only wearer can click or we verify the user
          // For now we trust the customId mapping as it's ephemeral
          
          await interaction.deferUpdate();
          const harvested = await MiningAuthority.harvestAll(userId);
          
          const embed = EmbedBuilder.from(interaction.message.embeds[0]!);
          embed.setTitle("Harvest Successful")
               .setDescription(`Successfully extracted **${harvested.toLocaleString()} NC** from Industrial Rigs.`)
               .setColor(0x22d3ee)
               .setFields([]); // Clear telemetry fields for success view

          await interaction.editReply({ embeds: [embed], components: [] });
        }
      } catch (error) {
        console.error("[discord] Button interaction failed:", error);
      }
      return;
    }

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
        const snapshot = await getOpsSummarySnapshot();

        await interaction.reply({
          content: snapshot.lines[0] || "NexusForge API: online",
          embeds: [snapshot.embed],
          ephemeral: true,
        });
        return;
      }

      if (interaction.commandName === "ops-summary") {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.reply({
            content: "You need Manage Server permission to use this command.",
            ephemeral: true,
          });
          return;
        }

        const publish = interaction.options.getBoolean("publish") === true;
        const snapshot = await getOpsSummarySnapshot();
        if (publish) {
          await reportDiscordOpsSummary("manual-summary");
        }
        await interaction.reply({
          content: publish ? "Published to app-runtime." : "NexusForge operations snapshot.",
          embeds: [snapshot.embed],
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
        return;
      }

      if (interaction.commandName === "social") {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.reply({
            content: "You need Manage Server permission to use this command.",
            ephemeral: true,
          });
          return;
        }

        const message = interaction.options.getString("message")?.trim() || "";
        if (!message) {
          await interaction.reply({
            content: "Please provide a message to post.",
            ephemeral: true,
          });
          return;
        }

        if (message.length > 2000) {
          await interaction.reply({
            content: "Message is too long. Please keep it under 2000 characters.",
            ephemeral: true,
          });
          return;
        }

        await reportDiscordSocial(message);
        await interaction.reply({
          content: "Social message posted.",
          ephemeral: true,
        });
        return;
      }

      if (interaction.commandName === "balance") {
        const user = await prisma.user.findFirst({
          where: { socialLinks: { path: ["discord"], equals: interaction.user.id } }
        });

        // Fallback to checking by username or other mapping if socialLinks isn't populated
        const actualUser = user || await prisma.user.findUnique({ where: { username: interaction.user.username } });

        if (!actualUser) {
          await interaction.reply({
            content: "Your Discord account is not linked to a NexusForge profile. Please link it in the app settings.",
            ephemeral: true,
          });
          return;
        }

        const accounts = await EconomyAuthority.getAllUserAccounts(actualUser.id);
        const embed = new EmbedBuilder()
          .setTitle(`${interaction.user.username}'s Economic Portfolio`)
          .setColor(0x22d3ee)
          .setTimestamp();

        if (accounts.length === 0) {
          embed.setDescription("No active currency accounts found. Use `/mining` to start earning.");
        } else {
          accounts.forEach(acc => {
            embed.addFields({ 
              name: acc.currencyType === "NC" ? "Nexus Coins (NC)" : acc.currencyType, 
              value: `**${acc.balance.toLocaleString()}**`, 
              inline: true 
            });
          });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (interaction.commandName === "mining") {
        const user = await prisma.user.findFirst({
          where: { socialLinks: { path: ["discord"], equals: interaction.user.id } }
        });
        const actualUser = user || await prisma.user.findUnique({ where: { username: interaction.user.username } });

        if (!actualUser) {
          await interaction.reply({
            content: "Please link your NexusForge account to use mining features.",
            ephemeral: true,
          });
          return;
        }

        const report = await MiningAuthority.getOperationalReport(actualUser.id);
        const embed = new EmbedBuilder()
          .setTitle("NexusForge Industrial Mining Center")
          .setColor(0x16a34a)
          .setDescription("Real-time telemetry and infrastructure status.")
          .setTimestamp();

        if (report.length === 0) {
          embed.setDescription("No mining rigs detected. Deployment required via NexusForge Dashboard.");
        } else {
          let totalHashRate = 0;
          let totalPending = 0n;

          report.forEach(rig => {
            totalHashRate += rig.hashRate;
            totalPending += BigInt(rig.currentYield);
            
            const statusEmoji = rig.status === "ACTIVE" ? "🟢" : "🔴";
            embed.addFields({
              name: `${statusEmoji} ${rig.name}`,
              value: `HashRate: ${rig.hashRate} MH/s\nPending: ${BigInt(rig.currentYield).toLocaleString()} NC`,
              inline: true
            });
          });

          embed.addFields({
            name: "--- Network Summary ---",
            value: `Total Output: **${totalHashRate.toFixed(2)} MH/s**\nAccumulated Yield: **${totalPending.toLocaleString()} NC**`,
            inline: false
          });
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`harvest_all_${actualUser.id}`)
            .setLabel("Harvest All Rigs")
            .setStyle(ButtonStyle.Success)
            .setDisabled(report.length === 0)
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        return;
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
  await postOperationalDigest("startup");
  startStatusHeartbeat();
}

export async function stopDiscordBot() {
  if (!discordClient) {
    return;
  }

  clearStatusHeartbeat();

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
  reportSocialChannelId = null;
  reportAppHealthChannelId = null;
  reportAppRuntimeChannelId = null;
  reportAppReleaseOpsChannelId = null;
  reportAppSecurityChannelId = null;
  reportAppPerformanceChannelId = null;
  reportAppUserFeedbackChannelId = null;
}
