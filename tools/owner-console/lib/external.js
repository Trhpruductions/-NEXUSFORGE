"use strict";

// Checks from outside the local services: the public site's health endpoint and free disk space on the drives
// that hold the repo and the uploads folder. Read only.

const fs = require("node:fs/promises");
const https = require("node:https");
const path = require("node:path");
const { REPO_ROOT } = require("./config");
const { loadEnvFiles } = require("./envfiles");
const { scrubText } = require("./secrets");

const PUBLIC_HEALTH_URL = "https://nfgcord.com/api/health";

function describe(err) {
  if (!err) return "unknown error";
  if (err.code === "ENOTFOUND") return "name did not resolve (check the DNS cache on this PC)";
  if (err.code === "ECONNRESET") return "connection reset";
  if (err.message === "timeout") return "no answer in time";
  return scrubText(err.code || err.message || "request failed");
}

function checkPublicHealth() {
  return new Promise((resolve) => {
    const started = Date.now();
    let done = false;
    const finish = (fields) => {
      if (done) return;
      done = true;
      resolve({ url: PUBLIC_HEALTH_URL, checkedAt: new Date().toISOString(), latencyMs: Date.now() - started, ...fields });
    };
    const req = https.get(PUBLIC_HEALTH_URL, { headers: { accept: "application/json" } }, (res) => {
      res.resume();
      res.on("end", () => {
        const status = res.statusCode || 0;
        finish({ ok: status === 200, status, error: status === 200 ? null : `HTTP ${status}` });
      });
      res.on("error", (err) => finish({ ok: false, status: null, error: describe(err) }));
    });
    req.setTimeout(8000, () => req.destroy(new Error("timeout")));
    req.on("error", (err) => finish({ ok: false, status: null, error: describe(err) }));
  });
}

function uploadsPath() {
  const env = loadEnvFiles();
  const configured = env.valueOf("UPLOAD_DIR");
  if (!configured) return null;
  return path.isAbsolute(configured) ? configured : path.resolve(REPO_ROOT, "apps", "server", configured);
}

async function diskOn(root, uses) {
  const stats = await fs.statfs(root);
  const total = stats.blocks * stats.bsize;
  const free = stats.bavail * stats.bsize;
  return {
    drive: root,
    uses,
    freeGb: free / 1024 ** 3,
    totalGb: total / 1024 ** 3,
    usedPct: total > 0 ? ((total - free) / total) * 100 : null,
  };
}

async function checkDisks() {
  const rows = [];
  const repoRoot = path.parse(REPO_ROOT).root;
  const uploads = uploadsPath();
  const byDrive = new Map();
  byDrive.set(repoRoot.toUpperCase(), { root: repoRoot, uses: ["repo"] });
  if (uploads) {
    const root = path.parse(uploads).root;
    const key = root.toUpperCase();
    if (byDrive.has(key)) byDrive.get(key).uses.push("uploads");
    else byDrive.set(key, { root, uses: ["uploads"] });
  }
  for (const entry of byDrive.values()) {
    try {
      rows.push(await diskOn(entry.root, entry.uses));
    } catch (err) {
      rows.push({ drive: entry.root, uses: entry.uses, error: describe(err) });
    }
  }
  return { checkedAt: new Date().toISOString(), uploadsConfigured: Boolean(uploads), drives: rows };
}

module.exports = { checkPublicHealth, checkDisks, PUBLIC_HEALTH_URL };
