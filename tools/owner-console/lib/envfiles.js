"use strict";

// Loads the app's env files into memory. Values never leave this module except as the environment of a child
// process the owner asked for (schema diff). Callers get presence, length and the file name, never the value.

const fs = require("node:fs");
const path = require("node:path");
const { REPO_ROOT } = require("./config");
const { loadModule } = require("./modules");

const dotenv = loadModule("dotenv");

const FILES = [
  { rel: path.join("apps", "server", ".env"), label: "apps/server/.env" },
  { rel: path.join("apps", "server", ".env.local"), label: "apps/server/.env.local" },
  { rel: ".env", label: ".env (repo root)" },
  { rel: ".env.local", label: ".env.local (repo root)" },
];

function loadEnvFiles() {
  const merged = new Map();
  const files = [];
  for (const entry of FILES) {
    const file = path.join(REPO_ROOT, entry.rel);
    let parsed = null;
    try {
      parsed = dotenv.parse(fs.readFileSync(file));
    } catch (err) {
      parsed = null;
    }
    files.push({ label: entry.label, exists: parsed !== null });
    if (!parsed) continue;
    for (const [key, value] of Object.entries(parsed)) {
      if (!merged.has(key)) merged.set(key, { value: String(value), sources: [] });
      merged.get(key).sources.push(entry.label);
    }
  }
  return {
    files,
    /** { present, length, sources } for one key. Never returns the value. */
    describe(key) {
      const entry = merged.get(key);
      const length = entry ? entry.value.trim().length : 0;
      return { present: length > 0, length, sources: entry && length > 0 ? entry.sources : [] };
    },
    /** Value of one key, for the rare caller that needs it in memory (e.g. a path). Do not log it. */
    valueOf(key) {
      const entry = merged.get(key);
      return entry ? entry.value.trim() : "";
    },
    /** Plain environment object for a child process. Do not log it. */
    childEnv() {
      const out = {};
      for (const [key, entry] of merged) out[key] = entry.value;
      return out;
    },
  };
}

module.exports = { loadEnvFiles };
