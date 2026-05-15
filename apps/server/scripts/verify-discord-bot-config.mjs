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

function resolveClientId() {
  const direct = String(process.env.DISCORD_CLIENT_ID || "").trim();
  if (direct) {
    return { clientId: direct, source: "DISCORD_CLIENT_ID" };
  }

  const applicationId = String(process.env.DISCORD_APPLICATION_ID || "").trim();
  if (applicationId) {
    return { clientId: applicationId, source: "DISCORD_APPLICATION_ID" };
  }

  const installUrl = String(process.env.DISCORD_INSTALL_URL || "").trim();
  if (installUrl) {
    try {
      const parsed = new URL(installUrl);
      const fromQuery = String(parsed.searchParams.get("client_id") || "").trim();
      if (fromQuery) {
        return { clientId: fromQuery, source: "DISCORD_INSTALL_URL(client_id)" };
      }
    } catch {
      // Ignore malformed install URL and continue to hard failure below.
    }
  }

  const token = String(process.env.DISCORD_BOT_TOKEN || "").trim();
  if (token) {
    const firstSegment = token.split(".")[0] || "";
    if (firstSegment) {
      const normalized = firstSegment.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
      try {
        const decoded = Buffer.from(padded, "base64").toString("utf8").trim();
        if (/^\d{15,21}$/.test(decoded)) {
          return { clientId: decoded, source: "DISCORD_BOT_TOKEN(payload)" };
        }
      } catch {
        // Ignore malformed token and continue to hard failure below.
      }
    }
  }

  return { clientId: "", source: "" };
}

async function resolveTargetGuild(rest, targetId) {
  if (!targetId) {
    return null;
  }

  try {
    const guild = await rest.get(Routes.guild(targetId));
    const guildId = String(guild?.id || "").trim();
    if (!guildId) {
      throw new Error("Discord returned an empty guild id.");
    }

    return {
      requestedId: targetId,
      resolvedGuildId: guildId,
      requestedKind: "guild",
    };
  } catch {
    // Fall through and attempt channel resolution.
  }

  const channel = await rest.get(Routes.channel(targetId));
  const guildId = String(channel?.guild_id || "").trim();
  if (!guildId) {
    throw new Error(`Target ${targetId} is not a guild and not a guild channel.`);
  }

  return {
    requestedId: targetId,
    resolvedGuildId: guildId,
    requestedKind: "channel",
  };
}

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN || "";
  const { clientId, source: clientIdSource } = resolveClientId();
  const targetId = process.env.DISCORD_GUILD_ID || process.argv[2] || "";

  if (!token) {
    console.error("[discord:verify] FAIL: DISCORD_BOT_TOKEN is missing");
    process.exitCode = 1;
    return;
  }

  if (!clientId) {
    console.error(
      "[discord:verify] FAIL: Discord client ID is missing. Set DISCORD_CLIENT_ID, DISCORD_APPLICATION_ID, or DISCORD_INSTALL_URL with client_id.",
    );
    process.exitCode = 1;
    return;
  }

  if (clientIdSource !== "DISCORD_CLIENT_ID") {
    console.log(`[discord:verify] INFO: using client ID from ${clientIdSource}`);
  }

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    const currentUser = await rest.get(Routes.user("@me"));
    const userId = String(currentUser.id || "");
    const username = `${currentUser.username ?? "unknown"}#${currentUser.discriminator ?? "0000"}`;

    if (userId !== clientId) {
      console.error(
        `[discord:verify] FAIL: token belongs to ${userId} (${username}) but DISCORD_CLIENT_ID is ${clientId}`,
      );
      console.error(
        `[discord:verify] ACTION: set DISCORD_CLIENT_ID=${userId} to match this token, or rotate DISCORD_BOT_TOKEN for client ${clientId}.`,
      );
      process.exitCode = 1;
      return;
    }

    if (targetId) {
      try {
        const target = await resolveTargetGuild(rest, targetId);
        if (!target) {
          throw new Error("Unable to resolve target guild.");
        }

        const guild = await rest.get(Routes.guild(target.resolvedGuildId));
        const resolvedGuildId = String(guild.id || "");
        if (resolvedGuildId !== target.resolvedGuildId) {
          console.error(
            `[discord:verify] FAIL: expected guild ${target.resolvedGuildId} but Discord returned ${resolvedGuildId || "<empty>"}`,
          );
          process.exitCode = 1;
          return;
        }

        if (target.requestedKind !== "guild") {
          console.log(
            `[discord:verify] INFO: resolved requested ${target.requestedKind} ${target.requestedId} to guild ${target.resolvedGuildId}`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[discord:verify] FAIL: bot cannot access target ${targetId} (${message})`);
        process.exitCode = 1;
        return;
      }
      console.log(`[discord:verify] PASS: token/client match and bot can access target ${targetId}`);
      process.exitCode = 0;
      return;
    }

    console.log(`[discord:verify] PASS: token matches DISCORD_CLIENT_ID (${clientId})`);
    process.exitCode = 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[discord:verify] FAIL: ${message}`);
    process.exitCode = 1;
  }
}

void main();
