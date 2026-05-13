import type { Request, Response } from "express";
import { createPublicKey, verify as verifySignature } from "node:crypto";
import { InteractionResponseType, InteractionType, MessageFlags, PermissionFlagsBits } from "discord.js";
import { env } from "../config/env.js";
import { getLaunchMode, setLaunchModeDesktopOnly } from "../lib/launch-mode.js";

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

function reply(content: string) {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content,
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

  const commandName = interaction.data?.name;

  try {
    if (commandName === "ping") {
      res.status(200).json(reply("Pong from NexusForge interactions webhook."));
      return;
    }

    if (commandName === "app") {
      const installUrl = env.DISCORD_INSTALL_URL || "Install URL is not configured";
      res.status(200).json(reply(`App: ${env.APP_WEB_URL}\nInstall bot: ${installUrl}`));
      return;
    }

    if (commandName === "status") {
      const launchMode = await getLaunchMode();
      res.status(200).json(reply(`Launch mode: ${launchMode.desktopOnly ? "desktop-only" : "web + desktop"}`));
      return;
    }

    if (commandName === "launchmode") {
      if (!hasManageGuildPermission(interaction)) {
        res.status(200).json(reply("You need Manage Server permission to use this command."));
        return;
      }

      const desktopOnly = getBooleanOption(interaction, "desktop_only");
      if (desktopOnly === null) {
        const current = await getLaunchMode();
        res.status(200).json(reply(`Current launch mode: ${current.desktopOnly ? "desktop-only" : "web + desktop"}`));
        return;
      }

      const actorId = interaction.user?.id || "discord-webhook";
      const actorUsername = interaction.user?.username || "discord-webhook";
      const updated = await setLaunchModeDesktopOnly(desktopOnly, {
        id: actorId,
        username: actorUsername,
      });

      res.status(200).json(reply(`Launch mode updated: ${updated.desktopOnly ? "desktop-only" : "web + desktop"}`));
      return;
    }

    res.status(200).json(reply(`Unknown command: ${commandName || "(empty)"}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[discord] Webhook interaction handler failed:", message);
    res.status(200).json(reply("Command failed. Check server logs."));
  }
}
