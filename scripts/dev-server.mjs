#!/usr/bin/env node
// Starts one local DEVELOPMENT server on ports that never collide with the live site on this PC.
//
//   node scripts/dev-server.mjs web   next dev on http://127.0.0.1:3301 (talks to the dev API)
//   node scripts/dev-server.mjs api   API (tsx watch) on http://127.0.0.1:4002
//
// Used by `npm run dev` (root) and `npm run dev` in apps/web and apps/server.
//
// Why: the live website (3300) and API (4001) run on the same PC under pm2, and the old dev scripts used
// (and force-cleared) those ports. This launcher:
//   - refuses the live ports (3000, 3300, 3400, 4001, 5433) and stops if the dev port is already taken,
//     instead of killing whatever holds it;
//   - points the dev web app at the dev API and the dev API's CORS / links at the dev web app;
//   - starts the dev API with a small database pool and with the Discord bot, Discord reports, the daily
//     pulse and real email delivery switched off (apps/server/.env on this PC holds the live keys);
//   - refuses to start the dev API on the live database when apps/server/.env is the live configuration;
//   - never lets `next dev` write into .next-build, the folder the live site serves.
//
// Settings (environment variables):
//   NF_DEV_WEB_PORT      dev website port (default 3301)
//   NF_DEV_API_PORT      dev API port (default 4002)
//   NF_DEV_API_URL       API the dev website calls (default http://127.0.0.1:<NF_DEV_API_PORT>)
//   NF_DEV_ALLOW_DISCORD=true  let the dev API log in to Discord and post reports (off by default)
//   NF_DEV_ALLOW_EMAIL=true    let the dev API send real email (off by default: email test mode)
//   DATABASE_URL         development database for the dev API; otherwise the one in apps/server/.env is used
//   NF_DEV_ALLOW_ENV_DATABASE=true  allow the .env database even when .env looks like the live configuration
//   DB_POOL_MAX          dev API database pool size (default 4)
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Live services on this PC. Keep in sync with scripts/cleanup-dev-ports.ps1.
const PROTECTED_PORTS = new Map([
  [3000, "another bot"],
  [3300, "the live website"],
  [3400, "vexora-gateway (public entrance)"],
  [4001, "the live API"],
  [5433, "the Postgres database"],
]);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = String(process.argv[2] || "").trim().toLowerCase();

function fail(message) {
  console.error(`[dev-server] ${message}`);
  process.exit(1);
}

function readPort(name, fallback) {
  const raw = String(process.env[name] ?? "").trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) fail(`${name}=${raw} is not a valid port.`);
  return value;
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const done = (inUse) => {
      socket.destroy();
      resolve(inUse);
    };
    socket.setTimeout(800, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

/** Reads a few keys from an env file (values are only compared, never printed). */
function readEnvFile(filePath) {
  const values = {};
  let text = "";
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch {
    return values;
  }
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function isPublicUrl(value) {
  try {
    const { hostname } = new URL(String(value || ""));
    return Boolean(hostname) && !/^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|::1)$/i.test(hostname);
  } catch {
    return false;
  }
}

function resolveBin(workspaceDir, packageName, binName) {
  const require = createRequire(path.join(workspaceDir, "package.json"));
  const manifestPath = require.resolve(`${packageName}/package.json`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const relative = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[binName];
  if (!relative) fail(`Could not find the ${binName} command in ${packageName}. Run npm install.`);
  return path.join(path.dirname(manifestPath), relative);
}

const webPort = readPort("NF_DEV_WEB_PORT", 3301);
const apiPort = readPort("NF_DEV_API_PORT", 4002);

if (target !== "web" && target !== "api") {
  fail("Usage: node scripts/dev-server.mjs web|api");
}
if (webPort === apiPort) {
  fail(`NF_DEV_WEB_PORT and NF_DEV_API_PORT are both ${webPort}; they must differ.`);
}
for (const [name, port] of [["NF_DEV_WEB_PORT", webPort], ["NF_DEV_API_PORT", apiPort]]) {
  if (PROTECTED_PORTS.has(port)) {
    fail(`${name}=${port} is used by ${PROTECTED_PORTS.get(port)} on this PC. Pick another port.`);
  }
}

const ownPort = target === "web" ? webPort : apiPort;
if (await isPortInUse(ownPort)) {
  fail(
    `Port ${ownPort} is already in use. Stop the old dev server (npm run dev:cleanup in the repo root clears stale ` +
      `dev servers, never the live site) or pick another port with ${target === "web" ? "NF_DEV_WEB_PORT" : "NF_DEV_API_PORT"}.`,
  );
}

const webOrigin = `http://127.0.0.1:${webPort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const env = { ...process.env };
let command;
let args;
let cwd;

if (target === "web") {
  cwd = path.join(repoRoot, "apps", "web");
  // A custom build folder would make `next dev` write into it; the live site serves .next-build.
  delete env.NF_BUILD_DIR;
  env.NEXT_PUBLIC_API_URL = String(process.env.NF_DEV_API_URL || apiOrigin).replace(/\/+$/, "");
  env.NEXT_PUBLIC_APP_URL = webOrigin;
  // next.config.ts sends /uploads/* to the API on this port.
  env.API_PORT = String(apiPort);
  command = process.execPath;
  args = [resolveBin(cwd, "next", "next"), "dev", "--hostname", "127.0.0.1", "--port", String(webPort)];
} else {
  cwd = path.join(repoRoot, "apps", "server");

  // On the production PC apps/server/.env is the LIVE configuration. A dev API on the live database would run
  // the jackpot engine, reminders and sweepers a second time against real data, so it needs a dev database.
  const fileEnv = readEnvFile(path.join(cwd, ".env"));
  const liveConfig = fileEnv.NODE_ENV === "production" || isPublicUrl(fileEnv.APP_WEB_URL) || isPublicUrl(fileEnv.API_PUBLIC_URL);
  const usesFileDatabase = !process.env.DATABASE_URL || process.env.DATABASE_URL === fileEnv.DATABASE_URL;
  if (liveConfig && usesFileDatabase && String(process.env.NF_DEV_ALLOW_ENV_DATABASE || "").toLowerCase() !== "true") {
    fail(
      "apps/server/.env looks like the live configuration (public site address or NODE_ENV=production), and the dev " +
        "API would use its database. Set DATABASE_URL to a development database (for example nexusforge_test) in this " +
        "terminal and run again. To use the .env database anyway, set NF_DEV_ALLOW_ENV_DATABASE=true.",
    );
  }

  // Values set here win over apps/server/.env (the API loads .env without overriding the environment).
  env.PORT = String(apiPort);
  env.NODE_ENV = "development";
  env.CLIENT_ORIGIN = `${webOrigin},http://localhost:${webPort}`;
  env.APP_WEB_URL = webOrigin;
  env.API_PUBLIC_URL = apiOrigin;
  // The live API keeps a large pool on the same Postgres server; a second default pool once exhausted it.
  env.DB_POOL_MAX = String(process.env.DB_POOL_MAX || "4");
  if (String(process.env.NF_DEV_ALLOW_DISCORD || "").toLowerCase() !== "true") {
    // A second login with the live bot token can disconnect the live bot.
    env.DISCORD_BOT_ENABLED = "false";
    env.DISCORD_REPORT_ENABLED = "false";
    env.DISCORD_PULSE_ENABLED = "false";
    env.DISCORD_REGISTER_COMMANDS_ON_START = "false";
  }
  if (String(process.env.NF_DEV_ALLOW_EMAIL || "").toLowerCase() !== "true") {
    env.EMAIL_TEST_MODE = "true";
  }
  command = process.execPath;
  args = [resolveBin(cwd, "tsx", "tsx"), "watch", "src/index.ts"];
}

console.log(`[dev-server] ${target === "web" ? `website ${webOrigin}` : `API ${apiOrigin}`} (dev web ${webOrigin}, dev API ${apiOrigin})`);
if (target === "api") {
  console.log(
    `[dev-server] Database: ${process.env.DATABASE_URL ? "DATABASE_URL from this terminal" : "DATABASE_URL from apps/server/.env"}, ` +
      `pool ${env.DB_POOL_MAX}. Discord: ${env.DISCORD_BOT_ENABLED === "false" ? "off" : "on"}. Email: ${env.EMAIL_TEST_MODE === "true" ? "test mode" : "real"}.`,
  );
}

const child = spawn(command, args, { cwd, env, stdio: "inherit" });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
