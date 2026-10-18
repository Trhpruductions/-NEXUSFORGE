"use strict";

// Fixed settings for the owner console. Nothing here is a secret.

const path = require("node:path");

const CONSOLE_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(CONSOLE_ROOT, "..", "..");

const BIND_HOST = "127.0.0.1";

// Tried in order. 3000 (another bot on this PC), 3300 (web), 3400 (gateway) and 4001 (API) are never used.
const PORT_CANDIDATES = [4600, 4700, 4800];
const RESERVED_PORTS = new Set([3000, 3300, 3400, 4001]);

// pm2's own JavaScript entry point (run with node, so no shell and no pm2.cmd lookup).
// Read from pm2's own package.json ("bin"), so the console finds pm2 the same way the watchdog does.
const PM2_ENTRY = (() => {
  const fs = require("node:fs");
  const os = require("node:os");
  const root = path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "npm", "node_modules", "pm2");
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const entry = typeof pkg.bin === "string" ? pkg.bin : pkg.bin && pkg.bin.pm2;
    if (entry) return path.join(root, entry);
  } catch {
    // fall back below
  }
  return path.join(root, "bin", "pm2");
})();

// The Nexus Forge apps from ecosystem.config.cjs. Everything else under pm2 is hidden unless "show all" is on.
const NEXUS_PM2_APPS = [
  "nexusforge-backend-workspace",
  "nexusforge-web-workspace",
  "vexora-gateway",
  "vexora-tunnel",
  "vexora-watchdog",
];

// Apps whose pm2 log files are tailed, keyed by the short name used in the UI.
const LOG_APPS = [
  { key: "backend", label: "API (backend)", pm2Name: "nexusforge-backend-workspace" },
  { key: "web", label: "Web (Next.js)", pm2Name: "nexusforge-web-workspace" },
  { key: "gateway", label: "Gateway", pm2Name: "vexora-gateway" },
  { key: "tunnel", label: "Tunnel", pm2Name: "vexora-tunnel" },
];

// Health probes run against 127.0.0.1 (the app's own ports) and against the public site, read-only GETs only.
// The public probes go out through the Cloudflare tunnel, so they show what visitors see. The tunnel has no local
// health endpoint (see the repo's scripts/vexora-tunnel.mjs), so it is shown from its pm2 status only.
const HEALTH_TARGETS = [
  { key: "backend", label: "API (backend)", url: "http://127.0.0.1:4001/api/health", timeoutMs: 4000 },
  { key: "backend-ready", label: "API ready (checks DB)", url: "http://127.0.0.1:4001/api/health/ready", timeoutMs: 6000 },
  { key: "web", label: "Web (Next.js login page)", url: "http://127.0.0.1:3300/login", timeoutMs: 4000 },
  { key: "gateway", label: "Gateway (routes to API)", url: "http://127.0.0.1:3400/api/health", timeoutMs: 4000 },
  { key: "public-api", label: "Public API ready (nfgcord.com)", url: "https://nfgcord.com/api/health/ready", timeoutMs: 8000 },
  { key: "public-site", label: "Public website (nfgcord.com)", url: "https://nfgcord.com/", timeoutMs: 8000 },
];

const POLL = {
  health: { intervalMs: 15000, timeoutMs: 9000 },
  // One pm2 read at a time, once a minute. See lib/collectors/pm2.js for the timeout and circuit breaker.
  pm2: { intervalMs: 60000, timeoutMs: 22000 },
  logs: { intervalMs: 3000, timeoutMs: 10000 },
  host: { intervalMs: 3000, timeoutMs: 5000 },
  // Row counts run table scans on the live database (no index starts with createdAt on Message). Every 45 s, not 5 s.
  db: { intervalMs: 45000, timeoutMs: 20000 },
  repo: { intervalMs: 30000, timeoutMs: 60000 },
};

const PUSH_INTERVAL_MS = 3000;
// After the app answers 429 to a probe, the console waits this long before probing that target again.
const RATE_LIMIT_BACKOFF_MS = 60000;
const HISTORY_POINTS = 60;
const LOG_TAIL_LINES = 200;
const LOG_TAIL_BYTES = 256 * 1024;
const LOG_LINE_MAX_CHARS = 500;
const FEED_MAX = 300;
const MAX_SSE_CLIENTS = 4;

// Triage store (the only thing this console writes). Created on first run.
const DATA_DIR = path.join(CONSOLE_ROOT, "data");
const TICKET_DB_FILE = path.join(DATA_DIR, "console.sqlite");
const TICKET_POLL_MS = 10000;
const TICKET_TIMEOUT_MS = 30000;
// Error groups reaching this many occurrences get an automatic bug candidate.
const ERROR_BUG_THRESHOLD = 5;
const SUPPORT_BACKFILL_DAYS = 7;

const DESKTOP_MANIFEST = path.join(REPO_ROOT, "apps", "web", "public", "desktop-update.json");
const LEGAL_DIR = path.join(REPO_ROOT, "docs", "legal", "texas");

module.exports = {
  CONSOLE_ROOT,
  REPO_ROOT,
  BIND_HOST,
  PORT_CANDIDATES,
  RESERVED_PORTS,
  PM2_ENTRY,
  NEXUS_PM2_APPS,
  LOG_APPS,
  HEALTH_TARGETS,
  POLL,
  PUSH_INTERVAL_MS,
  RATE_LIMIT_BACKOFF_MS,
  HISTORY_POINTS,
  LOG_TAIL_LINES,
  LOG_TAIL_BYTES,
  LOG_LINE_MAX_CHARS,
  FEED_MAX,
  MAX_SSE_CLIENTS,
  DESKTOP_MANIFEST,
  LEGAL_DIR,
  DATA_DIR,
  TICKET_DB_FILE,
  TICKET_POLL_MS,
  TICKET_TIMEOUT_MS,
  ERROR_BUG_THRESHOLD,
  SUPPORT_BACKFILL_DAYS,
};
