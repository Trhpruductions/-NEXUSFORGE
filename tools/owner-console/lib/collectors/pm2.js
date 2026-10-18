"use strict";

// Reads pm2's state with `pm2 jlist` (read only). Only a fixed set of fields is kept: pm2_env is never
// stored, because it holds the environment variables of every app on this PC.

const { spawn } = require("node:child_process");
const { PM2_ENTRY, NEXUS_PM2_APPS } = require("../config");
const { scrubText } = require("../secrets");

// Never kill a pm2 client mid-call: a client cut off while the daemon is writing its reply is what
// the daemon logged as "write EOF" before it resurrected itself. A slow call is reported as slow and
// left to finish. The next read waits for it, so calls never pile up.
const ANSWER_WAIT_MS = 20000;
// At most this many pm2 clients run at once. One hung client therefore never disables monitoring. Reads stop only
// when every slot is held by a hung client, and the status says so.
const MAX_IN_FLIGHT = 2;
const FAILS_TO_OPEN = 2;
const BREAKER_MS = 2 * 60 * 1000;

let consecutiveFailures = 0;
let breakerOpenUntil = 0;
// Clients still running. An entry leaves this set only when its process exits, never on a timeout.
const inFlight = new Set();
// Tests replace the process starter and the answer wait, so no real pm2 client is started by the test suite.
let starter = startJlist;
let answerWaitMs = ANSWER_WAIT_MS;
function setTestHooks({ start, waitMs, resetBreaker } = {}) {
  if (start) starter = start;
  if (waitMs) answerWaitMs = waitMs;
  if (resetBreaker) {
    consecutiveFailures = 0;
    breakerOpenUntil = 0;
  }
}

function startJlist() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [PM2_ENTRY, "jlist"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.resume();
    child.on("error", (err) => reject(new Error(`pm2 jlist did not start: ${scrubText(String(err.code || err.message))}`)));
    child.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`pm2 jlist exited with code ${code}`));
    });
  });
}

function runJlist() {
  if (inFlight.size >= MAX_IN_FLIGHT) {
    return Promise.reject(new Error(`pm2 is still answering ${inFlight.size} earlier read(s), so no new read is started. Monitoring resumes when one returns.`));
  }
  const entry = { startedAt: Date.now() };
  entry.promise = starter().finally(() => inFlight.delete(entry));
  inFlight.add(entry);
  // The wait ends after ANSWER_WAIT_MS, but the process itself is left running until it exits.
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`pm2 jlist has not answered after ${answerWaitMs / 1000} s; it is left to finish and not killed`)), answerWaitMs);
  });
  return Promise.race([entry.promise, timeout]).finally(() => clearTimeout(timer));
}

function parseJlist(text) {
  const lineStart = text.search(/^\s*\[/m);
  if (lineStart < 0) throw new Error("pm2 jlist printed no JSON");
  const open = text.indexOf("[", lineStart);
  const close = text.lastIndexOf("]");
  if (close < open) throw new Error("pm2 jlist JSON is incomplete");
  // JSON.parse keeps the last value of a duplicated key (for example "username" and "USERNAME" stay separate).
  const list = JSON.parse(text.slice(open, close + 1));
  if (!Array.isArray(list)) throw new Error("pm2 jlist did not return a list");
  return list;
}

function mapApp(raw) {
  const env = raw.pm2_env || {};
  const monit = raw.monit || {};
  const status = typeof env.status === "string" ? env.status : "unknown";
  const name = String(raw.name || "");
  return {
    name: scrubText(name),
    pmId: typeof raw.pm_id === "number" ? raw.pm_id : null,
    pid: typeof raw.pid === "number" && raw.pid > 0 ? raw.pid : null,
    status,
    restarts: Number(env.restart_time) || 0,
    unstable: Number(env.unstable_restarts) || 0,
    uptimeMs: status === "online" && Number(env.pm_uptime) > 0 ? Math.max(0, Date.now() - Number(env.pm_uptime)) : null,
    cpu: typeof monit.cpu === "number" ? monit.cpu : null,
    memoryBytes: typeof monit.memory === "number" ? monit.memory : null,
    nexus: NEXUS_PM2_APPS.includes(name),
    // The NODE_ENV pm2 started the process with. Only this value is kept; the rest of pm2_env is not.
    nodeEnv: typeof env.NODE_ENV === "string" ? env.NODE_ENV : null,
    // Log file paths are used on the server only (for the log tails). They are never sent to the browser.
    logPaths: {
      out: typeof env.pm_out_log_path === "string" ? env.pm_out_log_path : null,
      err: typeof env.pm_err_log_path === "string" ? env.pm_err_log_path : null,
    },
  };
}

async function collectPm2() {
  if (Date.now() < breakerOpenUntil) {
    throw new Error(`pm2 reads are paused after repeated failures; the next try is at ${new Date(breakerOpenUntil).toLocaleTimeString()}`);
  }
  try {
    const apps = parseJlist(await runJlist()).map(mapApp);
    consecutiveFailures = 0;
    return { checkedAt: new Date().toISOString(), apps };
  } catch (error) {
    consecutiveFailures += 1;
    if (consecutiveFailures >= FAILS_TO_OPEN) {
      breakerOpenUntil = Date.now() + BREAKER_MS;
      consecutiveFailures = 0;
    }
    throw error;
  }
}

module.exports = { collectPm2, setTestHooks, inFlight, MAX_IN_FLIGHT };
