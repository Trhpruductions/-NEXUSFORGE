"use strict";

// Health probes. The app rate-limits by client address (600 requests per 15 minutes), and every probe from this PC
// shares one address. So probes run every 15 seconds, and a 429 from the app is its own state ("rate_limited"):
// the console backs off that one target for 60 seconds instead of reporting it as down.

const http = require("node:http");
const https = require("node:https");
const { HEALTH_TARGETS, RATE_LIMIT_BACKOFF_MS } = require("../config");
const { scrubText } = require("../secrets");

const memo = new Map(); // target key -> { backoffUntil, last }
const probeLog = []; // the console's own probe log, last 200 probes
let probesTotal = 0;
let rateLimitedTotal = 0;

// The public site is served over HTTPS through the tunnel, so its probes need the https client. The config allows only
// this PC's localhost ports and nfgcord.com (see test/health-targets.test.js).
function clientFor(url) {
  return new URL(url).protocol === "https:" ? https : http;
}

function describeError(err) {
  if (!err) return "unknown error";
  if (err.code === "ECONNREFUSED") return "nothing is listening";
  if (err.code === "ECONNRESET") return "connection reset";
  if (err.message === "timeout") return "no answer in time";
  return scrubText(err.code || err.message || "request failed");
}

function probe(target) {
  return new Promise((resolve) => {
    const started = Date.now();
    let done = false;
    const finish = (fields) => {
      if (done) return;
      done = true;
      resolve({
        key: target.key,
        label: target.label,
        path: new URL(target.url).pathname,
        latencyMs: Date.now() - started,
        ...fields,
      });
    };

    const req = clientFor(target.url).get(target.url, { headers: { accept: "application/json, text/html;q=0.8, */*;q=0.5" } }, (res) => {
      const chunks = [];
      let size = 0;
      res.on("data", (chunk) => {
        if (size < 16384) {
          chunks.push(chunk);
          size += chunk.length;
        }
      });
      res.on("end", () => {
        const status = res.statusCode || 0;
        const ok = status >= 200 && status < 400;
        let database = null;
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (body && typeof body.database === "string") database = body.database;
        } catch {
          // Not JSON (for example the login page): nothing more to read.
        }
        finish({ ok, status, error: ok ? null : `HTTP ${status}`, database });
      });
      res.on("error", (err) => finish({ ok: false, status: null, error: describeError(err), database: null }));
    });
    req.setTimeout(target.timeoutMs, () => req.destroy(new Error("timeout")));
    req.on("error", (err) => finish({ ok: false, status: null, error: describeError(err), database: null }));
  });
}

// keys (optional) limits the probes to the named targets, so a restart of one app does not probe the whole app.
async function collectHealth(keys = null) {
  const now = Date.now();
  const targets = keys ? HEALTH_TARGETS.filter((target) => keys.includes(target.key)) : HEALTH_TARGETS;
  const items = await Promise.all(
    targets.map(async (target) => {
      const memory = memo.get(target.key);
      if (memory && memory.backoffUntil > now) {
        return { ...memory.last, backingOff: true, retryAt: new Date(memory.backoffUntil).toISOString() };
      }
      const result = await probe(target);
      probesTotal += 1;
      const state = result.status === 429 ? "rate_limited" : result.ok ? "up" : "down";
      const item = {
        ...result,
        state,
        error: state === "rate_limited" ? "Rate limited by the app, retrying" : result.error,
        backingOff: false,
        retryAt: null,
      };
      if (state === "rate_limited") {
        rateLimitedTotal += 1;
        item.retryAt = new Date(now + RATE_LIMIT_BACKOFF_MS).toISOString();
        memo.set(target.key, { backoffUntil: now + RATE_LIMIT_BACKOFF_MS, last: item });
      } else {
        memo.set(target.key, { backoffUntil: 0, last: item });
      }
      probeLog.push({ at: new Date(now).toISOString(), key: target.key, status: result.status, latencyMs: result.latencyMs, state });
      while (probeLog.length > 200) probeLog.shift();
      return item;
    }),
  );
  const cutoff = Date.now() - 60000;
  const lastMinute = probeLog.filter((entry) => Date.parse(entry.at) > cutoff).length;
  return {
    checkedAt: new Date().toISOString(),
    items,
    probes: { lastMinute, total: probesTotal, rateLimited: rateLimitedTotal, intervalSec: 15 },
    log: probeLog.slice(-40),
  };
}

module.exports = { collectHealth, clientFor };
