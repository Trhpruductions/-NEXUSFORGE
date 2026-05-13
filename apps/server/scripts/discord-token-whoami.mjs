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

async function main() {
  const token = String(process.env.DISCORD_BOT_TOKEN || "").trim();
  if (!token) {
    console.error("[discord:whoami] FAIL: DISCORD_BOT_TOKEN is missing");
    process.exitCode = 1;
    return;
  }

  try {
    const rest = new REST({ version: "10" }).setToken(token);
    const currentUser = await rest.get(Routes.user("@me"));
    const userId = String(currentUser.id || "");
    const username = `${currentUser.username ?? "unknown"}#${currentUser.discriminator ?? "0000"}`;

    console.log(`[discord:whoami] Bot user: ${username}`);
    console.log(`[discord:whoami] Bot ID: ${userId}`);
    console.log(`[discord:whoami] Set DISCORD_CLIENT_ID=${userId} to match this token, or rotate token to the intended application.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[discord:whoami] FAIL: ${message}`);
    process.exitCode = 1;
  }
}

void main();
