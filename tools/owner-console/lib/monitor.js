"use strict";

// Wires every source to its poller, keeps the latest values in memory, and builds the payloads the browser gets.

const crypto = require("node:crypto");
const { POLL, HISTORY_POINTS, TICKET_POLL_MS, TICKET_TIMEOUT_MS, NEXUS_PM2_APPS } = require("./config");
const { Poller } = require("./poller");
const { deepScrub } = require("./secrets");
const { createFeed, diffHealth, diffPm2, diffDb, diffLogs } = require("./feed");
const { collectHealth } = require("./collectors/health");
const { collectPm2 } = require("./collectors/pm2");
const { collectHost } = require("./collectors/host");
const { collectLogs } = require("./collectors/logs");
const { collectDb } = require("./collectors/db");
const { collectRepo } = require("./collectors/repo");
const { syncFromApp, ingestSecurityHits } = require("./tickets/ingest");
const { buildReadiness } = require("./readiness");
const { collectEmailStatus, collectLegalVersions } = require("./app-status");
const { checkPublicHealth, checkDisks } = require("./external");
const { JobRunner, attachJobAudit } = require("./jobs");

const LABELS = {
  health: "Health checks",
  pm2: "pm2 status",
  host: "Host metrics",
  logs: "Log tails",
  db: "Activity database",
  repo: "Git and release",
  tickets: "Ticket sync",
  readiness: "Readiness check",
  email: "Email status",
  legal: "Legal versions",
  external: "Public health and disks",
};

const state = {
  startedAt: new Date().toISOString(),
  startedMs: Date.now(),
  health: null,
  pm2: null,
  host: null,
  logs: null,
  logsSignature: "",
  logsVersion: 0,
  db: null,
  repo: null,
  feed: createFeed(),
  history: { cpuPct: [], ramPct: [], seen5m: [], messages1h: [], errorGroups1h: [], signups1h: [] },
  failing: {},
  ticketStore: null,
  readiness: null,
  email: null,
  legalVersions: null,
  external: null,
  jobs: null,
};

let pollers = [];

function pushHistory(list, value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return;
  list.push(value);
  if (list.length > HISTORY_POINTS) list.splice(0, list.length - HISTORY_POINTS);
}

/** Feed lines are written once when a source starts failing, and once when it recovers. */
function handlers(name, onResult) {
  return {
    onResult: (value) => {
      if (state.failing[name]) {
        state.failing[name] = false;
        state.feed.add("system", "ok", `${LABELS[name]} recovered`);
      }
      onResult(value);
    },
    onError: (message) => {
      if (!state.failing[name]) {
        state.failing[name] = true;
        state.feed.add("system", "error", `${LABELS[name]} failed: ${message}`);
      }
    },
  };
}

function publicApp(app) {
  const { logPaths, ...rest } = app;
  return rest;
}

function logSignature(logs) {
  const parts = Object.values(logs.apps).map((app) => [app.files, app.lines]);
  return crypto.createHash("sha1").update(JSON.stringify(parts)).digest("hex");
}

function createPollers() {
  return [
    new Poller("health", POLL.health, collectHealth, handlers("health", (next) => {
      diffHealth(state.health, next, state.feed);
      state.health = next;
    })),
    new Poller("pm2", POLL.pm2, collectPm2, handlers("pm2", (next) => {
      diffPm2(state.pm2 ? state.pm2.apps : null, next.apps, state.feed);
      state.pm2 = next;
    })),
    new Poller("host", POLL.host, collectHost, handlers("host", (next) => {
      state.host = next;
      pushHistory(state.history.cpuPct, next.cpuPct);
      pushHistory(state.history.ramPct, next.ramPct);
    })),
    new Poller("logs", POLL.logs, () => collectLogs(state.pm2 ? state.pm2.apps : null), handlers("logs", (next) => {
      const previous = state.logs;
      diffLogs(previous, next, state.feed);
      const signature = logSignature(next);
      if (signature !== state.logsSignature) {
        state.logsSignature = signature;
        state.logsVersion += 1;
      }
      state.logs = next;
      if (state.ticketStore && next.securityHits.length > 0) {
        const created = ingestSecurityHits(state.ticketStore, next.securityHits);
        for (const ticket of created) state.feed.add("ticket", "warn", `Security event: ${ticket.title}`);
      }
    })),
    new Poller("db", POLL.db, collectDb, handlers("db", (next) => {
      diffDb(state.db, next, state.feed);
      state.db = next;
      pushHistory(state.history.seen5m, next.users.seen5m);
      pushHistory(state.history.messages1h, next.messages.last1h);
      pushHistory(state.history.errorGroups1h, next.errors.groups1h);
      pushHistory(state.history.signups1h, next.users.signups1h);
    })),
    new Poller("repo", POLL.repo, collectRepo, handlers("repo", (next) => {
      state.repo = next;
    })),
    new Poller("tickets", { intervalMs: TICKET_POLL_MS, timeoutMs: TICKET_TIMEOUT_MS }, () => syncFromApp(state.ticketStore), handlers("tickets", (summary) => {
      for (const ticket of summary.created) {
        const level = ["APPEAL", "SUSPENSION", "SECURITY_LOG"].includes(ticket.sourceKind) ? "warn" : "info";
        state.feed.add("ticket", level, `New ${ticket.sourceKind.toLowerCase().replace("_", " ")} #${ticket.id}: ${ticket.title}`);
      }
      if (summary.statusChanged > 0) state.feed.add("ticket", "info", `${summary.statusChanged} ticket(s) changed status in the app`);
    })),
    new Poller("readiness", { intervalMs: 60000, timeoutMs: 15000 }, () => buildReadiness(), handlers("readiness", (next) => {
      state.readiness = next;
    })),
    new Poller("email", { intervalMs: 30000, timeoutMs: 20000 }, () => collectEmailStatus(state.readiness), handlers("email", (next) => {
      state.email = next;
    })),
    new Poller("legal", { intervalMs: 60000, timeoutMs: 25000 }, () => collectLegalVersions(), handlers("legal", (next) => {
      state.legalVersions = next;
    })),
    new Poller("external", { intervalMs: 60000, timeoutMs: 25000 }, async () => ({ publicHealth: await checkPublicHealth(), disks: await checkDisks() }), handlers("external", (next) => {
      state.external = next;
    })),
  ];
}

function start(ticketStore, { dryRun = false } = {}) {
  state.ticketStore = ticketStore;
  state.jobs = new JobRunner({ dryRun });
  attachJobAudit(state.jobs, ticketStore);
  pollers = createPollers();
  for (const poller of pollers) poller.start();
  return pollers;
}

function stop() {
  for (const poller of pollers) poller.stop();
}

function sourceStatuses() {
  const out = {};
  for (const poller of pollers) {
    out[poller.name] = { label: LABELS[poller.name], ...poller.stats, running: poller.running };
  }
  return out;
}

function buildState(all) {
  const apps = state.pm2 ? state.pm2.apps : [];
  // When a pm2 read fails, the last good read stays on screen and is marked stale. "Missing" only means a good read
  // did not list the app.
  const pm2Poller = pollers.find((p) => p.name === "pm2");
  const pm2Error = pm2Poller ? pm2Poller.stats.lastError : null;
  const pm2Stale = Boolean(pm2Error);
  const lastReadAt = state.pm2 ? state.pm2.checkedAt : null;
  const nexus = NEXUS_PM2_APPS.map((name) => {
    const found = apps.find((app) => app.name === name && app.nexus);
    if (found) return { ...publicApp(found), stale: pm2Stale, lastReadAt };
    const blank = { name, pmId: null, pid: null, restarts: 0, unstable: 0, uptimeMs: null, cpu: null, memoryBytes: null, nexus: true };
    if (!state.pm2) return { ...blank, status: "not read yet", notRead: true };
    if (pm2Stale) return { ...blank, status: "stale", stale: true, lastReadAt };
    return { ...blank, status: "missing", missing: true };
  });
  const others = apps.filter((app) => !app.nexus);
  const healthItems = state.health ? state.health.items : [];
  const sources = sourceStatuses();
  const dbError = sources.db.lastError;

  const payload = {
    generatedAt: new Date().toISOString(),
    startedAt: state.startedAt,
    uptimeSec: Math.round((Date.now() - state.startedMs) / 1000),
    readOnly: true,
    host: state.host,
    health: state.health,
    pm2: {
      checkedAt: state.pm2 ? state.pm2.checkedAt : null,
      lastReadAt,
      stale: pm2Stale,
      staleError: pm2Error,
      apps: nexus,
      otherCount: others.length,
      ...(all ? { others: others.map(publicApp) } : {}),
    },
    db: state.db,
    dbError,
    ops: {
      dryRun: state.jobs ? state.jobs.dryRun : false,
      readiness: state.readiness,
      email: state.email,
      legal: state.legalVersions,
      external: state.external,
    },
    repo: state.repo,
    history: state.history,
    feed: state.feed.items.slice(-300),
    sources,
    summary: {
      nexusOnline: nexus.filter((app) => app.status === "online").length,
      nexusTotal: nexus.length,
      healthUp: healthItems.filter((item) => item.state === "up").length,
      healthLimited: healthItems.filter((item) => item.state === "rate_limited").length,
      healthTotal: healthItems.length,
      dbState: dbError ? "error" : state.db ? "ok" : "waiting",
      ticketChangeSeq: state.ticketStore ? state.ticketStore.seq : 0,
    },
  };
  return deepScrub(payload);
}

function buildLogs() {
  if (!state.logs) return { version: state.logsVersion, checkedAt: null, apps: {}, error: state.failing.logs ? "log read failed" : null };
  return deepScrub({
    version: state.logsVersion,
    checkedAt: state.logs.checkedAt,
    apps: state.logs.apps,
    error: null,
  });
}

function getJobs() {
  return state.jobs;
}

module.exports = { start, stop, buildState, buildLogs, sourceStatuses, getJobs, state };
