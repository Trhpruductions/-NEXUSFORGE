"use strict";

// Nexus Forge Owner Console. Binds to 127.0.0.1 only, needs a random access token, and only reads the app.
// The only writes are to the console's own triage store under ./data.

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

const cfg = require("./lib/config");
const { scrubText, deepScrub } = require("./lib/secrets");
const { closePool } = require("./lib/appdb");
const monitor = require("./lib/monitor");
const { TicketStore } = require("./lib/tickets/store");
const ops = require("./lib/ops-actions");
const finance = require("./lib/finance");
const financeReport = require("./lib/finance-report");
const { ExpenseLedger } = require("./lib/expense-ledger");
const { presetRange, CATEGORIES } = require("./lib/expenses");

const TOKEN = crypto.randomBytes(24).toString("base64url");
const COOKIE_NAME = "oc_session";
// The cookie holds a derived value, not the token itself.
const SESSION_VALUE = crypto.createHmac("sha256", TOKEN).update("owner-console-session").digest("base64url");
const NO_OPEN = process.argv.includes("--no-open");
// Dry run prints every job command and runs nothing. Use it to test the restart and build paths safely.
const DRY_RUN = process.argv.includes("--dry-run") || process.env.OWNER_CONSOLE_DRY_RUN === "1";
let jobsDirty = false;

const STATIC_FILES = new Map([
  ["/", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/index.html", { file: "index.html", type: "text/html; charset=utf-8" }],
  ["/app.js", { file: "app.js", type: "text/javascript; charset=utf-8" }],
  ["/app.css", { file: "app.css", type: "text/css; charset=utf-8" }],
]);
const staticBodies = new Map();
for (const [route, entry] of STATIC_FILES) {
  staticBodies.set(route, { type: entry.type, body: fs.readFileSync(path.join(cfg.CONSOLE_ROOT, "public", entry.file)) });
}

let port = 0;
let store = null;
let expenses = null;
const clients = new Set();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function setSecurityHeaders(res) {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  );
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
}

function sendJson(res, status, body) {
  const text = JSON.stringify(deepScrub(body));
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(text) });
  res.end(text);
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

// Headers that only a proxy or the Cloudflare tunnel adds. The console is for the owner on this PC, so any of these means the request did not come straight from the owner's browser.
const PROXY_HEADERS = ["cf-connecting-ip", "cf-ray", "cf-visitor", "cf-ipcountry", "x-forwarded-for", "x-forwarded-host", "x-real-ip", "forwarded"];

function cameThroughProxy(req) {
  return PROXY_HEADERS.some((name) => Object.prototype.hasOwnProperty.call(req.headers, name));
}

function isLoopbackAddress(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

/** DNS rebinding protection: only the exact loopback host names with this port are accepted. */
function hostAllowed(req) {
  const host = String(req.headers.host || "").toLowerCase();
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

function tokenMatches(candidate, expected) {
  if (typeof candidate !== "string" || candidate.length === 0) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return null;
}

function isAuthorized(req) {
  if (tokenMatches(readCookie(req, COOKIE_NAME), SESSION_VALUE)) return true;
  const auth = String(req.headers.authorization || "");
  return /^Bearer\s+/i.test(auth) && tokenMatches(auth.replace(/^Bearer\s+/i, ""), TOKEN);
}

function isWriteRequestAllowed(req) {
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`) return false;
  return req.headers["x-owner-console"] === "1" && String(req.headers["content-type"] || "").startsWith("application/json");
}

function readJsonBody(req, limit = 65536) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, "request body is too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        reject(new HttpError(400, "request body is not valid JSON"));
      }
    });
    req.on("error", reject);
  });
}

// A client that stops reading (a sleeping laptop, a frozen tab) must not make this process buffer without limit.
// Its events are skipped while its socket is full. If it stays full for SSE_BLOCKED_MS, the client is dropped.
const SSE_BLOCKED_MS = 15000;

function sendEvent(client, event, data) {
  if (client.res.writableNeedDrain) {
    client.blockedSince = client.blockedSince || Date.now();
    if (Date.now() - client.blockedSince > SSE_BLOCKED_MS) throw new Error("client stopped reading");
    return false;
  }
  client.blockedSince = 0;
  client.res.write(`event: ${event}\ndata: ${JSON.stringify(deepScrub(data))}\n\n`);
  return true;
}

function pushTo(client, cache) {
  const key = client.all ? "all" : "nexus";
  if (!cache.state.has(key)) cache.state.set(key, monitor.buildState(client.all));
  sendEvent(client, "state", cache.state.get(key));
  if (client.logsVersion !== monitor.state.logsVersion) {
    if (!cache.logs) cache.logs = monitor.buildLogs();
    client.logsVersion = monitor.state.logsVersion;
    sendEvent(client, "logs", cache.logs);
  }
  if (store) {
    const changed = store.changedSince(client.ticketSeq);
    if (changed.length > 0) {
      sendEvent(client, "tickets", deepScrub(changed));
      client.ticketSeq = store.seq;
    }
  }
}

function sendJobs(client) {
  const runner = monitor.getJobs();
  if (!runner) return;
  sendEvent(client, "jobs", { dryRun: DRY_RUN, jobs: runner.list() });
}

function broadcast() {
  const cache = { state: new Map(), logs: null };
  for (const client of [...clients]) {
    try {
      pushTo(client, cache);
    } catch {
      clients.delete(client);
      try {
        client.res.end();
      } catch {
        // already closed
      }
    }
  }
}

function openStream(req, res, all) {
  if (clients.size >= cfg.MAX_SSE_CLIENTS) {
    sendJson(res, 503, { error: "too many open console windows" });
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");
  const client = { res, all, logsVersion: -1, ticketSeq: store ? store.seq : 0 };
  clients.add(client);
  req.on("close", () => clients.delete(client));
  try {
    pushTo(client, { state: new Map(), logs: null });
    sendJobs(client);
  } catch {
    clients.delete(client);
    res.end();
  }
}

function ticketIdFrom(pathname, suffix = "") {
  const match = pathname.match(new RegExp(`^/api/tickets/(\\d+)${suffix}$`));
  return match ? Number(match[1]) : null;
}

function bugIdFrom(pathname) {
  const match = pathname.match(/^\/api\/bugs\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function handleGet(req, res, url) {
  const { pathname } = url;
  const all = url.searchParams.get("all") === "1";
  const staticEntry = staticBodies.get(pathname);
  if (staticEntry) {
    res.writeHead(200, { "Content-Type": staticEntry.type, "Content-Length": staticEntry.body.length });
    res.end(req.method === "HEAD" ? undefined : staticEntry.body);
    return;
  }
  if (pathname === "/api/finance") {
    try {
      return sendJson(res, 200, await finance.buildFinance());
    } catch (error) {
      return sendJson(res, 503, { error: scrubText(error && error.message ? error.message : "finance read failed") });
    }
  }
  if (pathname === "/api/finance/report") return sendJson(res, 200, await financeReport.buildPeriodReport({ range: periodFrom(url.searchParams), expenses }));
  if (pathname === "/api/finance/ledger") {
    return sendJson(res, 200, await financeReport.readLedger({ range: periodFrom(url.searchParams), query: Object.fromEntries(url.searchParams) }));
  }
  if (pathname === "/api/finance/expenses") {
    if (!expenses) throw new HttpError(503, "the expense store is not open");
    const range = periodFrom(url.searchParams);
    return sendJson(res, 200, {
      range,
      expenses: expenses.list({ from: range.from, to: range.to, includeVoided: url.searchParams.get("includeVoided") === "1" }),
      summary: expenses.summary({ from: range.from, to: range.to }),
      categories: CATEGORIES,
    });
  }
  const expenseMatch = pathname.match(/^\/api\/finance\/expenses\/(\d+)$/);
  if (expenseMatch) {
    if (!expenses) throw new HttpError(503, "the expense store is not open");
    const record = expenses.get(Number(expenseMatch[1]));
    return record ? sendJson(res, 200, { expense: record, revisions: expenses.revisions(record.id) }) : sendJson(res, 404, { error: "expense not found" });
  }
  if (pathname === "/api/state") return sendJson(res, 200, monitor.buildState(all));
  if (pathname === "/api/logs") return sendJson(res, 200, monitor.buildLogs());
  if (pathname === "/api/jobs") return sendJson(res, 200, { dryRun: DRY_RUN, jobs: monitor.getJobs() ? monitor.getJobs().list() : [] });
  const jobMatch = pathname.match(/^\/api\/jobs\/(job-\d+)$/);
  if (jobMatch) {
    const job = monitor.getJobs() ? monitor.getJobs().get(jobMatch[1]) : null;
    return job ? sendJson(res, 200, job) : sendJson(res, 404, { error: "job not found" });
  }
  if (pathname === "/api/stream") return openStream(req, res, all);
  if (pathname === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (!store) return sendJson(res, 503, { error: "triage store is not open" });
  if (pathname === "/api/tickets") return sendJson(res, 200, { tickets: store.listTickets(), seq: store.seq });
  if (pathname === "/api/bugs") return sendJson(res, 200, { bugs: store.listBugs() });
  if (pathname === "/api/actions") return sendJson(res, 200, { actions: store.listActions(200) });
  const id = ticketIdFrom(pathname);
  if (id !== null) {
    const detail = store.getTicketDetail(id);
    return detail ? sendJson(res, 200, detail) : sendJson(res, 404, { error: "ticket not found" });
  }
  return sendJson(res, 404, { error: "not found" });
}

async function handlePost(req, res, url) {
  if (!isWriteRequestAllowed(req)) throw new HttpError(403, "write requests need the console's own headers");
  if (!store) throw new HttpError(503, "triage store is not open");
  const { pathname } = url;
  const body = await readJsonBody(req);
  if (pathname === "/api/finance/expenses") {
    if (!expenses) throw new HttpError(503, "the expense store is not open");
    const result = expenses.create(body);
    if (result.errors) return sendJson(res, 400, { error: result.errors.join(" "), errors: result.errors });
    store.logAction("expense.create", { detail: `expense ${result.record.id}, ${result.record.category}` });
    return sendJson(res, 201, result.record);
  }
  const expenseAction = pathname.match(/^\/api\/finance\/expenses\/(\d+)\/(update|void)$/);
  if (expenseAction) {
    if (!expenses) throw new HttpError(503, "the expense store is not open");
    const id = Number(expenseAction[1]);
    const result = expenseAction[2] === "update" ? expenses.update(id, body) : expenses.void(id, body.reason);
    if (result.notFound) return sendJson(res, 404, { error: "expense not found" });
    if (result.errors) return sendJson(res, 400, { error: result.errors.join(" "), errors: result.errors });
    store.logAction(`expense.${expenseAction[2]}`, { detail: `expense ${id}` });
    return sendJson(res, 200, result.record);
  }
  if (pathname.startsWith("/api/ops/")) return handleOps(pathname, body, res);
  const action = pathname.match(/^\/api\/tickets\/(\d+)\/(triage|note|link-bug)$/);
  if (action) {
    const ticketId = Number(action[1]);
    if (action[2] === "triage") return sendJson(res, 200, store.triage(ticketId, pickFields(body, ["status", "severity", "category"])));
    if (action[2] === "note") return sendJson(res, 200, store.setNote(ticketId, body.note));
    let bugId = Number(body.bugId);
    if (!Number.isInteger(bugId) || bugId <= 0) {
      bugId = store.createBug({ title: body.newBugTitle, notes: `Created from ticket ${ticketId}.` });
    }
    return sendJson(res, 200, store.linkToBug(ticketId, bugId));
  }
  if (pathname === "/api/incidents") {
    if (typeof body.title !== "string" || !body.title.trim()) throw new HttpError(400, "a title is required");
    try {
      return sendJson(res, 200, store.createIncident({ title: body.title, severity: body.severity, note: body.note }));
    } catch (error) {
      throw new HttpError(400, error.message);
    }
  }
  if (pathname === "/api/bugs") {
    const id = store.createBug({ title: body.title, notes: body.notes || "" });
    return sendJson(res, 200, store.listBugs().find((bug) => bug.id === id));
  }
  const bugId = bugIdFrom(pathname);
  if (bugId !== null) {
    return sendJson(res, 200, store.updateBug(bugId, pickFields(body, ["status", "fixedIn", "notes"])));
  }
  throw new HttpError(404, "not found");
}

// Write actions that run as jobs. Each needs the owner's confirmation: a typed name for restarts, a confirmed flag otherwise.
function handleOps(pathname, body, res) {
  const runner = monitor.getJobs();
  if (!runner) throw new HttpError(503, "job runner is not ready yet");
  if (pathname === "/api/ops/restart") {
    const app = String(body.app || "");
    const typed = String(body.typed || "");
    if (!ops.RESTART_APPS.includes(app)) throw new HttpError(400, "that app cannot be restarted from the console");
    if (typed !== app) {
      if (store) store.logOps({ action: "ops.restart", target: app, result: "rejected", detail: "the typed name did not match, nothing was run" });
      throw new HttpError(400, "the typed name does not match the app name");
    }
    // A second restart of the same app is refused, not queued: pm2 would be asked to restart it twice in a row.
    if (runner.hasActive("restart", app)) throw new HttpError(409, "a restart of this app is already queued, running, or stuck");
    return sendJson(res, 202, ops.startRestart(runner, app));
  }
  if (pathname === "/api/ops/build") {
    if (body.confirmed !== true) throw new HttpError(400, "confirmation is required");
    if (!Object.prototype.hasOwnProperty.call(ops.BUILDS, body.target)) throw new HttpError(400, "unknown build");
    // Never two builds of the same target at once: the second one is refused, not queued.
    if (runner.hasActive("build", body.target)) throw new HttpError(409, "this build is already queued or running");
    return sendJson(res, 202, ops.startBuild(runner, body.target));
  }
  if (pathname === "/api/ops/check") {
    if (body.confirmed !== true) throw new HttpError(400, "confirmation is required");
    if (!Object.prototype.hasOwnProperty.call(ops.CHECKS, body.check)) throw new HttpError(400, "unknown check");
    if (runner.hasActive("check", body.check)) throw new HttpError(409, "this check is already queued or running");
    return sendJson(res, 202, ops.startCheck(runner, body.check));
  }
  if (pathname === "/api/ops/schema") {
    if (runner.hasActive("schema", "schema")) throw new HttpError(409, "a schema check is already queued, running, or stuck");
    return sendJson(res, 202, ops.startSchemaDiff(runner));
  }
  throw new HttpError(404, "not found");
}

/** The finance period from the query string: a preset (default this month), or a custom from and to. Refuses bad input. */
function periodFrom(params) {
  try {
    return presetRange(params.get("preset") || "month", new Date(), { from: params.get("from"), to: params.get("to") });
  } catch (error) {
    throw new HttpError(400, scrubText(error && error.message ? error.message : "invalid period"));
  }
}

function pickFields(source, keys) {
  const out = {};
  for (const key of keys) if (source && source[key] !== undefined) out[key] = source[key];
  return out;
}

async function handle(req, res) {
  setSecurityHeaders(res);
  if (cameThroughProxy(req)) {
    sendText(res, 403, "Forbidden: this console is not reachable through a proxy or tunnel.");
    return;
  }
  if (!isLoopbackAddress(req.socket.remoteAddress) || !hostAllowed(req)) {
    sendText(res, 403, "Forbidden: this console only answers on 127.0.0.1.");
    return;
  }
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);

  // The first visit carries the token in the link. Exchange it for a cookie and drop it from the address bar.
  const queryToken = url.searchParams.get("token");
  if (queryToken !== null) {
    if (!tokenMatches(queryToken, TOKEN)) {
      sendText(res, 401, "Unauthorized.");
      return;
    }
    res.setHeader("Set-Cookie", `${COOKIE_NAME}=${SESSION_VALUE}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`);
    res.writeHead(302, { Location: url.pathname });
    res.end();
    return;
  }

  if (!isAuthorized(req)) {
    sendText(res, 401, "Unauthorized. Open the link printed in the console window.");
    return;
  }

  try {
    if (req.method === "GET" || req.method === "HEAD") {
      await handleGet(req, res, url);
    } else if (req.method === "POST") {
      await handlePost(req, res, url);
    } else {
      sendJson(res, 405, { error: "method not allowed" });
    }
  } catch (err) {
    if (res.headersSent) {
      res.end();
      return;
    }
    const status = err instanceof HttpError ? err.status : 400;
    sendJson(res, status, { error: scrubText(err && err.message ? err.message : "request failed") });
  }
}

function listenOn(server, candidate) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.removeListener("listening", onListening);
      reject(err);
    };
    const onListening = () => {
      server.removeListener("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(candidate, cfg.BIND_HOST);
  });
}

async function listenOnFreePort(server) {
  for (const candidate of cfg.PORT_CANDIDATES) {
    if (cfg.RESERVED_PORTS.has(candidate)) continue;
    try {
      await listenOn(server, candidate);
      return candidate;
    } catch (err) {
      if (err.code !== "EADDRINUSE") throw err;
    }
  }
  throw new Error("no free port in the candidate list");
}

function openBrowser(url) {
  if (process.platform !== "win32") return;
  try {
    const child = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.on("error", () => {});
    child.unref();
  } catch {
    // The link is printed above, so the owner can open it by hand.
  }
}

async function main() {
  process.on("uncaughtException", (err) => {
    console.error(`[owner-console] unexpected error: ${scrubText(err && err.message ? err.message : String(err))}`);
  });
  process.on("unhandledRejection", (reason) => {
    console.error(`[owner-console] unexpected rejection: ${scrubText(reason && reason.message ? reason.message : String(reason))}`);
  });

  store = new TicketStore();
  expenses = new ExpenseLedger(store.db);

  const server = http.createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) sendText(res, 500, "Internal error.");
      else res.end();
    });
  });
  port = await listenOnFreePort(server);

  monitor.start(store, { dryRun: DRY_RUN });
  monitor.getJobs().on("change", () => {
    jobsDirty = true;
  });
  // Every output line goes out the moment it is written. No batching, so the log panel is live.
  monitor.getJobs().on("line", (line) => {
    for (const client of [...clients]) {
      try {
        sendEvent(client, "joblog", line);
      } catch {
        clients.delete(client);
      }
    }
  });
  const jobsTimer = setInterval(() => {
    if (!jobsDirty) return;
    jobsDirty = false;
    for (const client of [...clients]) {
      try {
        sendJobs(client);
      } catch {
        clients.delete(client);
      }
    }
  }, 500);
  const broadcastTimer = setInterval(broadcast, cfg.PUSH_INTERVAL_MS);

  const url = `http://127.0.0.1:${port}/?token=${TOKEN}`;
  console.log("");
  console.log("Nexus Forge Owner Console");
  console.log(`Listening on 127.0.0.1:${port} only. Read only for the app; writes go to ./data.`);
  console.log("");
  console.log("Open this link once (it signs this browser in):");
  console.log(url);
  console.log("");
  console.log("Keep this window open. Press Ctrl+C to stop.");
  if (!NO_OPEN) openBrowser(url);

  const shutdown = () => {
    clearInterval(broadcastTimer);
    clearInterval(jobsTimer);
    monitor.stop();
    for (const client of clients) {
      try {
        client.res.end();
      } catch {
        // already closed
      }
    }
    server.close();
    closePool().finally(() => {
      try {
        store.close();
      } catch {
        // already closed
      }
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(`[owner-console] could not start: ${scrubText(err && err.message ? err.message : String(err))}`);
  process.exit(1);
});
