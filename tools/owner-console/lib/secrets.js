"use strict";

// Reads the app's env files (names and values stay in memory only), keeps a registry of secret values,
// and scrubs any text before it leaves this process.

const fs = require("node:fs");
const path = require("node:path");
const { REPO_ROOT, DATA_DIR } = require("./config");
const { loadModule } = require("./modules");

const dotenv = loadModule("dotenv");

const SERVER_ENV_FILE = path.join(REPO_ROOT, "apps", "server", ".env");
const ROOT_ENV_FILE = path.join(REPO_ROOT, ".env");
const WEB_ENV_LOCAL_FILE = path.join(REPO_ROOT, "apps", "web", ".env.local");

function readEnvFile(file) {
  try {
    return dotenv.parse(fs.readFileSync(file));
  } catch (err) {
    if (err && err.code === "ENOENT") return {};
    throw new Error(`could not read ${path.basename(file)}`);
  }
}

// Every environment file the console loads (see lib/envfiles.js) must be registered here, or its values are only pattern-scrubbed.
const SERVER_ENV_LOCAL_FILE = path.join(REPO_ROOT, "apps", "server", ".env.local");
const ROOT_ENV_LOCAL_FILE = path.join(REPO_ROOT, ".env.local");

const serverEnv = readEnvFile(SERVER_ENV_FILE);
const rootEnv = readEnvFile(ROOT_ENV_FILE);
const webEnv = readEnvFile(WEB_ENV_LOCAL_FILE);
const serverLocalEnv = readEnvFile(SERVER_ENV_LOCAL_FILE);
const rootLocalEnv = readEnvFile(ROOT_ENV_LOCAL_FILE);
// The read-only schema role's connection string (see lib/ops-actions.js).
const schemaRoleEnv = readEnvFile(path.join(DATA_DIR, "schema-readonly.env"));

// Redaction patterns for log lines and any other text. Applied after the exact-value scrub.
const PATTERNS = [
  [/(authorization\s*[:=]\s*)[^\r\n]+/gi, "$1[REDACTED]"],
  [/((?:set-)?cookie\s*[:=]\s*)[^\r\n]+/gi, "$1[REDACTED]"],
  [/\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{6,}/gi, "$1 [REDACTED]"],
  [/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{4,}/g, "[REDACTED-JWT]"],
  [/\b(?:sk|rk|pk|whsec|xox[abprs])[_-](?:live|test|prod)?[_-]?[A-Za-z0-9]{12,}/g, "[REDACTED-KEY]"],
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+(?::[^\s/@]*)?@/gi, "$1[REDACTED]@"],
  [
    /((?:"|')?[\w.-]*(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|session|cookie|jwt|credential|signature)[\w.-]*(?:"|')?\s*[:=]\s*)(?:"|')?[^\s"',;&}]+/gi,
    "$1[REDACTED]",
  ],
  [/\b[A-Fa-f0-9]{40,}\b/g, "[REDACTED-HEX]"],
  [/[A-Za-z0-9_+=-]{40,}/g, "[REDACTED-LONG]"],
];

const secretValues = new Set();
let sortedSecrets = [];

function addSecret(value) {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (trimmed.length < 6 || secretValues.has(trimmed)) return;
  secretValues.add(trimmed);
  sortedSecrets = [...secretValues].sort((a, b) => b.length - a.length);
}

function registerEnvSecrets(env) {
  for (const [key, value] of Object.entries(env)) {
    if (key === "DATABASE_URL") {
      addSecret(value);
      try {
        const password = decodeURIComponent(new URL(value).password || "");
        if (password.length >= 4) addSecret(password);
      } catch {
        // Not a parseable URL: the full value is already registered.
      }
      continue;
    }
    if (/PUBLIC|CLIENT_ID/i.test(key)) continue;
    if (/(SECRET|PASSWORD|PASS|TOKEN|PRIVATE|API_?KEY|WEBHOOK|DSN|SALT|CREDENTIAL|JWT|_KEY$)/i.test(key)) addSecret(value);
  }
}

registerEnvSecrets(serverEnv);
registerEnvSecrets(rootEnv);
registerEnvSecrets(webEnv);
registerEnvSecrets(serverLocalEnv);
registerEnvSecrets(rootLocalEnv);
registerEnvSecrets(schemaRoleEnv);

function scrubText(input) {
  if (typeof input !== "string") return input;
  let out = input;
  for (const secret of sortedSecrets) {
    if (out.includes(secret)) out = out.split(secret).join("[REDACTED]");
  }
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
  return out;
}

function deepScrub(value, depth = 0) {
  if (typeof value === "string") return scrubText(value);
  if (depth > 12 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => deepScrub(item, depth + 1));
  const out = {};
  for (const [key, item] of Object.entries(value)) out[key] = deepScrub(item, depth + 1);
  return out;
}

function getDatabaseUrl() {
  return serverEnv.DATABASE_URL || rootEnv.DATABASE_URL || "";
}

/** The public site address (not secret), used to build "Open in the app admin" links. */
function getPublicSiteUrl() {
  const value = serverEnv.APP_WEB_URL || rootEnv.APP_WEB_URL || "https://nfgcord.com";
  return value.replace(/\/+$/, "");
}

module.exports = { scrubText, deepScrub, addSecret, getDatabaseUrl, getPublicSiteUrl };
