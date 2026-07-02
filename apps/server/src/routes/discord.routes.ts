import type { Request, Response } from "express";
import { createPublicKey, verify as verifySignature } from "node:crypto";
import { InteractionResponseType, InteractionType, MessageFlags, PermissionFlagsBits } from "discord.js";
import { env } from "../config/env.js";
import { getLaunchMode, setLaunchModeDesktopOnly } from "../lib/launch-mode.js";
import { getDiscordBotStatus, getOpsSummarySnapshot, reportDiscordOpsSummary, reportDiscordSocial } from "../lib/discord-bot.js";

let reportDiscordSocialImpl = reportDiscordSocial;
export function setDiscordSocialReporter(fn: typeof reportDiscordSocial) {
  reportDiscordSocialImpl = fn;
}

let reportDiscordOpsSummaryImpl = reportDiscordOpsSummary;
export function setDiscordOpsSummaryReporter(fn: typeof reportDiscordOpsSummary) {
  reportDiscordOpsSummaryImpl = fn;
}

export async function processDiscordCommand(interaction: DiscordInteraction) {
  const commandName = interaction.data?.name;

  if (commandName === "ping") {
    return reply("Pong from NexusForge interactions webhook.");
  }

  if (commandName === "app") {
    const installUrl = env.DISCORD_INSTALL_URL || "Install URL is not configured";
    return reply(`App: ${env.APP_WEB_URL}\nInstall bot: ${installUrl}`);
  }

  if (commandName === "status") {
    const snapshot = await getOpsSummarySnapshot();
    return reply({
      content: snapshot.lines[0] || "NexusForge API: online",
      embeds: [snapshot.embed],
    });
  }

  if (commandName === "ops-summary") {
    if (!hasManageGuildPermission(interaction)) {
      return reply("You need Manage Server permission to use this command.");
    }

    const publish = getBooleanOption(interaction, "publish") === true;
    const snapshot = await getOpsSummarySnapshot();
    if (publish) {
      await reportDiscordOpsSummaryImpl("webhook-manual-summary");
    }
    return reply({
      content: [snapshot.lines[0], publish ? "Published to app-runtime." : null].filter(Boolean).join("\n"),
      embeds: [snapshot.embed],
    });
  }

  if (commandName === "launchmode") {
    if (!hasManageGuildPermission(interaction)) {
      return reply("You need Manage Server permission to use this command.");
    }

    const desktopOnly = getBooleanOption(interaction, "desktop_only");
    if (desktopOnly === null) {
      const current = await getLaunchMode();
      return reply(`Current launch mode: ${current.desktopOnly ? "desktop-only" : "web + desktop"}`);
    }

    const actorId = interaction.user?.id || "discord-webhook";
    const actorUsername = interaction.user?.username || "discord-webhook";
    const updated = await setLaunchModeDesktopOnly(desktopOnly, {
      id: actorId,
      username: actorUsername,
    });

    return reply(`Launch mode updated: ${updated.desktopOnly ? "desktop-only" : "web + desktop"}`);
  }

  if (commandName === "social") {
    if (!hasManageGuildPermission(interaction)) {
      return reply("You need Manage Server permission to use this command.");
    }

    const input = interaction.data?.options?.find((item) => item.name === "message")?.value;
    const message = typeof input === "string" ? input.trim() : "";
    if (!message) {
      return reply("Please provide a message to post.");
    }

    if (message.length > 2000) {
      return reply("Message is too long. Please keep it under 2000 characters.");
    }

    await reportDiscordSocialImpl(message);
    return reply("Social message posted.");
  }

  return reply(`Unknown command: ${commandName || "(empty)"}`);
}

type DiscordInteraction = {
  type: number;
  data?: {
    name?: string;
    options?: Array<{ name: string; value: unknown }>;
  };
  member?: {
    permissions?: string;
  };
  user?: {
    id?: string;
    username?: string;
  };
};

function getBooleanOption(interaction: DiscordInteraction, optionName: string) {
  const option = interaction.data?.options?.find((item) => item.name === optionName);
  return typeof option?.value === "boolean" ? option.value : null;
}

function hasManageGuildPermission(interaction: DiscordInteraction) {
  const rawPermissions = interaction.member?.permissions;
  if (!rawPermissions) {
    return false;
  }

  try {
    const value = BigInt(rawPermissions);
    return (value & PermissionFlagsBits.ManageGuild) === PermissionFlagsBits.ManageGuild;
  } catch {
    return false;
  }
}

function reply(contentOrPayload: string | { content: string; embeds?: Array<Record<string, unknown>> }) {
  const payload =
    typeof contentOrPayload === "string"
      ? { content: contentOrPayload }
      : contentOrPayload;

  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: payload.content,
      ...(payload.embeds?.length ? { embeds: payload.embeds } : {}),
      flags: MessageFlags.Ephemeral,
    },
  };
}

function toPemEd25519PublicKey(publicKeyHex: string) {
  const keyBytes = Buffer.from(publicKeyHex, "hex");
  if (keyBytes.length !== 32) {
    throw new Error("DISCORD_PUBLIC_KEY must be 32 bytes (64 hex chars)");
  }

  // ASN.1 SubjectPublicKeyInfo prefix for Ed25519 public keys.
  const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
  const der = Buffer.concat([spkiPrefix, keyBytes]);
  const base64 = der.toString("base64");
  const wrapped = base64.match(/.{1,64}/g)?.join("\n") ?? base64;
  return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----`;
}

function verifyDiscordRequest(rawBody: Buffer, signatureHex: string, timestamp: string, publicKeyHex: string) {
  const message = Buffer.concat([Buffer.from(timestamp, "utf8"), rawBody]);
  const signature = Buffer.from(signatureHex, "hex");
  const publicKey = createPublicKey(toPemEd25519PublicKey(publicKeyHex));
  return verifySignature(null, message, publicKey, signature);
}

export async function discordInteractionHandler(req: Request, res: Response) {
  if (!env.DISCORD_PUBLIC_KEY) {
    res.status(503).json({ error: "Discord public key is not configured" });
    return;
  }

  const signature = req.header("X-Signature-Ed25519") ?? "";
  const timestamp = req.header("X-Signature-Timestamp") ?? "";

  if (!Buffer.isBuffer(req.body)) {
    res.status(400).json({ error: "Expected raw request body" });
    return;
  }

  let isValid = false;
  try {
    isValid = verifyDiscordRequest(req.body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
  } catch {
    isValid = false;
  }
  if (!isValid) {
    res.status(401).json({ error: "Invalid request signature" });
    return;
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(req.body.toString("utf8")) as DiscordInteraction;
  } catch {
    res.status(400).json({ error: "Invalid interaction payload" });
    return;
  }

  if (interaction.type === InteractionType.Ping) {
    res.status(200).json({ type: InteractionResponseType.Pong });
    return;
  }

  if (interaction.type !== InteractionType.ApplicationCommand) {
    res.status(200).json(reply("Unsupported interaction type."));
    return;
  }

  try {
    res.status(200).json(await processDiscordCommand(interaction));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[discord] Webhook interaction handler failed:", message);
    res.status(200).json(reply("Command failed. Check server logs."));
  }
}
