(() => {
  "use strict";

  // "finance" goes last so the number keys 1 to 0 keep their places. It has its own key, F.
  const VIEWS = ["overview", "services", "activity", "logs", "feed", "tickets", "release", "legal", "readiness", "operations", "finance"];
  const TABS = [
    { key: "inbox", label: "Inbox" },
    { key: "bugs", label: "Bugs" },
    { key: "reports", label: "Reports" },
    { key: "support", label: "Support" },
    { key: "appeals", label: "Appeals" },
    { key: "bans", label: "Bans and suspensions" },
    { key: "security", label: "Security" },
    { key: "closed", label: "Closed" },
  ];
  const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const SEVERITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const TICKET_STATUSES = ["NEW", "TRIAGED", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"];
  const BUG_STATUSES = ["OPEN", "FIXING", "FIXED"];
  const KIND_LABELS = {
    PROBLEM: "Problem report",
    MESSAGE_REPORT: "Message report",
    SUPPORT: "Support ticket",
    APPEAL: "Appeal",
    SUSPENSION: "Suspension",
    FORGE_BAN: "Forge ban",
    ERROR_GROUP: "Error group",
    SECURITY_LOG: "Security log",
    AUDIT_FAILURE: "Failed action",
    MANUAL_INCIDENT: "Incident",
  };
  const FEED_KINDS = ["service", "pm2", "signup", "message", "error", "email", "ticket", "support", "report", "log", "jackpot", "system"];

  const app = {
    state: null,
    logs: null,
    all: false,
    view: "overview",
    paused: false,
    lastStateAt: 0,
    es: null,
    liveState: "connecting",
    tickets: new Map(),
    bugs: [],
    actions: [],
    tab: "inbox",
    selection: null,
    detail: null,
    tickSeconds: 0,
  };

  const $ = (sel) => document.querySelector(sel);
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

  function toDate(value) {
    if (!value) return null;
    let text = String(value);
    // Database timestamps are UTC without a zone: "2026-10-15 10:00:00.123".
    if (/^\d{4}-\d{2}-\d{2} \d/.test(text)) text = `${text.replace(" ", "T")}Z`;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function ago(value) {
    const date = toDate(value);
    if (!date) return "never";
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 5) return "just now";
    if (diff < 60) return `${Math.round(diff)} s ago`;
    if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
    return `${Math.round(diff / 86400)} d ago`;
  }

  function ageText(value) {
    const date = toDate(value);
    if (!date) return "unknown";
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days} d ${hours} h`;
    if (hours > 0) return `${hours} h ${minutes} min`;
    if (minutes > 0) return `${minutes} min`;
    return `${seconds} s`;
  }

  function clock(value) {
    const date = toDate(value);
    return date ? date.toLocaleTimeString("en-GB", { hour12: false }) : "-";
  }

  function dateTime(value) {
    const date = toDate(value);
    return date ? date.toLocaleString("en-GB", { hour12: false }) : "-";
  }

  function num(value) {
    return value === null || value === undefined || Number.isNaN(Number(value)) ? "-" : Number(value).toLocaleString("en-GB");
  }

  function sentence(value) {
    const text = String(value ?? "").replace(/_/g, " ").toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function pill(text, tone = "") {
    return `<span class="pill${tone ? ` pill-${tone}` : ""}">${esc(text)}</span>`;
  }

  function statusTone(status) {
    if (status === "online" || status === "RESOLVED" || status === "CLOSED" || status === "DELIVERED" || status === "ACTIVE") {
      return status === "ACTIVE" ? "bad" : "good";
    }
    if (status === "stopped" || status === "errored" || status === "FAILED" || status === "BOUNCED" || status === "COMPLAINED") return "bad";
    if (status === "launching" || status === "stopping" || status === "WAITING" || status === "IN_PROGRESS") return "warn";
    if (status === "NEW" || status === "TRIAGED" || status === "OPEN") return "info";
    return "";
  }

  function severityTone(severity) {
    if (severity === "CRITICAL") return "critical";
    if (severity === "HIGH") return "bad";
    if (severity === "MEDIUM") return "warn";
    return "";
  }

  function spark(values, options = {}) {
    const width = options.width || 160;
    const height = options.height || 36;
    const points = (values || []).filter((v) => typeof v === "number" && Number.isFinite(v));
    if (points.length < 2) return `<svg class="spark" viewBox="0 0 ${width} ${height}" aria-hidden="true"></svg>`;
    const lo = Math.min(...points);
    const hi = Math.max(...points);
    const span = hi - lo || 1;
    const coords = points
      .map((v, i) => {
        const x = (i * (width - 2)) / (points.length - 1) + 1;
        const y = height - 2 - ((v - lo) / span) * (height - 4) + 1;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return `<svg class="spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><polyline class="spark-line" points="${coords}"></polyline></svg>`;
  }

  function meter(value, options = {}) {
    const v = Math.max(0, Math.min(100, Number(value) || 0));
    const tone = options.tone || (v >= 90 ? "bad" : v >= 75 ? "warn" : "");
    return `<progress class="meter${tone ? ` ${tone}` : ""}" max="100" value="${v.toFixed(1)}" aria-label="${v.toFixed(0)} percent"></progress>`;
  }

  function tile(options) {
    return `<div class="tile${options.tone ? ` ${options.tone}` : ""}"><div class="tile-label">${esc(options.label)}</div><div class="tile-value">${esc(options.value)}</div><div class="tile-sub">${esc(options.sub || "")}</div>${options.spark || ""}</div>`;
  }

  function table(headers, rows, empty = "No rows yet.") {
    if (rows.length === 0) return `<div class="empty">${esc(empty)}</div>`;
    const head = headers.map((h) => `<th${h.num ? ' class="num"' : ""}>${esc(h.label)}</th>`).join("");
    return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
  }

  function errorLine(message) {
    return message ? `<p class="error-line">${esc(message)}</p>` : "";
  }

  function loading(text) {
    return `<div class="empty">${esc(text)}</div>`;
  }

  function sourceError(name) {
    const source = app.state && app.state.sources ? app.state.sources[name] : null;
    return source && source.lastError ? source.lastError : null;
  }

  function viewHead(title, sub, extra = "") {
    return `<div class="view-head"><div><h1 class="view-title">${esc(title)}</h1><p class="view-sub">${esc(sub)}</p></div>${extra}</div>`;
  }

  function healthMap() {
    const map = {};
    if (app.state && app.state.health) for (const item of app.state.health.items) map[item.key] = item;
    return map;
  }

  function isOpen(ticket) {
    return ticket.status !== "RESOLVED" && ticket.status !== "CLOSED";
  }

  function inboxCount() {
    let n = 0;
    for (const t of app.tickets.values()) if (t.status === "NEW" && t.sourceKind !== "APPEAL") n += 1;
    return n;
  }

  function criticalOpenCount() {
    let n = 0;
    for (const t of app.tickets.values()) if (t.severity === "CRITICAL" && isOpen(t)) n += 1;
    return n;
  }

  /* Health and pm2 display helpers. A rate-limited probe is shown as its own state, never as down. */

  function clockOnly(value) {
    return value ? clock(value).slice(0, 5) : "-";
  }

  function healthState(item) {
    return item ? item.state || (item.ok ? "up" : "down") : "waiting";
  }

  function healthLabel(item) {
    const state = healthState(item);
    return state === "up" ? "Up" : state === "rate_limited" ? "Rate limited" : state === "down" ? "Down" : "Waiting";
  }

  function healthTone(item) {
    const state = healthState(item);
    return state === "up" ? "good" : state === "rate_limited" ? "warn" : state === "down" ? "bad" : "";
  }

  function healthSub(item) {
    if (!item) return "";
    const state = healthState(item);
    if (state === "rate_limited") return `Retrying at ${clockOnly(item.retryAt)}`;
    return state === "up" ? `${item.latencyMs} ms` : item.error || "";
  }

  function healthTile(label, item) {
    return tile({ label, value: healthLabel(item), sub: healthSub(item), tone: healthTone(item) });
  }

  function healthPill(item) {
    const state = healthState(item);
    if (state === "up") return pill("Up", "good");
    if (state === "rate_limited") return pill(`Rate limited by the app, retrying at ${clockOnly(item.retryAt)}`, "warn");
    return pill(item.error || "Down", "bad");
  }

  function servicePill(a) {
    if (a.notRead) return pill("Not read yet", "info");
    if (a.stale) return pill(`Stale, last read at ${clockOnly(a.lastReadAt)}`, "warn");
    if (a.missing) return pill("Missing", "bad");
    return pill(sentence(a.status), statusTone(a.status));
  }

  function renderErrorBar() {
    const bar = $("#errorBar");
    if (!bar || !app.state) return;
    const sources = app.state.sources || {};
    const lines = Object.values(sources).filter((src) => src.lastError).map((src) => `${src.label}: ${src.lastError}`);
    const pm2 = app.state.pm2;
    if (pm2 && pm2.stale && pm2.lastReadAt) lines.push(`Showing the last good pm2 read from ${clockOnly(pm2.lastReadAt)}.`);
    setHtml(bar, lines.map((line) => `<div>${esc(line)}</div>`).join(""));
    bar.hidden = lines.length === 0;
  }

  function probeLogCard(s) {
    const probes = s.health && s.health.probes;
    const log = s.health && s.health.log ? s.health.log.slice().reverse() : [];
    const rows = log.map((p) => `<tr class="${p.state === "up" ? "" : "row-bad"}"><td>${esc(clock(p.at))}</td><td class="mono">${esc(p.key)}</td><td class="num">${p.status ?? "-"}</td><td class="num">${p.latencyMs} ms</td><td>${p.state === "rate_limited" ? pill("Rate limited", "warn") : p.state === "up" ? pill("Up", "good") : pill("Down", "bad")}</td></tr>`);
    const summary = probes ? `${num(probes.lastMinute)} probes in the last minute, each target every ${probes.intervalSec} s. ${num(probes.rateLimited)} rate-limited responses since start.` : "";
    return `<section class="card"><h2 class="card-title">Console probe log</h2><p class="card-foot">${esc(summary)}</p>${table([{ label: "Time" }, { label: "Target" }, { label: "HTTP", num: true }, { label: "Latency", num: true }, { label: "Result" }], rows, "No probes yet.")}</section>`;
  }

  /* Overview */

  function renderOverview() {
    const el = $("#view-overview");
    const s = app.state;
    if (!s) {
      el.innerHTML = loading("Waiting for the first snapshot.");
      return;
    }
    const h = healthMap();
    const db = s.db;
    const apps = s.pm2.apps;
    const tunnel = apps.find((a) => a.name === "vexora-tunnel");
    const tiles = [
      healthTile("API", h.backend),
      healthTile("Web", h.web),
      healthTile("Gateway", h.gateway),
      tile({ label: "Tunnel", value: tunnel ? sentence(tunnel.status) : "Not found", sub: "pm2 status only", tone: tunnel && tunnel.status === "online" ? "good" : "bad" }),
      tile({ label: "Online in 5 min", value: num(db && db.users.seen5m), sub: `${num(db && db.users.total)} users in total`, spark: spark(s.history.seen5m) }),
      tile({ label: "Sign-ups (1 h)", value: num(db && db.users.signups1h), sub: `${num(db && db.users.newSince)} since last check` }),
      tile({ label: "Messages (1 h)", value: num(db && db.messages.last1h), sub: `${num(db && db.messages.newSince)} since last check`, spark: spark(s.history.messages1h) }),
      tile({ label: "Support open", value: num(db && db.tickets.open), sub: `${num(db && db.reports.problemOpen)} problem and ${num(db && db.reports.messageOpen)} message reports waiting` }),
      tile({ label: "Errors (1 h)", value: num(db && db.errors.groups1h), sub: "error groups", tone: db && db.errors.groups1h > 0 ? "warn" : "" }),
      tile({ label: "Console inbox", value: num(inboxCount()), sub: `${num(criticalOpenCount())} critical open`, tone: inboxCount() > 0 ? "warn" : "good" }),
      tile({ label: "Jackpot", value: db && db.jackpot ? `Round ${db.jackpot.number}` : "None", sub: db && db.jackpot ? `${sentence(db.jackpot.status)}, pot ${num(Number(db.jackpot.pot))}` : "No round found" }),
    ].join("");

    const serviceRows = apps.map((a) => `<tr><td>${esc(a.name)}</td><td>${servicePill(a)}</td><td class="num">${num(a.restarts)}</td><td class="num">${a.cpu === null ? "-" : `${a.cpu}%`}</td><td class="num">${a.memoryBytes === null ? "-" : `${Math.round(a.memoryBytes / 1048576)} MB`}</td></tr>`);
    const services = table([{ label: "Service" }, { label: "Status" }, { label: "Restarts", num: true }, { label: "CPU", num: true }, { label: "Memory", num: true }], serviceRows, "No pm2 apps reported yet.");

    const host = s.host;
    const hostCard = host
      ? `<dl class="detail-grid"><dt>CPU</dt><dd>${host.cpuPct === null ? "Measuring" : `${host.cpuPct.toFixed(0)}%`} across ${num(host.cpuCores)} cores</dd><dt>RAM</dt><dd>${host.ramPct.toFixed(0)}% (${host.ramUsedGb.toFixed(1)} of ${host.ramTotalGb.toFixed(1)} GB)</dd><dt>Disk free</dt><dd>${(host.drives && host.drives.length ? host.drives : [{ drive: host.diskDrive, freeGb: host.diskFreeGb, low: false }]).map((d) => `${d.freeGb.toFixed(1)} GB on ${esc(d.drive)}${d.low ? " (low)" : ""}`).join("<br>")}</dd></dl>${meter(host.cpuPct === null ? 0 : host.cpuPct)}<div class="section-divider"></div>${spark(s.history.cpuPct)}<div class="card-foot">CPU over the last few minutes</div>`
      : loading("Waiting for host metrics.");

    const feed = s.feed.slice(-12).reverse().map((item) => `<li><span class="feed-time">${esc(clock(item.at))}</span>${pill(sentence(item.kind), item.level === "error" ? "bad" : item.level === "warn" ? "warn" : item.level === "ok" ? "good" : "")}<span class="feed-text">${esc(item.text)}</span></li>`).join("");

    el.innerHTML = viewHead("Overview", "Everything the owner needs at a glance. Updates live.") +
      `<div class="grid">${tiles}</div>` +
      `<div class="two-col"><section class="card"><h2 class="card-title">Nexus Forge services</h2>${services}${errorLine(sourceError("pm2"))}</section>` +
      `<section class="card"><h2 class="card-title">Host</h2>${hostCard}${errorLine(sourceError("host"))}</section></div>` +
      `<section class="card"><h2 class="card-title">Latest activity</h2>${feed ? `<ol class="feed">${feed}</ol>` : loading("Nothing has changed yet.")}</section>`;
  }

  /* Services */

  function renderServices() {
    const el = $("#view-services");
    const s = app.state;
    if (!s) {
      el.innerHTML = loading("Waiting for the first snapshot.");
      return;
    }
    const appRows = (list) => list.map((a) => `<tr class="${a.status === "online" ? "" : "row-bad"}"><td>${esc(a.name)}</td><td>${servicePill(a)}</td><td class="num">${a.pid ?? "-"}</td><td class="num">${num(a.restarts)}</td><td class="num">${a.uptimeMs === null ? "-" : ageDuration(a.uptimeMs)}</td><td class="num">${a.cpu === null ? "-" : `${a.cpu}%`}</td><td class="num">${a.memoryBytes === null ? "-" : `${Math.round(a.memoryBytes / 1048576)} MB`}</td></tr>`);
    const headers = [{ label: "Name" }, { label: "Status" }, { label: "PID", num: true }, { label: "Restarts", num: true }, { label: "Uptime", num: true }, { label: "CPU", num: true }, { label: "Memory", num: true }];
    const nexus = table(headers, appRows(s.pm2.apps), "No Nexus Forge apps reported.");
    const others = app.all && s.pm2.others ? table(headers, appRows(s.pm2.others), "No other pm2 apps.") : "";
    const hiddenNote = !app.all ? `${num(s.pm2.otherCount)} other pm2 apps are hidden. Press A to show them.` : "Showing all pm2 apps. Other apps are read only here.";

    const healthRows = s.health ? s.health.items.map((item) => `<tr class="${item.ok ? "" : "row-bad"}"><td>${esc(item.label)}</td><td class="mono">${esc(item.path)}</td><td class="num">${item.status ?? "-"}</td><td class="num">${item.latencyMs} ms</td><td>${healthPill(item)}${item.database ? ` ${pill(`DB ${item.database}`, item.database === "ok" ? "good" : "bad")}` : ""}</td></tr>`) : [];
    const tunnel = s.pm2.apps.find((a) => a.name === "vexora-tunnel");
    if (tunnel) healthRows.push(`<tr><td>Tunnel</td><td class="mono">no local endpoint</td><td class="num">-</td><td class="num">-</td><td>${pill(`pm2 ${sentence(tunnel.status)}`, statusTone(tunnel.status))}</td></tr>`);
    const healthTable = table([{ label: "Check" }, { label: "Path" }, { label: "HTTP", num: true }, { label: "Latency", num: true }, { label: "Result" }], healthRows, "Waiting for the first health check.");

    const sourceRows = Object.entries(s.sources).map(([, src]) => `<tr class="${src.lastError ? "row-bad" : ""}"><td>${esc(src.label)}</td><td>${esc(ago(src.lastOkAt))}</td><td class="num">${src.lastDurationMs === null ? "-" : `${src.lastDurationMs} ms`}</td><td class="num">${num(src.runs)}</td><td class="num">${num(src.skipped)}</td><td>${src.lastError ? pill(src.lastError, "bad") : pill("None", "good")}</td></tr>`);
    const sources = table([{ label: "Source" }, { label: "Last good" }, { label: "Last run", num: true }, { label: "Runs", num: true }, { label: "Skipped", num: true }, { label: "Error" }], sourceRows);

    el.innerHTML = viewHead("Services", "pm2 processes, health probes and collector status.") +
      `<section class="card"><h2 class="card-title">Nexus Forge pm2 apps</h2>${nexus}<div class="card-foot">${esc(hiddenNote)}</div>${errorLine(sourceError("pm2"))}</section>` +
      (others ? `<section class="card"><h2 class="card-title">Other pm2 apps (read only)</h2>${others}</section>` : "") +
      `<section class="card"><h2 class="card-title">Health checks</h2>${healthTable}<div class="card-foot">Checked ${esc(ago(s.health && s.health.checkedAt))}. Probes go to 127.0.0.1 only.</div>${errorLine(sourceError("health"))}</section>` +
      probeLogCard(s) + `<section class="card"><h2 class="card-title">Collectors</h2>${sources}</section>`;
  }

  function ageDuration(ms) {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d} d ${h} h`;
    if (h > 0) return `${h} h ${m} min`;
    return `${m} min`;
  }

  /* Activity */

  function renderActivity() {
    const el = $("#view-activity");
    const s = app.state;
    if (!s) {
      el.innerHTML = loading("Waiting for the first snapshot.");
      return;
    }
    const db = s.db;
    if (!db) {
      el.innerHTML = viewHead("Activity", "Counts from the app database, read only.") + `<section class="card">${loading("Waiting for the first database check.")}${errorLine(s.dbError)}</section>`;
      return;
    }
    const tiles = [
      tile({ label: "Users", value: num(db.users.total), sub: `${num(db.users.newSince)} new since last check` }),
      tile({ label: "Forges", value: num(db.forges.total), sub: "all forges" }),
      tile({ label: "Online in 5 min", value: num(db.users.seen5m), sub: "users with a recent last-seen time", spark: spark(s.history.seen5m) }),
      tile({ label: "Sign-ups (1 h)", value: num(db.users.signups1h), sub: "new accounts", spark: spark(s.history.signups1h) }),
      tile({ label: "Messages (1 h)", value: num(db.messages.last1h), sub: `${num(db.messages.newSince)} since last check`, spark: spark(s.history.messages1h) }),
      tile({ label: "Support open", value: num(db.tickets.open), sub: "tickets not closed in the app", tone: db.tickets.open > 0 ? "warn" : "good" }),
      tile({ label: "Reports waiting", value: num(db.reports.messageOpen + db.reports.problemOpen), sub: `${num(db.reports.messageOpen)} message, ${num(db.reports.problemOpen)} problem`, tone: db.reports.messageOpen + db.reports.problemOpen > 0 ? "warn" : "good" }),
      tile({ label: "Error groups (1 h)", value: num(db.errors.groups1h), sub: "server and browser", tone: db.errors.groups1h > 0 ? "warn" : "good", spark: spark(s.history.errorGroups1h) }),
    ].join("");

    const emailTotal = db.email24h.reduce((sum, row) => sum + row.n, 0);
    const emailRows = db.email24h.map((row) => `<tr><td>${pill(sentence(row.status), statusTone(row.status))}</td><td class="num">${num(row.n)}</td><td>${meter(emailTotal ? (row.n / emailTotal) * 100 : 0)}</td></tr>`);
    const email = table([{ label: "Status" }, { label: "Count", num: true }, { label: "Share" }], emailRows, "No email in the last 24 hours.");

    const jackpot = db.jackpot
      ? `<dl class="detail-grid"><dt>Round</dt><dd>${esc(db.jackpot.slug)} #${num(db.jackpot.number)} ${pill(sentence(db.jackpot.status), statusTone(db.jackpot.status))}</dd><dt>Pot</dt><dd>${esc(num(Number(db.jackpot.pot)))}</dd><dt>Tickets sold</dt><dd>${num(db.jackpot.tickets)}</dd><dt>Opened</dt><dd>${esc(dateTime(db.jackpot.opensAt))}</dd><dt>Closes</dt><dd>${esc(dateTime(db.jackpot.closesAt))}</dd></dl>`
      : loading("No jackpot round found.");

    const errorRows = db.errors.recent.map((row) => `<tr><td>${esc(row.source)}</td><td>${esc(row.message)}</td><td class="mono">${esc(row.path || "-")}</td><td class="num">${num(row.count)}</td><td>${esc(ago(row.lastSeen))}</td></tr>`);
    const errors = table([{ label: "Source" }, { label: "Message" }, { label: "Path" }, { label: "Count", num: true }, { label: "Last seen" }], errorRows, "No errors in the last hour.");

    el.innerHTML = viewHead("Activity", "Read only counts from the app database. Checked every 5 seconds.") +
      `<div class="grid">${tiles}</div>` +
      `<div class="two-col"><section class="card"><h2 class="card-title">Email, last 24 hours</h2>${email}</section>` +
      `<section class="card"><h2 class="card-title">Jackpot</h2>${jackpot}</section></div>` +
      `<section class="card"><h2 class="card-title">Recent errors (last hour)</h2>${errors}</section>` +
      `<p class="card-foot">Last database check ${esc(ago(db.checkedAt))}, query took ${num(db.queryMs)} ms. Session is read only.</p>${errorLine(sourceError("db"))}`;
  }

  /* Logs */

  function logFilterState() {
    return {
      app: $("#logApp").value,
      stream: $("#logStream").value,
      errorsOnly: $("#logErrors").checked,
      text: $("#logFilter").value.trim().toLowerCase(),
    };
  }

  function lineClass(text) {
    if (/error|exception|fatal|unhandled|failed|ECONN/i.test(text)) return "ln-err";
    if (/warn/i.test(text)) return "ln-warn";
    return "";
  }

  function renderLogLines() {
    const meta = $("#logMeta");
    const box = $("#logLines");
    if (app.paused) {
      meta.textContent = "Paused. Press P to resume.";
      return;
    }
    if (!app.logs) {
      meta.textContent = "Waiting for the first log read.";
      box.innerHTML = loading("Waiting for log lines.");
      return;
    }
    const f = logFilterState();
    const entry = app.logs.apps[f.app];
    if (!entry) {
      box.innerHTML = loading("No log data for this app.");
      return;
    }
    const streams = f.stream === "both" ? ["out", "err"] : [f.stream];
    const rows = [];
    for (const stream of streams) {
      const file = entry.files[stream];
      for (const line of entry.lines[stream] || []) {
        const text = line.text;
        if (f.text && !text.toLowerCase().includes(f.text)) continue;
        const cls = stream === "err" ? "ln-err" : lineClass(text);
        if (f.errorsOnly && !(stream === "err" || lineClass(text))) continue;
        rows.push(`<div class="ln ${cls}"><span class="ln-tag">${stream === "err" ? "err" : "out"}</span>${esc(text)}</div>`);
      }
      if (file && file.error) rows.push(`<div class="ln ln-err"><span class="ln-tag">${stream}</span>${esc(file.error)}</div>`);
    }
    const limit = rows.slice(-300);
    const names = streams.map((stream) => entry.files[stream] && entry.files[stream].name).filter(Boolean).join(", ");
    meta.textContent = `${entry.label}: ${names || "no log file"}. Updated ${ago(app.logs.checkedAt)}. Showing ${limit.length} of ${rows.length} matching lines.${f.stream === "both" ? " Stdout and stderr are listed one after the other, not merged by time." : ""}`;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    setHtml(box, limit.length ? limit.join("") : loading("No lines match the filter."));
    if (atBottom) box.scrollTop = box.scrollHeight;
  }

  /* Feed */

  function renderFeed() {
    const list = $("#feedList");
    if (!app.state) {
      list.innerHTML = `<li>${esc("Waiting for the first snapshot.")}</li>`;
      return;
    }
    const kind = $("#feedKind").value;
    const items = app.state.feed.filter((item) => kind === "all" || item.kind === kind).slice().reverse();
    if (items.length === 0) {
      list.innerHTML = `<li><span class="feed-text">Nothing in this group yet.</span></li>`;
      return;
    }
    setHtml(list, items
      .map((item) => `<li><span class="feed-time">${esc(clock(item.at))}</span>${pill(sentence(item.kind), item.level === "error" ? "bad" : item.level === "warn" ? "warn" : item.level === "ok" ? "good" : "")}<span class="feed-text">${esc(item.text)}</span></li>`)
      .join(""));
  }

  /* Release and legal */

  function renderRelease() {
    const el = $("#view-release");
    const s = app.state;
    const repo = s && s.repo;
    if (!repo) {
      el.innerHTML = viewHead("Release", "Git and desktop manifest, read only.") + `<section class="card">${loading("Waiting for the first git read.")}</section>`;
      return;
    }
    const git = repo.git;
    const gitCard = git
      ? `<dl class="detail-grid"><dt>Branch</dt><dd class="mono">${esc(git.branch)}</dd><dt>Last commit</dt><dd><span class="mono">${esc(git.lastCommit.hash || "-")}</span> ${esc(git.lastCommit.subject)}</dd><dt>Commit date</dt><dd>${esc(dateTime(git.lastCommit.date))} (${esc(ago(git.lastCommit.date))})</dd><dt>Uncommitted</dt><dd>${num(git.uncommittedFiles)} files: ${num(git.modifiedFiles)} changed, ${num(git.untrackedFiles)} untracked</dd></dl>`
      : loading("Git details are not available.");
    const desk = repo.desktop;
    const deskCard = desk
      ? `<dl class="detail-grid"><dt>Manifest version</dt><dd class="mono">${esc(desk.version || "-")}</dd><dt>Force update</dt><dd>${desk.forceUpdate ? pill("Yes", "warn") : pill("No", "good")}</dd><dt>SHA-256 prefix</dt><dd class="mono">${esc(desk.sha256Prefix || "-")}</dd><dt>File</dt><dd class="mono">${esc(desk.file)}</dd></dl>${desk.notes ? `<div class="quote">${esc(desk.notes)}</div>` : ""}`
      : loading("Desktop manifest is not available.");
    const rel = repo.release || {};
    const versions = `<dl class="detail-grid"><dt>Desktop package</dt><dd class="mono">${esc(rel.desktopPackageVersion || "-")}</dd><dt>Update manifest</dt><dd class="mono">${esc(rel.manifestVersion || "-")}</dd><dt>Match</dt><dd>${rel.versionsMatch ? pill("Match", "good") : pill("Do not match", "bad")}</dd></dl>`;
    el.innerHTML = viewHead("Release", "Branch, last commit, and the desktop versions the updater reads. Read only.") +
      `<div class="two-col"><section class="card"><h2 class="card-title">Git</h2>${gitCard}${errorLine(repo.gitError)}</section>` +
      `<section class="card"><h2 class="card-title">Desktop versions</h2>${versions}${errorLine(rel.error)}<div class="section-divider"></div><h3 class="card-title">Update manifest</h3>${deskCard}${errorLine(repo.desktopError)}</section></div>` +
      `<section class="card"><h2 class="card-title">Publishing</h2><p class="card-foot">Publishing a desktop release needs the owner's explicit approval for that exact version. It is done only from the repo's release script (scripts/desktop-release-share.ps1), and the script refuses to run without -OwnerApproved. This console has no publish button.</p></section>` +
      `<p class="card-foot">Checked ${esc(ago(repo.checkedAt))}.</p>`;
  }

  function renderLegal() {
    const el = $("#view-legal");
    const s = app.state;
    const repo = s && s.repo;
    if (!repo || !repo.legal) {
      el.innerHTML = viewHead("Legal drafts", "Bracketed placeholders still left in the Texas drafts, and policy versions in the app. Read only.") + `<section class="card">${loading("Waiting for the first legal read.")}${errorLine(repo ? repo.legalError : null)}</section>`;
      return;
    }
    const files = repo.legal.files;
    const fileRows = files.map((f) => `<tr><td class="mono">${esc(f.name)}</td><td>${f.placeholderCount === 0 ? pill("Publish ready", "good") : pill(`Not ready: ${f.placeholderCount} left`, "warn")}</td><td>${f.samples.map((x) => `<span class="mono">${esc(x)}</span>`).join("<br>") || "-"}</td></tr>`);
    const policies = s.ops && s.ops.legal ? s.ops.legal.policies : [];
    const policyRows = policies.map((p) => `<tr><td class="mono">${esc(p.slug)}</td><td>${esc(p.title)}</td><td class="num">${p.publishedVersion ?? "-"}</td><td class="num">${num(p.statuses.PUBLISHED)}</td><td class="num">${num(p.statuses.IN_REVIEW)}</td><td class="num">${num(p.statuses.ARCHIVED)}</td><td class="num">${num(p.statuses.DRAFT)}</td></tr>`);
    el.innerHTML = viewHead("Legal drafts", "Bracketed placeholders still left in the Texas drafts, and policy versions in the app. Read only.") +
      `<section class="card"><h2 class="card-title">${esc(repo.legal.filesWithPlaceholders)} of ${esc(files.length)} draft files still have placeholders</h2>${table([{ label: "File" }, { label: "Publish ready" }, { label: "Examples" }], fileRows, "No legal files found.")}</section>` +
      `<section class="card"><h2 class="card-title">Policy versions in the app</h2>${table([{ label: "Policy" }, { label: "Title" }, { label: "Published", num: true }, { label: "Published", num: true }, { label: "In review", num: true }, { label: "Archived", num: true }, { label: "Draft", num: true }], policyRows, s.ops && s.ops.legal ? "No policies found." : "Waiting for the first database read.")}${errorLine(s.sources && s.sources.legal ? s.sources.legal.lastError : null)}</section>` +
      `<p class="card-foot">Folder ${esc(repo.legal.folder)}. A file is publish ready when it has no bracketed placeholders. Clearing them is not legal approval.</p>`;
  }

  /* Readiness */

  function renderReadiness() {
    const el = $("#view-readiness");
    const s = app.state;
    const ops = s && s.ops;
    if (!ops || !ops.readiness) {
      el.innerHTML = viewHead("Readiness", "Settings, email, health and disk space. Read only.") + `<section class="card">${loading("Waiting for the first readiness check.")}</section>`;
      return;
    }
    const r = ops.readiness;
    const email = ops.email;
    const ext = ops.external;
    const tiles = [
      tile({ label: "Ready to run", value: r.ready ? "Ready" : "Not ready", sub: r.ready ? "All required settings are present" : `${r.requiredMissing.length} required setting(s) missing`, tone: r.ready ? "good" : "bad" }),
      tile({ label: "Production mode", value: r.nodeEnvProduction ? "Yes" : "No", sub: "NODE_ENV is production", tone: r.nodeEnvProduction ? "good" : "warn" }),
      tile({ label: "Email webhook", value: r.emailWebhookEnabled ? "Enabled" : "Disabled", sub: r.emailWebhookEnabled ? "Delivery reports can arrive" : "Reports are off until the secret is set", tone: r.emailWebhookEnabled ? "good" : "warn" }),
      tile({ label: "Email test mode", value: r.emailTestMode === "on" ? "On" : r.emailTestMode === "off" ? "Off" : "Not set", sub: "EMAIL_TEST_MODE", tone: r.emailTestMode === "on" ? "warn" : "good" }),
      tile({ label: "Public site", value: ext && ext.publicHealth ? (ext.publicHealth.ok ? "Up" : "Down") : "Waiting", sub: ext && ext.publicHealth ? (ext.publicHealth.ok ? `${ext.publicHealth.latencyMs} ms` : ext.publicHealth.error) : "", tone: ext && ext.publicHealth ? (ext.publicHealth.ok ? "good" : "bad") : "" }),
    ].join("");

    const rows = r.checks.map((c) => {
      const absentTone = c.group === "required" ? "bad" : "warn";
      const note = c.key === "EMAIL_WEBHOOK_SECRET" && !c.present ? " (reports disabled)" : "";
      return `<tr class="${c.present || c.group !== "required" ? "" : "row-bad"}"><td class="mono">${esc(c.key)}</td><td>${pill(c.group === "required" ? "Required" : c.group === "optional" ? "Optional" : "Shown", c.group === "required" ? "" : "info")}</td><td>${c.present ? pill("Present", "good") : pill(`Not set${note}`, absentTone)}</td><td class="num">${c.present ? num(c.length) : "-"}</td><td class="mono">${esc(c.sources.join(", ") || "-")}</td></tr>`;
    });
    const checklist = table([{ label: "Setting" }, { label: "Kind" }, { label: "State" }, { label: "Length", num: true }, { label: "Found in" }], rows, "No settings checked.");
    const warnings = r.warnings.length
      ? `<ul class="action-list">${r.warnings.map((w) => `<li>${pill("Warning", "warn")} ${esc(w)}</li>`).join("")}</ul>`
      : `<p class="card-foot">No warnings.</p>`;

    const statusRows = email ? email.last24h.map((row) => `<tr><td>${pill(sentence(row.status), statusTone(row.status))}</td><td class="num">${num(row.n)}</td></tr>`) : [];
    const emailCard = email
      ? `<dl class="detail-grid"><dt>Failed sends (1 h)</dt><dd>${num(email.failedLastHour)}</dd><dt>Webhook</dt><dd>${email.webhookEnabled ? pill("Enabled", "good") : pill("Disabled", "warn")}</dd><dt>Test mode</dt><dd>${esc(email.testMode === "on" ? "On" : email.testMode === "off" ? "Off" : "Not set")}</dd><dt>Latest update</dt><dd>${esc(ago(email.latestUpdate))}</dd></dl>` + table([{ label: "Status (last 24 h)" }, { label: "Count", num: true }], statusRows, "No email in the last 24 hours.")
      : loading("Waiting for the first email read.");

    const disks = ext && ext.disks ? ext.disks.drives : [];
    const diskRows = disks.map((d) => d.error ? `<tr class="row-bad"><td class="mono">${esc(d.drive)}</td><td>${esc(d.uses.join(", "))}</td><td colspan="3">${esc(d.error)}</td></tr>` : `<tr><td class="mono">${esc(d.drive)}</td><td>${esc(d.uses.join(", "))}</td><td class="num">${d.freeGb.toFixed(1)} GB</td><td class="num">${d.totalGb.toFixed(1)} GB</td><td>${meter(d.usedPct)}</td></tr>`);
    const diskCard = table([{ label: "Drive" }, { label: "Holds" }, { label: "Free", num: true }, { label: "Total", num: true }, { label: "Used" }], diskRows, "Waiting for the disk check.");
    const publicCard = ext && ext.publicHealth
      ? `<dl class="detail-grid"><dt>Address</dt><dd class="mono">${esc(ext.publicHealth.url)}</dd><dt>Result</dt><dd>${ext.publicHealth.ok ? pill(`HTTP ${ext.publicHealth.status}`, "good") : pill(ext.publicHealth.error || "Down", "bad")}</dd><dt>Latency</dt><dd>${esc(ext.publicHealth.latencyMs)} ms</dd><dt>Checked</dt><dd>${esc(ago(ext.publicHealth.checkedAt))}</dd></dl>`
      : loading("Waiting for the public check.");

    el.innerHTML = viewHead("Readiness", "Settings present, email, public health and disk space. Values are never shown, only presence and length.") +
      `<div class="grid">${tiles}</div>` +
      `<section class="card"><h2 class="card-title">Warnings</h2>${warnings}</section>` +
      `<section class="card"><h2 class="card-title">Settings checklist</h2>${checklist}<p class="card-foot">Files read: ${r.files.map((f) => `${esc(f.label)} ${f.exists ? "found" : "not found"}`).join(", ")}. Checked ${esc(ago(r.checkedAt))}.</p></section>` +
      `<div class="two-col"><section class="card"><h2 class="card-title">Email</h2>${emailCard}</section>` +
      `<section class="card"><h2 class="card-title">Public site</h2>${publicCard}<div class="section-divider"></div><h3 class="card-title">Disk space</h3>${diskCard}${ext && ext.disks && !ext.disks.uploadsConfigured ? `<p class="card-foot">UPLOAD_DIR is not set, so only the repo drive is shown.</p>` : ""}</section></div>`;
  }

  /* Operations (write actions, each behind a confirmation) */

  const RESTART_APP_NAMES = ["nexusforge-backend-workspace", "nexusforge-web-workspace", "vexora-gateway", "vexora-tunnel", "vexora-watchdog"];
  const BUILD_LABELS = { web: "Web app build", backend: "Backend build" };
  const CHECK_LABELS = { "tsc-web": "TypeScript check, web app", "tsc-server": "TypeScript check, server", "tests-server": "Server tests (email, access token, forge images)" };
  const LOG_DOM_LIMIT = 2000;
  const opsState = { jobs: [], dryRun: false, selectedJob: null, follow: true, log: null, schemaFull: null, lastActionsAt: 0 };

  function buildOpsSkeleton() {
    const view = $("#view-operations");
    if (!view) return;
    view.innerHTML =
      viewHead("Operations", "Restart a service, build, run checks, and read the schema status. Every write needs your confirmation, streams its output live, and is written to the action log.") +
      `<div id="opsBanner"></div>` +
      `<div class="two-col">` +
      `<section class="card"><h2 class="card-title">Restart one service</h2><p class="card-foot">Runs pm2 restart with --update-env for one app, then checks its health. Type the app name to unlock the button.</p>` +
      `<form id="restartForm" class="stack"><div class="field"><label for="restartApp">App</label><select id="restartApp">${RESTART_APP_NAMES.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select></div>` +
      `<div class="field-row"><div class="field grow"><label for="restartTyped">Type the app name to confirm</label><input id="restartTyped" autocomplete="off" spellcheck="false"></div><button type="submit" class="btn btn-primary" id="restartBtn" disabled>Restart</button></div></form></section>` +
      `<section class="card"><h2 class="card-title">Builds</h2><p class="card-foot">A build rewrites the output folder. A running app keeps its current build until you restart it, as a separate step. Only one build of each kind runs at a time.</p>` +
      `<div class="field-row"><button type="button" class="btn" data-build="web">Build web app</button><button type="button" class="btn" data-build="backend">Build backend</button></div></section>` +
      `</div>` +
      `<div class="two-col">` +
      `<section class="card"><h2 class="card-title">Checks</h2><p class="card-foot">Type checks and the server tests. The full test suite is not run from here.</p>` +
      `<div class="field-row"><button type="button" class="btn" data-check="tsc-web">Type check: web</button><button type="button" class="btn" data-check="tsc-server">Type check: server</button><button type="button" class="btn" data-check="tests-server">Server tests</button></div></section>` +
      `<section class="card"><h2 class="card-title">Database schema</h2><p class="card-foot">Read only. Compares the schema file with the live database. Nothing is applied from here.</p>` +
      `<div class="field-row"><button type="button" class="btn" data-schema="1">Check schema status</button></div><div id="schemaResult"></div></section>` +
      `</div>` +
      `<div class="two-col"><section class="card"><h2 class="card-title">Jobs</h2><p class="card-foot">One job runs at a time. Others wait in the queue.</p><ul class="ticket-list" id="jobList" role="listbox" aria-label="Jobs"></ul></section>` +
      `<section class="card"><h2 class="card-title">Live output</h2><div id="jobHeader"></div>` +
      `<div class="field-row"><button type="button" class="btn" id="jobFollowBtn" aria-pressed="false">Stop scrolling</button><span class="muted" id="jobLineInfo"></span></div>` +
      `<div class="log-lines job-live" id="jobLogBox" tabindex="0" role="log" aria-live="off" aria-label="Live job output"></div></section></div>` +
      `<section class="card"><h2 class="card-title">Action log</h2><div id="opsActionLog"></div></section>`;
    wireOps();
  }

  function jobStateLabel(state) {
    return { queued: "Queued", running: "Running", stuck: "Stuck (not stopped)", passed: "Passed", failed: "Failed" }[state] || sentence(state);
  }

  function jobTone(state) {
    if (state === "passed") return "good";
    if (state === "failed") return "bad";
    if (state === "running" || state === "stuck") return "warn";
    return "info";
  }

  function renderOperations() {
    if (!$("#opsBanner")) return;
    const dry = opsState.dryRun || (app.state && app.state.ops && app.state.ops.dryRun);
    setHtml($("#opsBanner"), dry ? `<div class="error-line">Dry run is on: write actions print their command and do not run. Start the console without --dry-run for real actions.</div>` : "");
    renderJobs();
    renderJobHeader();
    renderSchemaResult();
    renderOpsLog();
    updateRestartButton();
  }

  function renderJobs() {
    const rows = opsState.jobs.map((j) => {
      const selected = j.id === opsState.selectedJob;
      const exit = j.exitCode !== null && j.exitCode !== undefined ? `<span>Exit ${esc(j.exitCode)}</span>` : "";
      return `<li><div class="ticket-row" role="option" tabindex="0" aria-selected="${selected}" data-job="${esc(j.id)}">` +
        `<div class="ticket-title">${esc(j.label)}</div>` +
        `<div class="ticket-pills">${pill(jobStateLabel(j.state), jobTone(j.state))}${j.dryRun ? pill("Dry run", "info") : ""}</div>` +
        `<div class="ticket-meta"><span>${esc(j.target || j.kind)}</span><span>Queued ${esc(clock(j.queuedAt))}</span>${j.startedAt ? `<span>Started ${esc(clock(j.startedAt))}</span>` : ""}${j.endedAt ? `<span>Ended ${esc(clock(j.endedAt))}</span>` : ""}${exit}</div>` +
        `</div></li>`;
    });
    setHtml($("#jobList"), rows.length ? rows.join("") : `<li><div class="empty">No jobs in this session yet.</div></li>`);
  }

  function summaryText(job) {
    const s = job.summary;
    if (!s) return "";
    if (job.kind === "check" && typeof s.errors === "number") return `${s.errors} TypeScript error(s)`;
    if (job.kind === "check" && typeof s.pass === "number") return `${num(s.pass)} passed, ${num(s.fail)} failed, ${num(s.tests)} tests`;
    if (job.kind === "restart") return `${s.text || ""}${s.healthy ? "" : " (not healthy within 60 s)"}`;
    if (job.kind === "build") return "";
    return "";
  }

  function elapsedMs(job) {
    const start = Date.parse(job.startedAt || job.queuedAt);
    const end = job.endedAt ? Date.parse(job.endedAt) : Date.now();
    return Number.isFinite(start) ? Math.max(0, end - start) : 0;
  }

  function formatElapsed(ms) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  /** Header of the live panel. Re-rendered on state changes only; the elapsed time is ticked separately. */
  function renderJobHeader() {
    const el = $("#jobHeader");
    if (!el) return;
    const job = opsState.jobs.find((j) => j.id === opsState.selectedJob);
    if (!job) {
      setHtml(el, `<div class="empty">Select a job to watch its output live.</div>`);
      $("#jobLineInfo").textContent = "";
      return;
    }
    const exit = job.exitCode === null || job.exitCode === undefined ? (job.state === "running" || job.state === "queued" || job.state === "stuck" ? "pending" : "none") : String(job.exitCode);
    const summary = summaryText(job);
    setHtml(el, `<h3 class="card-title">${esc(job.label)}</h3>` +
      `<div class="ticket-pills">${pill(jobStateLabel(job.state), jobTone(job.state))}${job.dryRun ? pill("Dry run: nothing ran", "info") : ""}</div>${job.queueNote ? `<p class="card-foot">${esc(job.queueNote)}</p>` : ""}` +
      `<dl class="detail-grid"><dt>Command</dt><dd class="mono">${esc(job.display)}</dd><dt>Started</dt><dd>${esc(dateTime(job.startedAt))}</dd><dt>Ended</dt><dd>${esc(dateTime(job.endedAt))}</dd><dt>Elapsed</dt><dd><span class="mono job-elapsed" data-started="${esc(job.startedAt || job.queuedAt)}" data-ended="${esc(job.endedAt || "")}">${formatElapsed(elapsedMs(job))}</span></dd><dt>Exit code</dt><dd class="mono">${esc(exit)}</dd>${summary ? `<dt>Result</dt><dd>${esc(summary)}</dd>` : ""}</dl>` +
      (job.error ? errorLine(job.error) : ""));
    $("#jobLineInfo").textContent = `${num(job.lineCount)} lines so far${job.lineCount > LOG_DOM_LIMIT ? `, showing the last ${num(LOG_DOM_LIMIT)}` : ""}.`;
  }

  function tickElapsed() {
    for (const node of document.querySelectorAll(".job-elapsed")) {
      const started = node.getAttribute("data-started");
      const ended = node.getAttribute("data-ended");
      const ms = (ended ? Date.parse(ended) : Date.now()) - Date.parse(started);
      if (Number.isFinite(ms)) node.textContent = formatElapsed(Math.max(0, ms));
    }
  }

  function lineHtml(line) {
    const cls = line.stream === "err" ? "ln-err" : line.stream === "cmd" ? "ln-cmd" : line.stream === "info" ? "ln-info" : "";
    return `<div class="ln ${cls}"><span class="ln-tag">${esc(line.stream)}</span>${esc(line.text)}</div>`;
  }

  function appendLogLine(line) {
    const box = $("#jobLogBox");
    if (!box) return;
    box.insertAdjacentHTML("beforeend", lineHtml(line));
    while (box.childElementCount > LOG_DOM_LIMIT) box.removeChild(box.firstElementChild);
    if (opsState.follow) box.scrollTop = box.scrollHeight;
  }

  function paintLog(lines) {
    const box = $("#jobLogBox");
    if (!box) return;
    box.innerHTML = lines.map(lineHtml).join("");
    if (opsState.follow) box.scrollTop = box.scrollHeight;
  }

  /** Selecting a job replays its buffer (up to 2,000 lines); live lines that arrive meanwhile are merged in by sequence number. */
  async function selectJob(id) {
    opsState.selectedJob = id;
    opsState.log = { jobId: id, seen: new Set(), lines: [] };
    paintLog([]);
    renderJobs();
    renderJobHeader();
    try {
      const full = await api("GET", `/api/jobs/${id}`);
      if (!opsState.log || opsState.log.jobId !== id) return;
      for (const line of full.lines || []) {
        if (!opsState.log.seen.has(line.seq)) {
          opsState.log.seen.add(line.seq);
          opsState.log.lines.push(line);
        }
      }
      opsState.log.lines.sort((a, b) => a.seq - b.seq);
      paintLog(opsState.log.lines.slice(-LOG_DOM_LIMIT));
      renderJobHeader();
    } catch (err) {
      toast(err.message, true);
    }
  }

  function onJoblog(line) {
    if (!opsState.log || line.jobId !== opsState.log.jobId || opsState.log.seen.has(line.seq)) return;
    opsState.log.seen.add(line.seq);
    opsState.log.lines.push(line);
    if (opsState.log.lines.length > LOG_DOM_LIMIT) opsState.log.lines.splice(0, opsState.log.lines.length - LOG_DOM_LIMIT);
    appendLogLine(line);
    const info = $("#jobLineInfo");
    if (info) info.textContent = `${num(line.seq)} lines so far.`;
  }

  function schemaStatusView(status) {
    const views = {
      in_sync: { label: "In sync", tone: "good" },
      additive: { label: "Additive (manual apply)", tone: "good" },
      not_additive: { label: "Review needed", tone: "warn" },
      destructive: { label: "Destructive: DROP found", tone: "bad" },
    };
    return views[status] || { label: "Not verified", tone: "warn" };
  }

  function renderSchemaResult() {
    const el = $("#schemaResult");
    if (!el) return;
    const latest = opsState.jobs.find((j) => j.kind === "schema" && (j.state === "passed" || j.state === "failed"));
    if (!latest) {
      setHtml(el, `<p class="card-foot">No schema check has run in this session.</p>`);
      return;
    }
    const full = opsState.schemaFull && opsState.schemaFull.id === latest.id ? opsState.schemaFull : null;
    const s = (full && full.summary) || latest.summary;
    if (!s || typeof s.statementCount !== "number") {
      setHtml(el, `<p class="card-foot">${esc(jobStateLabel(latest.state))}: ${esc(latest.error || "no summary")}</p>`);
      return;
    }
    // A failed run, a dry run, or an unreadable result is never shown as in sync, whatever the summary says.
    const view = schemaStatusView(latest.state === "failed" ? "unknown" : s.status);
    const notes = (s.notes || []).map((n) => `<li>${esc(n)}</li>`).join("");
    setHtml(el, `<div class="section-divider"></div><div class="ticket-pills">${pill(view.label, view.tone)}</div>` +
      `<p class="card-foot">${esc(s.verdict)}</p>` +
      `<dl class="detail-grid"><dt>Statements</dt><dd>${num(s.statementCount)}</dd><dt>CREATE</dt><dd>${num(s.creates)}</dd><dt>DROP</dt><dd>${num(s.drops)}</dd><dt>ALTER</dt><dd>${num(s.alters)} (${num(s.alterNotAdditive)} not additive)</dd><dt>Finished</dt><dd>${esc(dateTime(latest.endedAt))}</dd></dl>` +
      (notes ? `<ul class="action-list">${notes}</ul>` : "") +
      (full && full.summary && full.summary.sql ? `<h3 class="card-title">SQL</h3><pre class="quote mono">${esc(full.summary.sql)}</pre>` : latest.summary && latest.summary.hasSql ? `<button type="button" class="btn" data-load-schema="${esc(latest.id)}">Show the SQL</button>` : ""));
  }

  function renderOpsLog() {
    const el = $("#opsActionLog");
    if (!el) return;
    const rows = app.actions.slice(0, 80).map((a) => {
      const tone = a.result === "passed" ? "good" : a.result === "failed" || a.result === "rejected" ? "bad" : a.result === "dry run" ? "info" : "";
      return `<tr><td>${esc(dateTime(a.at))}</td><td class="mono">${esc(a.action)}</td><td class="mono">${esc(a.target || a.ticketId || "-")}</td><td>${a.result ? pill(a.result, tone) : "-"}</td><td>${esc(a.detail)}</td></tr>`;
    });
    setHtml(el, table([{ label: "Time" }, { label: "Action" }, { label: "Target" }, { label: "Result" }, { label: "Detail" }], rows, "No actions logged yet."));
  }

  function updateRestartButton() {
    const select = $("#restartApp");
    const typed = $("#restartTyped");
    const button = $("#restartBtn");
    if (!select || !typed || !button) return;
    button.disabled = typed.value !== select.value;
  }

  async function loadSchemaJob(id) {
    try {
      opsState.schemaFull = await api("GET", `/api/jobs/${id}`);
      renderSchemaResult();
    } catch (err) {
      toast(err.message, true);
    }
  }

  function askConfirm({ title, body, label, needCheckbox = false, checkboxLabel = "" }) {
    const dialog = $("#confirmDialog");
    $("#confirmTitle").textContent = title;
    $("#confirmBody").textContent = body;
    const boxWrap = $("#confirmCheckWrap");
    const box = $("#confirmCheck");
    boxWrap.hidden = !needCheckbox;
    $("#confirmCheckLabel").textContent = checkboxLabel;
    box.checked = false;
    const ok = $("#confirmOk");
    ok.textContent = label;
    ok.disabled = needCheckbox;
    box.onchange = () => {
      ok.disabled = !box.checked;
    };
    return new Promise((resolve) => {
      const onClose = () => {
        dialog.removeEventListener("close", onClose);
        resolve(dialog.returnValue === "confirm");
      };
      dialog.addEventListener("close", onClose);
      dialog.showModal();
    });
  }

  async function startJob(path, body, what) {
    try {
      const job = await api("POST", path, body);
      toast(job.state === "queued" ? `${what} queued. It runs after the job ahead of it.` : `${what} started.`);
      selectJob(job.id);
      return job;
    } catch (err) {
      toast(err.message, true);
      return null;
    }
  }

  function wireOps() {
    const view = $("#view-operations");
    view.addEventListener("click", async (event) => {
      const jobRow = event.target.closest("[data-job]");
      if (jobRow) {
        selectJob(jobRow.getAttribute("data-job"));
        return;
      }
      if (event.target.closest("#jobFollowBtn")) {
        opsState.follow = !opsState.follow;
        const button = $("#jobFollowBtn");
        button.setAttribute("aria-pressed", String(!opsState.follow));
        button.textContent = opsState.follow ? "Stop scrolling" : "Follow new lines";
        if (opsState.follow) {
          const box = $("#jobLogBox");
          box.scrollTop = box.scrollHeight;
        }
        return;
      }
      const showSql = event.target.closest("[data-load-schema]");
      if (showSql) {
        loadSchemaJob(showSql.getAttribute("data-load-schema"));
        return;
      }
      const build = event.target.closest("[data-build]");
      if (build) {
        const target = build.getAttribute("data-build");
        const ok = await askConfirm({
          title: `Build the ${BUILD_LABELS[target].toLowerCase()}?`,
          body: target === "web"
            ? "This runs npm run build for the web app, with the API and app URL variables removed from the build environment. It rewrites the web build folder. The running web app keeps serving its current build until you restart it, as a separate step."
            : "This runs npm run build for the server. It rewrites the server output folder. The running backend keeps its current build until you restart it, as a separate step.",
          label: "Start build",
          needCheckbox: true,
          checkboxLabel: "I understand the running app keeps its current build until I restart it separately.",
        });
        if (ok) startJob("/api/ops/build", { target, confirmed: true }, BUILD_LABELS[target]);
        return;
      }
      const check = event.target.closest("[data-check]");
      if (check) {
        const id = check.getAttribute("data-check");
        const ok = await askConfirm({
          title: `Run ${CHECK_LABELS[id]}?`,
          body: "This reads the code and runs the check. It does not change the app or its database.",
          label: "Run check",
        });
        if (ok) startJob("/api/ops/check", { check: id, confirmed: true }, CHECK_LABELS[id]);
        return;
      }
      if (event.target.closest("[data-schema]")) {
        opsState.schemaFull = null;
        startJob("/api/ops/schema", {}, "Schema check");
      }
    });
    view.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const jobRow = event.target.closest("[data-job]");
      if (!jobRow) return;
      event.preventDefault();
      selectJob(jobRow.getAttribute("data-job"));
    });
    $("#restartApp").addEventListener("change", () => {
      $("#restartTyped").value = "";
      updateRestartButton();
    });
    $("#restartTyped").addEventListener("input", updateRestartButton);
    $("#restartForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = $("#restartApp").value;
      const typed = $("#restartTyped").value;
      if (typed !== name) {
        toast("Type the app name exactly to confirm.", true);
        return;
      }
      const ok = await askConfirm({
        title: `Restart ${name}?`,
        body: "pm2 restarts this one app with --update-env. It is offline for a few seconds, then the health checks run. Nothing else is restarted.",
        label: "Restart app",
      });
      if (!ok) return;
      const job = await startJob("/api/ops/restart", { app: name, typed }, `Restart of ${name}`);
      if (job) $("#restartTyped").value = "";
      updateRestartButton();
    });
  }

  function onJobsEvent(payload) {
    const previous = new Map(opsState.jobs.map((j) => [j.id, j.state]));
    opsState.dryRun = Boolean(payload.dryRun);
    opsState.jobs = payload.jobs || [];
    let finished = false;
    for (const job of opsState.jobs) {
      const before = previous.get(job.id);
      if (before && before !== job.state && (job.state === "passed" || job.state === "failed")) {
        finished = true;
        if (job.kind === "schema") loadSchemaJob(job.id);
      }
    }
    if (finished && Date.now() - opsState.lastActionsAt > 1000) {
      opsState.lastActionsAt = Date.now();
      refreshActions();
    }
    if (app.view === "operations") renderOperations();
  }

  function startOpsTicker() {
    setInterval(tickElapsed, 1000);
  }

  /* Tickets */

  function kindLabel(ticket) {
    return KIND_LABELS[ticket.sourceKind] || sentence(ticket.sourceKind);
  }

  function tabItems(tab) {
    const list = [];
    for (const t of app.tickets.values()) {
      const kind = t.sourceKind;
      let keep = false;
      if (tab === "inbox") keep = t.status === "NEW" && kind !== "APPEAL";
      else if (tab === "bugs") keep = isOpen(t) && (kind === "ERROR_GROUP" || (kind === "PROBLEM" && t.category === "BUG"));
      else if (tab === "reports") keep = isOpen(t) && (kind === "MESSAGE_REPORT" || (kind === "PROBLEM" && t.category === "SAFETY"));
      else if (tab === "support") keep = isOpen(t) && kind === "SUPPORT";
      else if (tab === "appeals") keep = isOpen(t) && kind === "APPEAL";
      else if (tab === "bans") keep = kind === "SUSPENSION" || kind === "FORGE_BAN";
      else if (tab === "security") keep = isOpen(t) && ["SECURITY_LOG", "AUDIT_FAILURE", "MANUAL_INCIDENT"].includes(kind);
      else if (tab === "closed") keep = !isOpen(t);
      if (keep) list.push(t);
    }
    return list.sort((a, b) => {
      if (tab === "bans") return (Date.parse(b.firstSeenAt) || 0) - (Date.parse(a.firstSeenAt) || 0);
      const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (rank !== 0) return rank;
      return (Date.parse(a.firstSeenAt) || 0) - (Date.parse(b.firstSeenAt) || 0);
    });
  }

  function tabCount(tab) {
    if (tab === "bugs") return app.bugs.filter((b) => b.status !== "FIXED").length + tabItems("bugs").length;
    if (tab === "bans") return tabItems("bans").filter((t) => t.appStatus === "ACTIVE").length;
    return tabItems(tab).length;
  }

  function buildTicketsSkeleton() {
    const view = $("#view-tickets");
    view.innerHTML =
      viewHead("Tickets", "Triage reports, support, appeals, bans, security events and known bugs. Ticket actions are saved only in the console's own store.") +
      `<div class="tabs" id="ticketTabs" role="tablist" aria-label="Ticket groups"></div>` +
      `<div class="tickets-layout">` +
      `<section class="card" aria-label="Ticket list"><div id="bugNewWrap"></div><ul class="ticket-list" id="ticketList" role="listbox" aria-label="Tickets"></ul></section>` +
      `<section class="card" id="ticketPane" aria-live="polite"><div id="ticketInfo"></div><div id="ticketForm"></div></section>` +
      `</div>` +
      `<section class="card"><h2 class="card-title">Action log</h2><ul class="action-list" id="actionLog"></ul></section>`;
    renderTabs();
  }

  // Skips the DOM write when the HTML has not changed, so keyboard focus survives the live updates.
  function setHtml(el, html) {
    if (!el || el.__html === html) return;
    el.__html = html;
    el.innerHTML = html;
  }

  function renderTabs() {
    const wrap = $("#ticketTabs");
    if (!wrap) return;
    setHtml(wrap, TABS.map((tab) => {
      const count = tabCount(tab.key);
      const hot = tab.key === "reports" || tab.key === "appeals" || tab.key === "inbox" ? count > 0 && (tab.key !== "reports" || tabItems("reports").some((t) => t.severity === "CRITICAL")) : false;
      return `<button type="button" class="tab" role="tab" aria-selected="${app.tab === tab.key}" data-tab="${tab.key}">${esc(tab.label)} <span class="tab-count${hot ? " hot" : ""}">${num(count)}</span></button>`;
    }).join(""));
    const railCount = $("#railTickets");
    const inbox = inboxCount();
    railCount.textContent = inbox > 0 ? String(inbox) : "";
  }

  function ticketRow(t) {
    const selected = app.selection && app.selection.type === "ticket" && app.selection.id === t.id;
    const bug = t.linkedBugId ? `<span>Bug #${esc(t.linkedBugId)}</span>` : "";
    return `<li><div class="ticket-row${t.severity === "CRITICAL" ? " critical" : ""}" role="option" tabindex="0" aria-selected="${selected}" data-select="ticket" data-id="${t.id}">` +
      `<div class="ticket-title">${esc(t.title)}</div>` +
      `<div class="ticket-pills">${pill(sentence(t.severity), severityTone(t.severity))}${pill(sentence(t.status), statusTone(t.status))}</div>` +
      `<div class="ticket-meta"><span>#${esc(t.id)}</span><span>${esc(kindLabel(t))}</span><span>Open for ${esc(ageText(t.firstSeenAt))}</span>${bug}${t.appStatus ? `<span>App: ${esc(sentence(t.appStatus))}</span>` : ""}</div>` +
      `</div></li>`;
  }

  function bugRow(bug) {
    const selected = app.selection && app.selection.type === "bug" && app.selection.id === bug.id;
    return `<li><div class="ticket-row" role="option" tabindex="0" aria-selected="${selected}" data-select="bug" data-id="${bug.id}">` +
      `<div class="ticket-title">Bug #${esc(bug.id)}: ${esc(bug.title)}</div>` +
      `<div class="ticket-pills">${pill(sentence(bug.status), bug.status === "FIXED" ? "good" : bug.status === "FIXING" ? "warn" : "info")}${bug.autoCreated ? pill("Automatic", "") : ""}</div>` +
      `<div class="ticket-meta"><span>${esc(bug.linkedCount)} linked</span><span>Updated ${esc(ago(bug.updatedAt))}</span>${bug.fixedIn ? `<span>Fixed in ${esc(bug.fixedIn)}</span>` : ""}</div>` +
      `</div></li>`;
  }

  function renderTicketList() {
    const list = $("#ticketList");
    if (!list) return;
    renderTabs();
    const bugNew = $("#bugNewWrap");
    if (bugNew) {
      bugNew.innerHTML = app.tab === "bugs"
        ? `<form id="bugNewForm" class="field-row"><div class="field grow"><label for="newBugTitle">New bug</label><input id="newBugTitle" maxlength="200" placeholder="Short description" autocomplete="off"></div><button type="submit" class="btn btn-primary">Create bug</button></form><div class="section-divider"></div>`
        : "";
    }
    const items = tabItems(app.tab);
    const bugRows = app.tab === "bugs" ? app.bugs.filter((b) => b.status !== "FIXED").map(bugRow) : [];
    const ticketRows = items.map(ticketRow);
    const rows = bugRows.concat(ticketRows);
    setHtml(list, rows.length ? rows.join("") : `<li><div class="empty">Nothing in this group.</div></li>`);
  }

  function fieldOptions(values, current) {
    return values.map((v) => `<option value="${esc(v)}"${v === current ? " selected" : ""}>${esc(sentence(v))}</option>`).join("");
  }

  function renderTicketInfo() {
    const el = $("#ticketInfo");
    const sel = app.selection;
    if (!sel) {
      el.innerHTML = `<div class="empty">Select a ticket or bug to see its details.</div>`;
      return;
    }
    if (sel.type === "bug") {
      const bug = app.bugs.find((b) => b.id === sel.id);
      if (!bug) {
        el.innerHTML = `<div class="empty">This bug is no longer listed.</div>`;
        return;
      }
      const linked = [...app.tickets.values()].filter((t) => t.linkedBugId === bug.id);
      el.innerHTML = `<h2 class="card-title">Bug #${esc(bug.id)}: ${esc(bug.title)}</h2>` +
        `<dl class="detail-grid"><dt>Status</dt><dd>${pill(sentence(bug.status), bug.status === "FIXED" ? "good" : "info")}</dd><dt>Created</dt><dd>${esc(dateTime(bug.createdAt))}</dd><dt>Updated</dt><dd>${esc(dateTime(bug.updatedAt))}</dd><dt>Origin</dt><dd>${bug.autoCreated ? "Automatic from an error group" : "Owner"}</dd><dt>Fixed in</dt><dd>${esc(bug.fixedIn || "Not set")}</dd></dl>` +
        `<h3 class="card-title">Linked tickets (${linked.length})</h3>` +
        (linked.length ? `<ul class="action-list">${linked.map((t) => `<li>#${esc(t.id)} ${esc(t.title)}</li>`).join("")}</ul>` : `<div class="muted">No tickets are linked yet.</div>`);
      return;
    }
    const t = app.tickets.get(sel.id);
    if (!t) {
      el.innerHTML = `<div class="empty">This ticket is no longer in the list.</div>`;
      return;
    }
    const d = app.detail && app.detail.id === t.id ? app.detail.detail : null;
    const appeal = d && d.suspension
      ? `<div class="appeal-box"><strong>Appeal from a suspended account.</strong><br>Suspension reason: ${esc(d.suspension.reason || "not given")}<br>Started: ${esc(dateTime(d.suspension.startedAt))}. ${d.suspension.until ? `Until: ${esc(dateTime(d.suspension.until))}.` : "No end date (until lifted)."}</div>`
      : "";
    const body = d ? detailBody(t, d) : loading("Loading details.");
    const actions = app.detail && app.detail.actions ? app.detail.actions.map((a) => `<li>${esc(dateTime(a.at))}: ${esc(a.action)} ${esc(a.detail || "")}${a.actor ? ` (by ${esc(a.actor)})` : ""}</li>`).join("") : "";
    el.innerHTML = `<h2 class="card-title">#${esc(t.id)} ${esc(t.title)}</h2>` +
      `<div class="ticket-pills">${pill(sentence(t.severity), severityTone(t.severity))}${pill(sentence(t.status), statusTone(t.status))}${t.appStatus ? pill(`App: ${sentence(t.appStatus)}`, "info") : ""}</div>` +
      `<dl class="detail-grid"><dt>Type</dt><dd>${esc(kindLabel(t))}</dd><dt>Source</dt><dd class="mono">${esc(t.originTable)} ${esc(t.sourceRef)}</dd><dt>Created</dt><dd>${esc(dateTime(t.createdAt))}</dd><dt>First seen</dt><dd>${esc(dateTime(t.firstSeenAt))} (${esc(ageText(t.firstSeenAt))} ago)</dd><dt>Category</dt><dd>${esc(t.category || "-")}</dd></dl>` +
      appeal + body +
      (actions ? `<div class="section-divider"></div><h3 class="card-title">Actions on this ticket</h3><ul class="action-list">${actions}</ul>` : "");
    const adminLink = d && d.adminLink ? d.adminLink : null;
    if (adminLink) {
      el.innerHTML += `<div class="field-row"><a class="btn" href="${esc(adminLink)}" target="_blank" rel="noopener noreferrer">Open in the app admin</a></div>`;
    }
    if (t.linkedBugId) {
      const bug = app.bugs.find((b) => b.id === t.linkedBugId);
      el.innerHTML += `<p class="card-foot">Linked to bug #${esc(t.linkedBugId)}${bug ? `: ${esc(bug.title)}` : ""}.</p>`;
    }
  }

  function detailBody(t, d) {
    const parts = [];
    if (d.message) parts.push(`<h3 class="card-title">Report</h3><div class="quote">${esc(d.message)}</div>`);
    if (d.content) parts.push(`<h3 class="card-title">Reported content</h3><div class="quote">${esc(d.content)}</div>`);
    if (d.line) parts.push(`<h3 class="card-title">Log line (redacted)</h3><div class="quote mono">${esc(d.line)}</div>`);
    if (d.error) parts.push(`<h3 class="card-title">Error</h3><div class="quote">${esc(d.error)}</div>`);
    if (d.messages && d.messages.length) {
      parts.push(`<h3 class="card-title">Latest messages</h3><ul class="action-list">${d.messages.map((m) => `<li><strong>${m.fromStaff ? "Staff" : "Player"}</strong> ${esc(dateTime(m.createdAt))}: ${esc(m.body)}</li>`).join("")}</ul>`);
    }
    const fields = [
      ["Username", d.username || d.authorUsername],
      ["Contact email", d.contactEmail],
      ["Page", d.pageUrl],
      ["Browser", d.userAgent],
      ["User id", d.userId],
      ["Reporter id", d.reporterId],
      ["Forge id", d.forgeId],
      ["Channel id", d.channelId],
      ["Reason", d.reason],
      ["Details", d.details],
      ["Forge", d.forgeName],
      ["Until", d.until ? dateTime(d.until) : null],
      ["Lifted", d.liftedAt ? dateTime(d.liftedAt) : null],
      ["Lift note", d.liftNote],
      ["Operation", d.operation],
      ["Resource", d.resourceType ? `${d.resourceType} ${d.resourceId || ""}` : null],
      ["Endpoint", d.endpoint ? `${d.method || ""} ${d.endpoint}` : null],
      ["IP address", d.ipAddress],
      ["Fingerprint", d.fingerprint],
      ["Occurrences", d.count],
      ["Path", d.path],
      ["App record", d.appRecordId],
    ].filter(([, value]) => value !== null && value !== undefined && value !== "");
    const grid = fields.length ? `<dl class="detail-grid">${fields.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : "";
    return parts.join("") + grid;
  }

  function renderTicketForms() {
    const el = $("#ticketForm");
    const sel = app.selection;
    if (!sel) {
      el.innerHTML = "";
      return;
    }
    if (sel.type === "bug") {
      const bug = app.bugs.find((b) => b.id === sel.id);
      if (!bug) {
        el.innerHTML = "";
        return;
      }
      el.innerHTML = `<div class="section-divider"></div><form id="bugForm" class="stack">` +
        `<div class="field-row"><div class="field"><label for="fBugStatus">Status</label><select id="fBugStatus">${fieldOptions(BUG_STATUSES, bug.status)}</select></div>` +
        `<div class="field grow"><label for="fBugFixed">Fixed in (release)</label><input id="fBugFixed" maxlength="200" value="${esc(bug.fixedIn)}" placeholder="for example 1.0.15"></div></div>` +
        `<div class="field"><label for="fBugNotes">Notes</label><textarea id="fBugNotes" maxlength="2000">${esc(bug.notes)}</textarea></div>` +
        `<div class="field-row"><button type="submit" class="btn btn-primary">Save bug</button></div></form>`;
      return;
    }
    const t = app.tickets.get(sel.id);
    if (!t) {
      el.innerHTML = "";
      return;
    }
    const bugOptions = app.bugs.map((b) => `<option value="${b.id}"${t.linkedBugId === b.id ? " selected" : ""}>#${b.id} ${esc(b.title)}</option>`).join("");
    el.innerHTML = `<div class="section-divider"></div>` +
      `<form id="triageForm" class="stack"><div class="field-row">` +
      `<div class="field"><label for="fStatus">Status</label><select id="fStatus">${fieldOptions(TICKET_STATUSES, t.status)}</select></div>` +
      `<div class="field"><label for="fSeverity">Severity</label><select id="fSeverity">${fieldOptions(SEVERITIES, t.severity)}</select></div>` +
      `<div class="field grow"><label for="fCategory">Category</label><input id="fCategory" maxlength="80" value="${esc(t.category || "")}"></div>` +
      `<button type="submit" class="btn btn-primary">Save triage</button></div></form>` +
      `<form id="noteForm" class="stack"><div class="field"><label for="fNote">Owner note</label><textarea id="fNote" maxlength="4000">${esc(t.ownerNote)}</textarea></div><div class="field-row"><button type="submit" class="btn">Save note</button></div></form>` +
      `<form id="linkForm" class="stack"><div class="field-row"><div class="field grow"><label for="fBug">Link to a known bug</label><select id="fBug"><option value="">No bug</option>${bugOptions}</select></div><button type="submit" class="btn">Save link</button></div></form>` +
      `<div class="field-row"><div class="field grow"><label for="fNewBug">Or create a bug from this ticket</label><input id="fNewBug" maxlength="200" placeholder="Bug title" autocomplete="off"></div><button type="button" class="btn" id="createBugFromTicket">Create and link</button></div>` +
      `<div class="section-divider"></div>` +
      `<p class="card-foot">Replies, bans and dismissals happen in the app. This console does not change them.</p>`;
  }

  function renderActionLog() {
    const list = $("#actionLog");
    if (!list) return;
    const rows = app.actions.slice(0, 60).map((a) => `<li>${esc(dateTime(a.at))}: ${esc(a.action)}${a.ticketId ? ` on #${esc(a.ticketId)}` : ""}${a.bugId ? ` on bug #${esc(a.bugId)}` : ""}. ${esc(a.detail)}${a.actor ? ` (by ${esc(a.actor)})` : ""}</li>`);
    setHtml(list, rows.length ? rows.join("") : `<li>No actions yet.</li>`);
  }

  function renderTickets() {
    if (!$("#ticketTabs")) buildTicketsSkeleton();
    renderTicketList();
    renderTicketInfo();
    renderActionLog();
  }

  async function api(method, url, body) {
    const headers = { "X-Owner-Console": "1" };
    const init = { method, headers, credentials: "same-origin" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const res = await fetch(url, init);
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  function toast(message, bad = false) {
    const node = document.createElement("div");
    node.className = `toast${bad ? " bad" : ""}`;
    node.setAttribute("role", "status");
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 4000);
  }

  async function loadDetail(id) {
    try {
      const detail = await api("GET", `/api/tickets/${id}`);
      if (app.selection && app.selection.type === "ticket" && app.selection.id === id) {
        app.detail = detail;
        renderTicketInfo();
      }
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function refreshBugs() {
    try {
      const data = await api("GET", "/api/bugs");
      app.bugs = data.bugs;
    } catch {
      // Keep the last list; the next refresh tries again.
    }
  }

  async function refreshActions() {
    try {
      const data = await api("GET", "/api/actions");
      app.actions = data.actions;
      renderActionLog();
      if (app.view === "operations") renderOpsLog();
    } catch {
      // Keep the last list.
    }
  }

  function selectItem(type, id) {
    app.selection = { type, id };
    app.detail = null;
    renderTicketList();
    renderTicketInfo();
    renderTicketForms();
    if (type === "ticket") loadDetail(id);
  }

  function mergeTickets(list) {
    for (const incoming of list) {
      const current = app.tickets.get(incoming.id);
      if (!current || incoming.seq >= current.seq) app.tickets.set(incoming.id, incoming);
    }
    renderTabs();
    if (app.view === "tickets") renderTicketList();
    if (app.selection && app.selection.type === "ticket" && list.some((t) => t.id === app.selection.id)) {
      loadDetail(app.selection.id);
    }
  }

  async function triageSave() {
    const id = app.selection && app.selection.id;
    if (!id) return;
    try {
      const updated = await api("POST", `/api/tickets/${id}/triage`, {
        status: $("#fStatus").value,
        severity: $("#fSeverity").value,
        category: $("#fCategory").value.trim() || null,
      });
      app.tickets.set(updated.id, updated);
      toast("Triage saved.");
      renderTicketList();
      refreshActions();
      loadDetail(id);
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function noteSave() {
    const id = app.selection && app.selection.id;
    if (!id) return;
    try {
      const updated = await api("POST", `/api/tickets/${id}/note`, { note: $("#fNote").value });
      app.tickets.set(updated.id, updated);
      toast("Note saved.");
      refreshActions();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function linkSave(body) {
    const id = app.selection && app.selection.id;
    if (!id) return;
    try {
      const updated = await api("POST", `/api/tickets/${id}/link-bug`, body);
      app.tickets.set(updated.id, updated);
      await refreshBugs();
      toast("Link saved.");
      renderTicketList();
      refreshActions();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function bugSave() {
    const id = app.selection && app.selection.id;
    if (!id) return;
    try {
      await api("POST", `/api/bugs/${id}`, {
        status: $("#fBugStatus").value,
        fixedIn: $("#fBugFixed").value.trim(),
        notes: $("#fBugNotes").value,
      });
      await refreshBugs();
      toast("Bug saved.");
      renderTicketList();
      renderTicketInfo();
      refreshActions();
    } catch (err) {
      toast(err.message, true);
    }
  }

  function wireTickets() {
    const view = $("#view-tickets");
    view.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-tab]");
      if (tab) {
        app.tab = tab.getAttribute("data-tab");
        if (app.selection && app.selection.type === "ticket") {
          const t = app.tickets.get(app.selection.id);
          if (!t || !tabItems(app.tab).some((x) => x.id === t.id)) {
            app.selection = null;
            app.detail = null;
          }
        }
        renderTicketList();
        renderTicketInfo();
        renderTicketForms();
        return;
      }
      const row = event.target.closest("[data-select]");
      if (row) selectItem(row.getAttribute("data-select"), Number(row.getAttribute("data-id")));
    });
    view.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const row = event.target.closest("[data-select]");
      if (!row) return;
      event.preventDefault();
      selectItem(row.getAttribute("data-select"), Number(row.getAttribute("data-id")));
    });
    view.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.target;
      if (form.id === "triageForm") return triageSave();
      if (form.id === "noteForm") return noteSave();
      if (form.id === "linkForm") {
        const value = $("#fBug").value;
        if (!value) return toast("Pick a bug to link, or create one below.", true);
        return linkSave({ bugId: Number(value) });
      }
      if (form.id === "bugForm") return bugSave();
      if (form.id === "bugNewForm") {
        const title = $("#newBugTitle").value.trim();
        if (!title) return toast("Enter a bug title first.", true);
        try {
          await api("POST", "/api/bugs", { title });
          $("#newBugTitle").value = "";
          await refreshBugs();
          toast("Bug created.");
          renderTicketList();
          refreshActions();
        } catch (err) {
          toast(err.message, true);
        }
      }
    });
    view.addEventListener("click", async (event) => {
      if (event.target.id !== "createBugFromTicket") return;
      const id = app.selection && app.selection.id;
      const title = $("#fNewBug").value.trim();
      if (!id || !title) return toast("Enter a bug title first.", true);
      await linkSave({ bugId: 0, newBugTitle: title });
    });
  }

  /* Live connection */

  function setLive(state) {
    app.liveState = state;
    const dot = $("#liveDot");
    const text = $("#liveText");
    const map = {
      connecting: ["", "Connecting"],
      live: ["live", "Live"],
      stale: ["stale", "Stale, no update for a while"],
      reconnecting: ["stale", "Reconnecting"],
      closed: ["down", "Session closed. Reopen the link from the console window."],
    };
    const [cls, label] = map[state] || map.connecting;
    dot.className = `dot ${cls}`.trim();
    text.textContent = label;
  }

  function connect() {
    if (app.es) app.es.close();
    const es = new EventSource(app.all ? "/api/stream?all=1" : "/api/stream");
    app.es = es;
    es.onopen = () => setLive("live");
    es.onerror = () => setLive(es.readyState === 2 ? "closed" : "reconnecting");
    es.addEventListener("state", (event) => {
      app.state = JSON.parse(event.data);
      app.lastStateAt = Date.now();
      setLive("live");
      renderTop();
      renderActive();
    });
    es.addEventListener("logs", (event) => {
      app.logs = JSON.parse(event.data);
      if (app.view === "logs") renderLogLines();
    });
    es.addEventListener("jobs", (event) => {
      onJobsEvent(JSON.parse(event.data));
    });
    es.addEventListener("joblog", (event) => {
      onJoblog(JSON.parse(event.data));
    });
    es.addEventListener("tickets", (event) => {
      mergeTickets(JSON.parse(event.data));
    });
  }

  function renderTop() {
    const s = app.state;
    const chips = [];
    if (s) {
      const sum = s.summary;
      chips.push(chip(`API ${sum.healthUp} of ${sum.healthTotal} up${sum.healthLimited ? `, ${sum.healthLimited} rate limited` : ""}`, sum.healthUp === sum.healthTotal ? "good" : sum.healthLimited ? "warn" : "bad"));
      chips.push(chip(`pm2 ${sum.nexusOnline} of ${sum.nexusTotal} online`, sum.nexusOnline === sum.nexusTotal ? "good" : "bad"));
      chips.push(chip(`Database ${sum.dbState === "ok" ? "connected" : sum.dbState === "error" ? "error" : "waiting"}`, sum.dbState === "ok" ? "good" : sum.dbState === "error" ? "bad" : "warn"));
    }
    const inbox = inboxCount();
    chips.push(chip(`Inbox ${num(inbox)}`, inbox > 0 ? "warn" : "good"));
    const critical = criticalOpenCount();
    if (critical > 0) chips.push(chip(`Critical ${num(critical)}`, "bad"));
    $("#chips").innerHTML = chips.join("");
    $("#updated").textContent = s ? `Updated ${ago(s.generatedAt)}` : "Waiting for data";
    renderTabs();
    renderErrorBar();
  }

  function chip(text, tone) {
    return `<span class="pill pill-${tone}">${esc(text)}</span>`;
  }

  /* Finance: the owner's money view. Read only from the app database, plus this console's own expense records.
     Shown in this console only, never on the website. Every figure comes from a stored record; nothing is estimated.
     Helpers are prefixed fin so they cannot clash with the rest of this script. */

  // Must match CATEGORIES in lib/expenses.js.
  const FIN_CATEGORIES = [
    ["HOSTING", "Hosting and infrastructure"],
    ["SOFTWARE", "Software and subscriptions"],
    ["MARKETING", "Marketing"],
    ["CONTRACTORS", "Contractors and development"],
    ["PROCESSING_FEES", "Payment processing fees (only with a statement reference)"],
    ["REFUNDS_CHARGEBACKS", "Chargeback and dispute costs (not refund amounts)"],
    ["OTHER", "Other business expenses"],
  ];
  const FIN_PERIODS = [
    ["today", "Today"],
    ["week", "This week"],
    ["month", "This month"],
    ["quarter", "This quarter"],
    ["year", "This year"],
    ["last30", "Last 30 days"],
    ["all", "All time"],
    ["custom", "Custom"],
  ];
  const FIN_STATUSES = ["", "SUCCEEDED", "REFUNDED", "PENDING", "FAILED"];
  const FIN_PAGE = 25;
  const FIN_STALE_MS = 2 * 60 * 1000;
  const FIN_REFRESH_MS = 60 * 1000;

  const finState = {
    preset: "month",
    from: "",
    to: "",
    ledgerQ: "",
    ledgerStatus: "",
    ledgerOffset: 0,
    showVoided: false,
    editId: null,
    fetching: false,
    error: null,
    lastGood: 0,
    lastAttempt: 0,
  };
  let finAll = null; // /api/finance: all-time figures
  let finReport = null; // /api/finance/report: the chosen period
  let finExpenses = null; // /api/finance/expenses: the chosen period
  let finLedger = null; // /api/finance/ledger: the chosen period, search and page

  /** Money in cents as dollars, with a leading minus for negatives. */
  function finMoney(cents) {
    const n = Number(cents || 0);
    return `${n < 0 ? "-" : ""}$${(Math.abs(n) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function finField(form, name) {
    return form.elements.namedItem(name);
  }

  function finPeriodQuery() {
    const params = new URLSearchParams({ preset: finState.preset });
    if (finState.preset === "custom") {
      params.set("from", finState.from);
      params.set("to", finState.to);
    }
    return params.toString();
  }

  function finSlot(name, html) {
    const node = $("#view-finance").querySelector(`[data-fin-slot="${name}"]`);
    if (node) node.innerHTML = html;
  }

  async function refreshFinance() {
    if (finState.fetching) return;
    finState.fetching = true;
    const period = finPeriodQuery();
    const ledgerParams = new URLSearchParams({ q: finState.ledgerQ, status: finState.ledgerStatus, offset: String(finState.ledgerOffset), limit: String(FIN_PAGE) });
    try {
      const [all, report, expenses, ledger] = await Promise.all([
        api("GET", "/api/finance"),
        api("GET", `/api/finance/report?${period}`),
        api("GET", `/api/finance/expenses?${period}&includeVoided=${finState.showVoided ? 1 : 0}`),
        api("GET", `/api/finance/ledger?${period}&${ledgerParams}`),
      ]);
      finAll = all;
      finReport = report;
      finExpenses = expenses;
      finLedger = ledger;
      finState.error = null;
      finState.lastGood = Date.now();
    } catch (err) {
      finState.error = err.message;
    } finally {
      finState.fetching = false;
      finState.lastAttempt = Date.now();
    }
    if (app.view === "finance") renderFinance();
  }

  function buildFinanceSkeleton(el) {
    // The owner's local day, so an expense entered in the evening is dated today, not tomorrow in UTC.
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const categories = FIN_CATEGORIES.map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join("");
    const statuses = FIN_STATUSES.map((value) => `<option value="${value}"${value === finState.ledgerStatus ? " selected" : ""}>${esc(value ? sentence(value) : "Any status")}</option>`).join("");
    el.innerHTML =
      viewHead("Finance", "Money, memberships and expenses. Read from the app database and this console's own records. Shown in this console only, never on the website.") +
      `<div id="finSkeleton" class="stack">` +
      `<div data-fin-slot="connection"></div>` +
      `<div data-fin-slot="period"></div>` +
      `<form id="finCustomForm" class="field-row"><div class="field"><label for="finFrom">From (UTC day)</label><input id="finFrom" type="date" name="from" value="${esc(finState.from)}"></div>` +
      `<div class="field"><label for="finTo">To (UTC day)</label><input id="finTo" type="date" name="to" value="${esc(finState.to)}"></div><button type="submit" class="btn">Show custom period</button></form>` +
      `<div data-fin-slot="profit"></div>` +
      `<div class="two-col">` +
      `<section class="card"><h2 class="card-title" id="finExpenseTitle">Add an expense</h2>` +
      `<form id="finExpenseForm" class="stack">` +
      `<div class="field-row"><div class="field"><label for="finAmount">Amount</label><input id="finAmount" name="amount" inputmode="decimal" placeholder="12.34" maxlength="13" required></div>` +
      `<div class="field"><label for="finExpDate">Date</label><input id="finExpDate" name="date" type="date" value="${today}" required></div>` +
      `<div class="field"><label for="finCurrency">Currency</label><input id="finCurrency" name="currency" value="USD" maxlength="3" autocomplete="off"></div></div>` +
      `<div class="field"><label for="finCategory">Category</label><select id="finCategory" name="category" required>${categories}</select></div>` +
      `<div class="field"><label for="finDesc">Description</label><input id="finDesc" name="description" maxlength="200" placeholder="What it was for" required></div>` +
      `<div class="field"><label for="finRef">Reference (optional)</label><input id="finRef" name="reference" maxlength="200" placeholder="Invoice or statement number"></div>` +
      `<div class="field-row"><button type="submit" class="btn btn-primary" id="finSaveBtn">Save expense</button><button type="button" class="btn" id="finCancelEdit" data-fin-cancel hidden>Cancel edit</button></div>` +
      `<p class="error-line" id="finExpenseMsg" role="status"></p>` +
      `<p class="card-foot">Expenses are stored only in this console, not in the app database. Stripe refunds and lost disputes are already in revenue, so enter only the fees and costs that go with them. Expenses are never deleted: a mistake is voided and the reason stays on record.</p>` +
      `</form></section>` +
      `<section class="card"><h2 class="card-title">Expenses in this period</h2><div data-fin-slot="expenses"></div>` +
      `<label class="field-row"><input type="checkbox" id="finShowVoided"${finState.showVoided ? " checked" : ""}> Show voided expenses</label></section>` +
      `</div>` +
      `<div data-fin-slot="report"></div>` +
      `<section class="card"><h2 class="card-title">Payments in this period</h2>` +
      `<form id="finLedgerForm" class="field-row"><div class="field grow"><label for="finSearch">Search by member name</label><input id="finSearch" name="q" maxlength="64" value="${esc(finState.ledgerQ)}" autocomplete="off"></div>` +
      `<div class="field"><label for="finStatus">Status</label><select id="finStatus" name="status">${statuses}</select></div><button type="submit" class="btn">Search</button></form>` +
      `<div data-fin-slot="ledger"></div></section>` +
      `<div data-fin-slot="alltime"></div>` +
      `</div>`;
  }

  function finConnection() {
    if (!finReport && !finState.error) return "";
    const readAt = finReport ? new Date(finReport.generatedAt).toLocaleString("en-GB", { hour12: false }) : "never";
    const stale = finState.error || Date.now() - finState.lastGood > FIN_STALE_MS;
    if (stale) return `<p class="error-line">Stale: the figures below are from ${esc(readAt)} and may be out of date.${finState.error ? ` (${esc(finState.error)})` : ""}</p>`;
    return `<p class="card-foot">Current. Last read ${esc(readAt)}. Refreshes every 30 seconds while this view is open.</p>`;
  }

  function finPeriodBar() {
    const label = finReport ? `Showing ${finReport.range.from} to ${finReport.range.to} (UTC days). Payments are counted by the time Stripe recorded them.` : "";
    return (
      `<div class="field-row" role="group" aria-label="Period">` +
      FIN_PERIODS.map(([key, text]) => `<button type="button" class="btn${finState.preset === key ? " btn-primary" : ""}" data-fin-period="${key}" aria-pressed="${finState.preset === key}">${esc(text)}</button>`).join("") +
      `</div><p class="card-foot">${esc(label)}</p>`
    );
  }

  function finProfit() {
    const p = finReport.profit;
    const rows = [
      ["Gross sales (live payments)", finMoney(p.grossSalesCents)],
      ["Refunds (recorded by Stripe)", finMoney(-p.refundsCents)],
      ["Lost disputes (recorded by Stripe)", finMoney(-p.disputeLostCents)],
      ["Net collected revenue", finMoney(p.netCollectedCents), true],
      ["Payment processing fees (entered)", p.processingFeesCents === null ? "Not entered" : finMoney(-p.processingFeesCents)],
      ["Operating expenses (entered)", finMoney(-p.operatingExpensesCents)],
      ["Chargeback and dispute costs (entered)", finMoney(-p.disputeCostsCents)],
      [p.label, finMoney(p.operatingProfitCents), true],
    ].map(([label, value, strong]) => `<tr><td>${strong ? `<strong>${esc(label)}</strong>` : esc(label)}</td><td class="num">${strong ? `<strong>${esc(value)}</strong>` : esc(value)}</td></tr>`);
    return (
      `<section class="card"><h2 class="card-title">Profit for this period</h2>` +
      table([{ label: "Line" }, { label: "Amount", num: true }], rows) +
      `<p class="card-foot">Net collected revenue is not profit: operating costs come off it. The result is only as complete as the expenses entered.</p>` +
      `<ul class="muted">${p.gaps.map((gap) => `<li>${esc(gap)}</li>`).join("")}</ul></section>`
    );
  }

  function finExpenseList() {
    const e = finExpenses;
    const s = e.summary;
    const head =
      `<p class="card-foot">USD entered in this period: ${esc(finMoney(s.usdCents))} across ${num(s.count)} expense(s). Operating ${esc(finMoney(s.operatingCents))}; processing fees ${s.feeCount ? esc(finMoney(s.feeCents)) : "not entered"}; dispute costs ${esc(finMoney(s.disputeCostCents))}.` +
      `${s.otherCurrencyCount ? ` ${num(s.otherCurrencyCount)} entr${s.otherCurrencyCount === 1 ? "y" : "ies"} in other currencies are not in these totals.` : ""}</p>`;
    const rows = e.expenses.map((x) => {
      const category = (FIN_CATEGORIES.find(([value]) => value === x.category) || [x.category, x.category])[1];
      const reference = x.reference ? `<div class="muted">Ref: ${esc(x.reference)}</div>` : "";
      const action = x.voided
        ? `${pill("Voided", "warn")} <span class="muted">${esc(x.voidReason || "")}</span>`
        : `<button type="button" class="btn" data-fin-edit="${x.id}">Edit</button> ` +
          `<form class="field-row" data-fin-void="${x.id}"><input name="reason" minlength="3" maxlength="200" placeholder="Reason to void" aria-label="Reason to void" required><button type="submit" class="btn">Void</button></form>`;
      return `<tr${x.voided ? ' class="muted"' : ""}><td>${esc(x.expenseDate)}</td><td>${esc(x.description)}${reference}</td><td>${esc(category)}</td><td class="num">${esc(finMoney(x.amountCents))} ${esc(x.currency)}</td><td>${action}</td></tr>`;
    });
    return head + table([{ label: "Date" }, { label: "Description" }, { label: "Category" }, { label: "Amount", num: true }, { label: "" }], rows, "No expenses entered for this period.");
  }

  function finReportHtml() {
    const r = finReport;
    const live = r.money.live;
    const m = r.membership;
    const tiles = [
      tile({ label: "Gross, live", value: finMoney(live.grossCents), sub: `${num(live.transactions)} payment(s) in this period` }),
      tile({ label: "Net collected", value: finMoney(live.netCents), sub: "Gross minus refunds and lost disputes" }),
      tile({ label: "Recorded profit", value: finMoney(r.profit.operatingProfitCents), sub: r.profit.label }),
      tile({ label: "Recurring renewals", value: finMoney(r.recurring.renewalGrossCents), sub: `${num(r.recurring.renewalCount)} renewal payment(s)` }),
      tile({ label: "Failed live payments", value: num(r.recurring.failedLivePayments), sub: "Card payments the bank did not make" }),
      tile({ label: "Seen in last 5 minutes", value: num(m.seenLast5Minutes), sub: `${num(m.activeLast30Days)} seen in the last 30 days` }),
    ].join("");
    const trendRows = r.trend.points.map(
      (pt) => `<tr><td>${esc(pt.bucket)}</td><td class="num">${num(pt.transactions)}</td><td class="num">${esc(finMoney(pt.grossCents))}</td><td class="num">${esc(finMoney(pt.refundsCents + pt.disputeLostCents))}</td><td class="num">${esc(finMoney(pt.netCents))}</td></tr>`,
    );
    const trend = table(
      [{ label: `Start of each ${r.trend.unit}` }, { label: "Payments", num: true }, { label: "Gross", num: true }, { label: "Refunds and lost", num: true }, { label: "Net", num: true }],
      trendRows,
      "No live payments in this period.",
    );
    const other = table(
      [{ label: "Stripe mode" }, { label: "Payments", num: true }, { label: "Gross", num: true }],
      [
        ["Test (sandbox): not revenue", r.money.test],
        ["Not recorded (before the mode was stored): not revenue", r.money.unrecorded],
      ].map(([label, b]) => `<tr><td>${esc(label)}</td><td class="num">${num(b.transactions)}</td><td class="num">${esc(finMoney(b.grossCents))}</td></tr>`),
    );
    const members =
      `<dl class="detail-grid">` +
      `<dt>Registered users</dt><dd>${num(m.totalUsers)}</dd>` +
      `<dt>Seen in last 5 minutes</dt><dd>${num(m.seenLast5Minutes)}</dd>` +
      `<dt>Seen in last 30 days</dt><dd>${num(m.activeLast30Days)}</dd>` +
      `<dt>Free accounts (not premium)</dt><dd>${num(m.freeUsers)}</dd>` +
      `<dt>Premium accounts</dt><dd>${num(m.premiumUsers)}</dd>` +
      `<dt>Lifetime members</dt><dd>${num(m.lifetimeMembers)}</dd>` +
      `<dt>Stripe, active</dt><dd>${num(m.stripe.active)}</dd>` +
      `<dt>Stripe, trialing</dt><dd>${num(m.stripe.trialing)}</dd>` +
      `<dt>Stripe, past due</dt><dd>${num(m.stripe.pastDue)}</dd>` +
      `<dt>Stripe, canceled (all time)</dt><dd>${num(m.stripe.canceled)}</dd>` +
      `<dt>Store, active</dt><dd>${num(m.storeActiveUsers)}</dd>` +
      `<dt>Premium with no payment on record</dt><dd>${num(m.premiumWithoutPayment)}</dd>` +
      `<dt>New paid subscriptions in period</dt><dd>${num(m.newPaidSubscriptions)}</dd>` +
      `<dt>Ended in period</dt><dd>${num(m.endedInPeriod)}</dd>` +
      `</dl><p class="card-foot">${esc(m.note)}</p>`;
    return (
      `<div class="grid">${tiles}</div>` +
      `<div class="two-col">` +
      `<section class="card"><h2 class="card-title">Trend</h2>${trend}<p class="card-foot">${esc(r.recurring.note)}</p></section>` +
      `<section class="card"><h2 class="card-title">Memberships</h2>${members}</section>` +
      `</div>` +
      `<section class="card"><h2 class="card-title">Other payment modes</h2>${other}<p class="card-foot">Shown so they are never taken for live income.</p></section>`
    );
  }

  function finLedgerHtml() {
    const l = finLedger;
    const first = l.query.offset + 1;
    const last = Math.min(l.query.offset + l.rows.length, l.total);
    const rows = l.rows.map((x) => {
      const environment = x.environment === "live" ? pill("Live", "good") : x.environment === "test" ? pill("Test", "info") : pill("Not recorded", "warn");
      const refund = x.refundedCents ? ` <span class="muted">(refunded ${esc(finMoney(x.refundedCents))})</span>` : "";
      return (
        `<tr><td>${esc(new Date(x.createdAt).toLocaleString("en-GB", { hour12: false }))}</td><td>${esc(x.username)}</td>` +
        `<td>${esc(sentence(x.feature))}${x.tier ? ` · ${esc(sentence(x.tier))}` : ""}</td><td>${esc(sentence(x.provider))}</td>` +
        `<td>${environment}</td><td>${esc(sentence(x.status))}</td><td class="num">${esc(finMoney(x.amountCents))}${refund}</td></tr>`
      );
    });
    const pager =
      `<div class="field-row"><span class="muted">${l.total ? `Showing ${num(first)} to ${num(last)} of ${num(l.total)}` : "No payments match."}</span>` +
      (l.query.offset > 0 ? `<button type="button" class="btn" data-fin-page="-1">Newer</button>` : "") +
      (l.query.offset + l.rows.length < l.total ? `<button type="button" class="btn" data-fin-page="1">Older</button>` : "") +
      `</div>`;
    return (
      table(
        [{ label: "When (UTC)" }, { label: "Member" }, { label: "Purchase" }, { label: "Provider" }, { label: "Mode" }, { label: "Status" }, { label: "Amount", num: true }],
        rows,
        "No payments match this search.",
      ) + pager
    );
  }

  function finAllTimeHtml() {
    const f = finAll;
    const tiles = [
      tile({ label: "Net revenue, all time", value: finMoney(f.totals.allTime.netCents), sub: "Live payments: gross minus refunds" }),
      tile({ label: "Active subscriptions", value: num(f.revenue.activeSubscriptions), sub: "Stripe: active, trialing or past due" }),
      tile({ label: "Failed payments, 30 days", value: num(f.revenue.failedPayments30), sub: "Payments the card did not make" }),
      tile({ label: "Lifetime members", value: num(f.membership.lifetimeMembers), sub: "Granted tier; never ends with a subscription" }),
    ].join("");
    const statusRows = [
      ["Succeeded", f.statuses.succeeded],
      ["Refunded", f.statuses.refunded],
      ["Pending (not counted yet)", f.statuses.pending],
      ["Failed (not counted)", f.statuses.failed],
    ].map(([label, s]) => `<tr><td>${esc(label)}</td><td class="num">${num(s.count)}</td><td class="num">${esc(finMoney(s.cents))}</td></tr>`);
    const planRows = f.plans.map((p) => `<tr><td>${esc(sentence(p.tier))}</td><td class="num">${num(p.activeSubscriptions)}</td><td class="num">${esc(finMoney(p.grossCentsAll - p.refundsCentsAll))}</td></tr>`);
    const storeRows = f.store.providers.map((p) => `<tr><td>${esc(sentence(p.provider))}</td><td class="num">${num(p.active)}</td><td class="num">${num(p.expired)}</td><td class="num">${num(p.revoked)}</td><td class="num">${num(p.purchasesLast30Days)}</td></tr>`);
    const memberStatus = (m) => {
      if (m.stripeStatus) return `${sentence(m.stripeStatus)}${m.cancelAtPeriodEnd ? " (ends at period end)" : ""}`;
      if (m.storeProvider) return "Active in the app store";
      if (m.lifetime) return "Lifetime";
      return "No payment on record";
    };
    const memberDate = (m) => {
      const when = m.renewsOrEndsAt || m.storeExpiresAt;
      return when ? new Date(when).toLocaleDateString("en-GB") : "-";
    };
    const memberRows = f.members.map((m) => `<tr><td>${esc(m.username)}</td><td>${esc(sentence(m.tier))}</td><td>${esc(m.source)}</td><td>${esc(memberStatus(m))}</td><td>${esc(memberDate(m))}</td></tr>`);
    const envRows = [
      ["Test mode (Stripe test account)", f.environments.allTime.test],
      ["Not recorded (before the mode was stored)", f.environments.allTime.unrecorded],
    ].map(([label, bucket]) => `<tr><td>${esc(label)}</td><td class="num">${num(bucket.transactions)}</td><td class="num">${esc(finMoney(bucket.grossCents))}</td></tr>`);
    const disputeRows = [
      ["Open, not deducted", f.disputes.openCents],
      ["Lost, deducted from net", f.disputes.lostCents],
    ].map(([label, cents]) => `<tr><td>${esc(label)}</td><td class="num">${esc(finMoney(cents))}</td></tr>`);
    const b = f.billing;
    const modeLabel = { test: "Stripe test mode (sandbox)", live: "Stripe live mode", "not set": "Stripe not set up", unknown: "Stripe key not recognised" }[f.stripeMode] || f.stripeMode;
    const payments =
      `<section class="card"><h2 class="card-title">Payments setup</h2>` +
      `<dl class="detail-grid"><dt>Mode</dt><dd>${esc(modeLabel)}</dd>` +
      `<dt>Stripe secret key</dt><dd>${b.stripeKeyPresent ? "Set" : "Not set"}</dd>` +
      `<dt>Webhook secret</dt><dd>${b.webhookSecretPresent ? "Set" : "Not set"}</dd>` +
      `<dt>Webhook events, last 24 h</dt><dd>${f.webhook.available ? `${num(f.webhook.appliedLast24h)} applied${f.webhook.lastReceivedAt ? `, last ${esc(new Date(f.webhook.lastReceivedAt).toLocaleString("en-GB", { hour12: false }))}` : ""}` : esc(f.webhook.note)}</dd>` +
      `<dt>Core+ prices</dt><dd>${b.missingTierPrices.length === 0 ? "All set" : `Missing: ${esc(b.missingTierPrices.join(", "))}`}</dd></dl>` +
      `<p class="card-foot">${b.ready ? "Card payments are ready." : "Card payments are not ready."} Only whether each key is present is shown; no key value is read out.</p></section>`;
    return (
      `<section class="card"><h2 class="card-title">All time, from the start</h2><p class="card-foot">Everything the app has recorded, not limited to the period above.</p></section>` +
      `<div class="grid">${tiles}</div>` +
      `<div class="two-col">` +
      `<section class="card"><h2 class="card-title">Payments by status</h2>${table([{ label: "Status" }, { label: "Payments", num: true }, { label: "Amount", num: true }], statusRows, "No payments yet.")}</section>` +
      `<section class="card"><h2 class="card-title">Revenue by plan, all time</h2>${table([{ label: "Plan" }, { label: "Active", num: true }, { label: "Net, all time", num: true }], planRows, "No plan payments yet.")}</section>` +
      `</div>` +
      `<div class="two-col">` +
      `<section class="card"><h2 class="card-title">Not counted as revenue</h2>${table([{ label: "Where it came from" }, { label: "Payments", num: true }, { label: "Amount", num: true }], envRows, "No test or unrecorded payments.")}<p class="card-foot">${esc(f.processingFees.note)}</p></section>` +
      `<section class="card"><h2 class="card-title">Disputes</h2>${table([{ label: "Disputes, live payments" }, { label: "Amount", num: true }], disputeRows)}<p class="card-foot">${esc(f.disputes.note)}</p></section>` +
      `</div>` +
      `<div class="two-col">` +
      `<section class="card"><h2 class="card-title">Store purchases (Apple, Google)</h2>${table([{ label: "Store" }, { label: "Active", num: true }, { label: "Expired", num: true }, { label: "Revoked", num: true }, { label: "Bought, 30 days", num: true }], storeRows, "No store purchases yet.")}<p class="card-foot">${esc(f.store.note)}</p></section>` +
      `<div>${payments}</div>` +
      `</div>` +
      `<section class="card"><h2 class="card-title">Members with premium or a subscription (${num(f.members.length)} shown)</h2>` +
      `${table([{ label: "Member" }, { label: "Tier" }, { label: "Source" }, { label: "Status" }, { label: "Renews or ends" }], memberRows, "No premium members.")}` +
      `<p class="card-foot">${num(f.membership.premiumUsers)} members have premium: ${num(f.membership.lifetimeMembers)} lifetime, ${num(f.membership.stripeActiveUsers)} paying through an active Stripe subscription, ${num(f.membership.storeActiveUsers)} paying through an active store subscription, and ${num(f.membership.premiumWithoutPayment)} with no payment on record. Premium with no payment on record is granted another way and is not counted as revenue.</p></section>` +
      `<section class="card"><h2 class="card-title">Most recent payments</h2>${table([{ label: "When" }, { label: "Member" }, { label: "Purchase" }, { label: "Provider" }, { label: "Status" }, { label: "Amount", num: true }], f.recent.map((r) => `<tr><td>${esc(new Date(r.createdAt).toLocaleString("en-GB", { hour12: false }))}</td><td>${esc(r.username)}</td><td>${esc(r.featureLabel)}${r.tier ? ` · ${esc(sentence(r.tier))}` : ""}</td><td>${esc(sentence(r.provider))}</td><td>${esc(sentence(r.status))}${r.refundedCents ? ` · refunded ${esc(finMoney(r.refundedCents))}` : ""}</td><td class="num">${esc(finMoney(r.amountCents))}</td></tr>`), "No payments yet.")}</section>`
    );
  }

  function renderFinance() {
    const el = $("#view-finance");
    if (!el.querySelector("#finSkeleton")) buildFinanceSkeleton(el);
    el.onclick = finClick;
    el.onsubmit = finSubmit;
    el.onchange = finChange;
    if (Date.now() - finState.lastAttempt > FIN_REFRESH_MS) refreshFinance();
    finSlot("period", finPeriodBar());
    finSlot("connection", finConnection());
    if (!finReport || !finAll || !finExpenses || !finLedger) {
      finSlot("profit", finState.error ? `<section class="card">${errorLine(finState.error)}</section>` : loading("Reading the finance numbers."));
      return;
    }
    finSlot("profit", finProfit());
    finSlot("expenses", finExpenseList());
    finSlot("report", finReportHtml());
    finSlot("ledger", finLedgerHtml());
    finSlot("alltime", finAllTimeHtml());
  }

  function finClick(event) {
    const target = event.target;
    const period = target.closest("[data-fin-period]");
    if (period) {
      const key = period.dataset.finPeriod;
      if (key === "custom") {
        const from = $("#finFrom").value;
        const to = $("#finTo").value;
        if (!from || !to) {
          toast("Pick both dates, then press Show custom period.", true);
          return;
        }
        finState.from = from;
        finState.to = to;
      }
      finState.preset = key;
      finState.ledgerOffset = 0;
      refreshFinance();
      return;
    }
    const page = target.closest("[data-fin-page]");
    if (page) {
      finState.ledgerOffset = Math.max(0, finState.ledgerOffset + Number(page.dataset.finPage) * FIN_PAGE);
      refreshFinance();
      return;
    }
    const edit = target.closest("[data-fin-edit]");
    if (edit) {
      finStartEdit(Number(edit.dataset.finEdit));
      return;
    }
    if (target.closest("[data-fin-cancel]")) finCancelEdit();
  }

  function finChange(event) {
    if (event.target.id === "finShowVoided") {
      finState.showVoided = event.target.checked;
      refreshFinance();
    }
  }

  function finSubmit(event) {
    const form = event.target;
    if (form.id === "finCustomForm") {
      event.preventDefault();
      const from = finField(form, "from").value;
      const to = finField(form, "to").value;
      if (!from || !to) {
        toast("Pick both dates first.", true);
        return;
      }
      finState.preset = "custom";
      finState.from = from;
      finState.to = to;
      finState.ledgerOffset = 0;
      refreshFinance();
    } else if (form.id === "finLedgerForm") {
      event.preventDefault();
      finState.ledgerQ = finField(form, "q").value.trim();
      finState.ledgerStatus = finField(form, "status").value;
      finState.ledgerOffset = 0;
      refreshFinance();
    } else if (form.id === "finExpenseForm") {
      event.preventDefault();
      finSaveExpense(form);
    } else if (form.dataset.finVoid) {
      event.preventDefault();
      finVoidExpense(form);
    }
  }

  async function finSaveExpense(form) {
    const msg = $("#finExpenseMsg");
    const body = {};
    for (const name of ["amount", "date", "currency", "category", "description", "reference"]) body[name] = finField(form, name).value;
    const editing = finState.editId;
    msg.textContent = "";
    try {
      await api("POST", editing ? `/api/finance/expenses/${editing}/update` : "/api/finance/expenses", body);
      toast(editing ? "Expense changed." : "Expense saved.");
      finCancelEdit();
      refreshFinance();
    } catch (err) {
      msg.textContent = err.message;
    }
  }

  function finStartEdit(id) {
    const record = finExpenses && finExpenses.expenses.find((x) => x.id === id);
    if (!record) return;
    const form = $("#finExpenseForm");
    finField(form, "amount").value = (record.amountCents / 100).toFixed(2);
    finField(form, "date").value = record.expenseDate;
    finField(form, "currency").value = record.currency;
    finField(form, "category").value = record.category;
    finField(form, "description").value = record.description;
    finField(form, "reference").value = record.reference || "";
    finState.editId = id;
    $("#finSaveBtn").textContent = "Save changes";
    $("#finCancelEdit").hidden = false;
    $("#finExpenseTitle").textContent = `Edit expense ${id}`;
    $("#finExpenseMsg").textContent = "";
    form.scrollIntoView({ block: "nearest" });
  }

  function finCancelEdit() {
    const form = $("#finExpenseForm");
    if (!form) return;
    form.reset();
    finState.editId = null;
    $("#finSaveBtn").textContent = "Save expense";
    $("#finCancelEdit").hidden = true;
    $("#finExpenseTitle").textContent = "Add an expense";
    $("#finExpenseMsg").textContent = "";
  }

  async function finVoidExpense(form) {
    const id = form.dataset.finVoid;
    try {
      await api("POST", `/api/finance/expenses/${id}/void`, { reason: finField(form, "reason").value });
      toast("Expense voided. It stays on record.");
      refreshFinance();
    } catch (err) {
      toast(err.message, true);
    }
  }

  function renderActive() {
    try {
      if (app.view === "overview") renderOverview();
      else if (app.view === "services") renderServices();
      else if (app.view === "activity") renderActivity();
      else if (app.view === "logs") renderLogLines();
      else if (app.view === "feed") renderFeed();
      else if (app.view === "tickets") renderTickets();
      else if (app.view === "release") renderRelease();
      else if (app.view === "legal") renderLegal();
      else if (app.view === "readiness") renderReadiness();
      else if (app.view === "operations") renderOperations();
      else if (app.view === "finance") renderFinance();
    } catch (err) {
      console.error("render failed", err);
    }
  }

  function go(view) {
    const next = VIEWS.includes(view) ? view : "overview";
    app.view = next;
    for (const section of document.querySelectorAll("main .view")) {
      section.hidden = section.getAttribute("data-view") !== next;
    }
    for (const link of document.querySelectorAll(".rail-item")) {
      if (link.getAttribute("data-view") === next) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    renderActive();
  }

  function toggleAll() {
    app.all = !app.all;
    const button = $("#allToggle");
    button.setAttribute("aria-pressed", String(app.all));
    connect();
    toast(app.all ? "Showing all pm2 apps." : "Showing Nexus Forge apps only.");
  }

  function togglePause() {
    app.paused = !app.paused;
    const button = $("#logPause");
    button.setAttribute("aria-pressed", String(app.paused));
    button.firstChild.textContent = app.paused ? "Resume " : "Pause ";
    renderLogLines();
  }

  function wireKeys() {
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const tag = (target.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
      if (event.key === "Escape") {
        if (typing) target.blur();
        return;
      }
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "0") {
        location.hash = VIEWS[9];
        return;
      }
      if (event.key === "f" || event.key === "F") {
        location.hash = "finance";
        return;
      }
      const n = Number(event.key);
      if (n >= 1 && n <= VIEWS.length) {
        location.hash = VIEWS[n - 1];
        return;
      }
      if (event.key === "a" || event.key === "A") {
        toggleAll();
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        if (app.view !== "logs") location.hash = "logs";
        $("#logFilter").focus();
        return;
      }
      if ((event.key === "p" || event.key === "P") && app.view === "logs") togglePause();
    });
  }

  function wireLogs() {
    for (const id of ["#logApp", "#logStream", "#logErrors"]) $(id).addEventListener("change", renderLogLines);
    $("#logFilter").addEventListener("input", renderLogLines);
    $("#logPause").addEventListener("click", togglePause);
    $("#feedKind").addEventListener("change", renderFeed);
    $("#allToggle").addEventListener("click", toggleAll);
  }

  async function init() {
    wireKeys();
    wireLogs();
    wireTickets();
    buildTicketsSkeleton();
    buildOpsSkeleton();
    startOpsTicker();
    window.addEventListener("hashchange", () => go(location.hash.replace("#", "")));
    go(location.hash.replace("#", "") || "overview");
    const [tickets] = await Promise.all([
      api("GET", "/api/tickets").catch(() => ({ tickets: [] })),
      refreshBugs(),
      refreshActions(),
    ]);
    mergeTickets(tickets.tickets || []);
    connect();

    setInterval(() => {
      app.tickSeconds += 1;
      if (app.liveState === "live" && Date.now() - app.lastStateAt > 12000) setLive("stale");
      renderTop();
      if (app.tickSeconds % 30 === 0) {
        if (app.view === "tickets") renderTicketList();
        refreshBugs();
        if (app.view === "tickets") refreshActions();
        if (app.view === "finance") refreshFinance();
      }
    }, 1000);
  }

  init();
})();
