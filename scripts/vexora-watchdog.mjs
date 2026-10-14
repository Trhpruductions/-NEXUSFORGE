#!/usr/bin/env node
/**
 * Watchdog for the live site. Runs under pm2 as "vexora-watchdog".
 *
 * Every minute it checks, in order:
 *   database  pg_isready on 127.0.0.1:5433
 *   api       http://127.0.0.1:4001/api/health/ready (answers 503 if the database doesn't reply)
 *   web       http://127.0.0.1:3300/login
 *   gateway   http://127.0.0.1:3400/api/health
 *   public    https://nfgcord.com/api/health through Cloudflare (DNS looked up at 1.1.1.1,
 *             so this PC's cached resolver can't fool it)
 *
 * After three failed checks in a row it posts to the bot's #bot-alerts channel and restarts
 * the stuck piece (pm2 restart, or pg_ctl start for the database), at most once every
 * 15 minutes per piece. It posts again when the piece recovers, and reminds every hour while
 * something stays down. It never runs "pm2 save".
 *
 * Reads the bot token and channel names from apps/server/.env; nothing is printed from it.
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import dns from "node:dns/promises";
import { execFile, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, "apps/server/.env");

const INTERVAL_MS = Number(process.env.WATCHDOG_INTERVAL_MS || 60_000);
const FAILS_BEFORE_ACTION = Number(process.env.WATCHDOG_FAILS || 3);
const HEAL_COOLDOWN_MS = 15 * 60_000;
const REMIND_EVERY_MS = 60 * 60_000;
const HEARTBEAT_EVERY_MS = 60 * 60_000;
const PUBLIC_HOST = process.env.PUBLIC_HOST || "nfgcord.com";
const API_PORT = Number(process.env.API_PORT || 4001);
const WEB_PORT = Number(process.env.WEB_PORT || 3300);
const GATEWAY_PORT = Number(process.env.GATEWAY_PORT || 3400);
const DB_PORT = String(process.env.DB_PORT || 5433);
/** --dry-run: log what would be restarted or posted instead of doing it (for testing the logic). */
const DRY_RUN = process.argv.includes("--dry-run");
const PGBIN = process.env.PGBIN || "C:\\Program Files\\PostgreSQL\\17\\bin";
const PGDATA = process.env.PGDATA || "D:\\NexusForgeDB\\data";
const PGLOG = process.env.PGLOG || "D:\\NexusForgeDB\\postgres.log";
const pm2Script = process.env.PM2_SCRIPT || path.join(process.env.APPDATA ?? "", "npm", "node_modules", "pm2", "bin", "pm2");

const log = (message) => console.log(`${new Date().toISOString()} ${message}`);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function readEnv() {
  const out = {};
  try {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
      if (match) out[match[1]] = match[2].trim().replace(/^"(.*)"$/, "$1");
    }
  } catch {
    // no env file: Discord posting is simply off
  }
  return out;
}

/** GET a URL; resolves { status, body } or rejects. `ip` pins the connection while keeping TLS/Host for `hostname`. */
function get(url, { timeout = 8_000, ip } = {}) {
  const target = new URL(url);
  const lib = target.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        host: ip || target.hostname,
        servername: target.protocol === "https:" ? target.hostname : undefined,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: target.pathname + target.search,
        method: "GET",
        headers: { Host: target.host, "User-Agent": "nexus-forge-watchdog/1.0" },
        timeout,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          if (body.length < 4096) body += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on("timeout", () => req.destroy(new Error(`no answer within ${timeout / 1000}s`)));
    req.on("error", reject);
    req.end();
  });
}

async function expectOk(url, options) {
  const started = Date.now();
  const res = await get(url, options);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  return `${Date.now() - started} ms`;
}

function run(file, args, options = {}) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, cwd: root, ...options }, (error, stdout, stderr) => {
      resolve({ ok: !error, code: error?.code, out: `${stdout ?? ""}${stderr ?? ""}`.trim() });
    });
  });
}

async function pm2(...args) {
  if (DRY_RUN) {
    log(`[dry-run] would run: pm2 ${args.join(" ")}`);
    return true;
  }
  if (!fs.existsSync(pm2Script)) {
    log(`pm2 not found at ${pm2Script}; cannot run pm2 ${args.join(" ")}`);
    return false;
  }
  // pm2.cmd misbehaves when started from inside pm2, so run its JS entry with this Node.
  const result = await run(process.execPath, [pm2Script, ...args]);
  if (!result.ok) log(`pm2 ${args.join(" ")} failed: ${result.out.split("\n").slice(-2).join(" ")}`);
  return result.ok;
}

async function restartApp(name) {
  if (await pm2("restart", name, "--update-env")) return `restarted ${name}`;
  if (await pm2("start", "ecosystem.config.cjs", "--only", name, "--update-env")) return `started ${name} from ecosystem.config.cjs`;
  return `could not restart ${name}`;
}

// ---------------------------------------------------------------------------
// Public DNS: ask 1.1.1.1 / 8.8.8.8 directly, cache for 30 minutes
// ---------------------------------------------------------------------------

let publicIp = null;
let publicIpAt = 0;

async function resolvePublicIp() {
  if (publicIp && Date.now() - publicIpAt < 30 * 60_000) return publicIp;
  try {
    const resolver = new dns.Resolver({ timeout: 4000, tries: 2 });
    resolver.setServers(["1.1.1.1", "8.8.8.8"]);
    const addresses = await resolver.resolve4(PUBLIC_HOST);
    if (addresses.length) {
      publicIp = addresses[0];
      publicIpAt = Date.now();
    }
  } catch (error) {
    log(`public DNS lookup failed (${error.message}); using the system resolver`);
  }
  return publicIp;
}

// ---------------------------------------------------------------------------
// Discord: post to the bot's report channels with the bot token (works even when the API is down)
// ---------------------------------------------------------------------------

const channelCache = new Map(); // name -> { id, at }

async function discordChannelId(env, name) {
  const cached = channelCache.get(name);
  if (cached && Date.now() - cached.at < 6 * 60 * 60_000) return cached.id;
  const guildId = env.DISCORD_REPORT_GUILD_ID || env.DISCORD_GUILD_ID;
  if (!guildId || !env.DISCORD_BOT_TOKEN) return null;
  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } });
  if (!res.ok) throw new Error(`Discord channel list: HTTP ${res.status}`);
  const channels = await res.json();
  const text = channels.filter((channel) => channel.type === 0);
  const category = String(env.DISCORD_REPORT_CATEGORY_ID || "");
  const match =
    text.find((channel) => channel.name === name && category && String(channel.parent_id || "") === category) ??
    text.find((channel) => channel.name === name);
  const id = match?.id ?? null;
  channelCache.set(name, { id, at: Date.now() });
  return id;
}

async function discordPost(kind, title, description, color) {
  if (DRY_RUN) {
    log(`[dry-run] would post to #${kind}: ${title} - ${description.replace(/\n/g, " ")}`);
    return;
  }
  const env = readEnv();
  if (!env.DISCORD_BOT_TOKEN || String(env.DISCORD_REPORT_ENABLED ?? "true").toLowerCase() === "false") return;
  const name = kind === "alerts" ? env.DISCORD_REPORT_CHANNEL_ALERTS || "bot-alerts" : env.DISCORD_REPORT_CHANNEL_STATUS || "bot-status";
  try {
    const channelId = await discordChannelId(env, name);
    if (!channelId) {
      log(`Discord: no #${name} channel found; message not posted`);
      return;
    }
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{ title, description, color, timestamp: new Date().toISOString(), footer: { text: "Nexus Forge watchdog" } }],
        allowed_mentions: { parse: [] },
      }),
    });
    if (!res.ok) log(`Discord post failed: HTTP ${res.status}`);
  } catch (error) {
    log(`Discord post failed: ${error.message}`);
  }
}

const RED = 0xe5484d;
const GREEN = 0x30a46c;
const BLUE = 0x1e8bff;

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

async function postgresReady() {
  const result = await run(path.join(PGBIN, "pg_isready.exe"), ["-h", "127.0.0.1", "-p", DB_PORT, "-q"]);
  if (!result.ok) throw new Error(result.out || `pg_isready exit ${result.code}`);
  return "accepting connections";
}

async function startPostgres() {
  if (DRY_RUN) {
    log("[dry-run] would run pg_ctl start");
    return "would start Postgres";
  }
  // Same command as scripts/vexora-autostart.cmd. Detached with no pipes: postgres keeps any
  // inherited handles open, which would otherwise hang this call.
  const child = spawn(
    path.join(PGBIN, "pg_ctl.exe"),
    ["-D", PGDATA, "-o", "-p 5433 -c listen_addresses=localhost", "-l", PGLOG, "-w", "-t", "60", "start"],
    { detached: true, stdio: "ignore", windowsHide: true },
  );
  child.unref();
  for (let i = 0; i < 12; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      await postgresReady();
      return "started Postgres on 5433";
    } catch {
      // keep waiting
    }
  }
  return "tried to start Postgres; still not ready (see D:\\NexusForgeDB\\postgres.log)";
}

const checks = [
  { key: "db", label: "Database (Postgres on 5433)", probe: postgresReady, heal: startPostgres },
  // /health/ready also runs a query, so an API that is up but has lost its database counts as down.
  { key: "api", label: `API (port ${API_PORT})`, probe: () => expectOk(`http://127.0.0.1:${API_PORT}/api/health/ready`, { timeout: 10_000 }), heal: () => restartApp("nexusforge-backend-workspace"), needs: ["db"] },
  { key: "web", label: `Web app (port ${WEB_PORT})`, probe: () => expectOk(`http://127.0.0.1:${WEB_PORT}/login`, { timeout: 15_000 }), heal: () => restartApp("nexusforge-web-workspace") },
  { key: "gateway", label: `Gateway (port ${GATEWAY_PORT})`, probe: () => expectOk(`http://127.0.0.1:${GATEWAY_PORT}/api/health`), heal: () => restartApp("vexora-gateway"), needs: ["api"] },
  {
    key: "public",
    label: `Public site (https://${PUBLIC_HOST})`,
    probe: async () => expectOk(`https://${PUBLIC_HOST}/api/health`, { ip: await resolvePublicIp(), timeout: 15_000 }),
    heal: () => restartApp("vexora-tunnel"),
    needs: ["gateway", "api"],
  },
];

const state = new Map(checks.map((check) => [check.key, { fails: 0, down: false, downSince: 0, lastHealAt: 0, lastAlertAt: 0, lastDetail: "" }]));

function minutes(ms) {
  const total = Math.round(ms / 60_000);
  return total < 60 ? `${total} min` : `${Math.floor(total / 60)} h ${total % 60} min`;
}

async function round() {
  const okNow = new Set();
  for (const check of checks) {
    const s = state.get(check.key);
    // When something this depends on is down, its own failure says nothing new: skip, don't heal.
    if ((check.needs ?? []).some((dep) => !okNow.has(dep))) continue;

    let ok = false;
    let detail = "";
    try {
      detail = await check.probe();
      ok = true;
    } catch (error) {
      detail = error instanceof Error ? error.message : String(error);
    }

    if (ok) {
      okNow.add(check.key);
      if (s.down) {
        const outage = minutes(Date.now() - s.downSince);
        log(`${check.key} recovered after ${outage}`);
        await discordPost("alerts", `🟢 ${check.label} is back`, `Recovered after ${outage}. Last check: ${detail}.`, GREEN);
      } else if (s.fails > 0) {
        log(`${check.key} ok again after ${s.fails} failed check(s)`);
      }
      s.fails = 0;
      s.down = false;
      s.downSince = 0;
      continue;
    }

    s.fails += 1;
    s.lastDetail = detail;
    log(`${check.key} failed (${s.fails}): ${detail}`);
    if (s.fails < FAILS_BEFORE_ACTION) continue;

    const now = Date.now();
    let action = "";
    if (check.heal && now - s.lastHealAt > HEAL_COOLDOWN_MS) {
      s.lastHealAt = now;
      log(`${check.key}: healing`);
      try {
        action = await check.heal();
      } catch (error) {
        action = `heal failed: ${error instanceof Error ? error.message : String(error)}`;
      }
      log(`${check.key}: ${action}`);
    }

    if (!s.down) {
      s.down = true;
      s.downSince = now - (FAILS_BEFORE_ACTION - 1) * INTERVAL_MS;
      s.lastAlertAt = now;
      await discordPost("alerts", `🔴 ${check.label} is down`, `${FAILS_BEFORE_ACTION} checks in a row failed: ${detail}.${action ? `\nAction: ${action}.` : ""}`, RED);
    } else if (now - s.lastAlertAt > REMIND_EVERY_MS) {
      s.lastAlertAt = now;
      await discordPost("alerts", `🔴 ${check.label} is still down`, `Down for ${minutes(now - s.downSince)}. Latest: ${detail}.${action ? `\nAction: ${action}.` : ""}`, RED);
    }
  }
  return okNow;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

let lastHeartbeat = 0;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const okNow = await round();
    if (Date.now() - lastHeartbeat > HEARTBEAT_EVERY_MS) {
      lastHeartbeat = Date.now();
      log(`heartbeat: ${okNow.size}/${checks.length} checks ok`);
    }
  } catch (error) {
    log(`round failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    running = false;
  }
}

if (process.argv.includes("--once")) {
  const okNow = await round();
  for (const check of checks) console.log(`${okNow.has(check.key) ? "ok  " : "FAIL"} ${check.label}${okNow.has(check.key) ? "" : `: ${state.get(check.key).lastDetail || "skipped (dependency down)"}`}`);
  process.exit(okNow.size === checks.length ? 0 : 1);
}

log(`watchdog started: ${checks.length} checks every ${INTERVAL_MS / 1000}s, action after ${FAILS_BEFORE_ACTION} failures`);
await discordPost(
  "status",
  "🛡️ Watchdog online",
  `Checking the database, API, web app, gateway and https://${PUBLIC_HOST} every ${INTERVAL_MS / 1000} s. A piece that fails ${FAILS_BEFORE_ACTION} checks in a row is restarted and reported in #bot-alerts.`,
  BLUE,
);
await tick();
setInterval(() => void tick(), INTERVAL_MS);
