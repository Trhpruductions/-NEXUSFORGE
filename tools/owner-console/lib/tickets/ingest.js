"use strict";

// Reads new and changed records from the app database (SELECT only, read-only session) and writes them
// into the console's triage store. The app itself is never changed from here.

const { withReadOnly } = require("../appdb");
const { ERROR_BUG_THRESHOLD, SUPPORT_BACKFILL_DAYS } = require("../config");
const { scrubText, deepScrub, getPublicSiteUrl } = require("../secrets");

const NOW = "(now() AT TIME ZONE 'UTC')";
const PAGE = 500;
const BACKFILL_ALL = "1970-01-01 00:00:00";

function daysAgoText(days) {
  return new Date(Date.now() - days * 864e5).toISOString().replace("T", " ").replace("Z", "");
}

function maskEmails(text) {
  return String(text).replace(/([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, "$1***@$2");
}

function snippet(text, max) {
  const clean = scrubText(String(text || "")).replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 3)}...` : clean;
}

const PROBLEM_SEVERITY = { BUG: "MEDIUM", SIGN_IN: "MEDIUM", BILLING: "HIGH", SAFETY: "HIGH", OTHER: "LOW" };
const PROBLEM_LABEL = { BUG: "Bug report", SIGN_IN: "Sign-in problem", BILLING: "Billing problem", SAFETY: "Safety report", OTHER: "Problem report" };
const REASON_SEVERITY = { SEXUAL: "CRITICAL", SELF_HARM: "CRITICAL", VIOLENCE: "CRITICAL", HATE: "CRITICAL", HARASSMENT: "HIGH", SCAM: "HIGH", SPAM: "MEDIUM", OTHER: "LOW" };
const SUPPORT_SEVERITY = { BILLING: "HIGH", REPORT_USER: "HIGH", BUG: "MEDIUM", ACCOUNT: "MEDIUM", FORGE: "MEDIUM", OTHER: "LOW" };
const SUPPORT_STATUS = { OPEN: "NEW", WAITING_ON_USER: "WAITING", RESOLVED: "RESOLVED", CLOSED: "CLOSED" };

/** Users with an active suspension (liftedAt empty, and until empty or in the future). */
async function activeSuspensions(select, userIds) {
  const ids = [...new Set(userIds.filter(Boolean))];
  const map = new Map();
  if (ids.length === 0) return map;
  const { rows } = await select(
    `SELECT s."userId" AS user_id, s.reason, s."until"::text AS until, s."createdAt"::text AS started_at
       FROM "AccountSuspension" s
      WHERE s."userId" = ANY($1::text[])
        AND s."liftedAt" IS NULL
        AND (s."until" IS NULL OR s."until" > ${NOW})
      ORDER BY s."createdAt" DESC`,
    [ids],
  );
  for (const row of rows) if (!map.has(row.user_id)) map.set(row.user_id, row);
  return map;
}

/** Reads one table in creation order, from a saved cursor. Each page is written before the cursor moves. */
async function pagedSync(select, store, cursorName, startValue, sql, handlePage) {
  let cursor = store.getCursor(cursorName) || startValue;
  for (let page = 0; page < 20; page += 1) {
    const { rows } = await select(sql, [cursor]);
    if (rows.length === 0) break;
    await handlePage(rows);
    cursor = rows[rows.length - 1].cursor_at;
    store.setCursor(cursorName, cursor);
    if (rows.length < PAGE) break;
  }
}

function record(store, summary, row) {
  const clean = {
    ...row,
    title: maskEmails(scrubText(row.title)),
    detail: deepScrub(row.detail || {}),
  };
  const result = store.ingest(clean);
  if (result.created) summary.created.push({ id: result.id, sourceKind: clean.sourceKind, title: clean.title });
  else if (result.changed) summary.updated += 1;
  return result;
}

const PROBLEM_SQL = `SELECT p.id, p.kind, p.message, p."contactEmail" AS contact_email, p."pageUrl" AS page_url,
    p."userAgent" AS user_agent, p."userId" AS user_id, p.status::text AS status,
    p."createdAt"::text AS created_at, p."resolvedAt"::text AS resolved_at, p."createdAt"::text AS cursor_at
  FROM "ProblemReport" p
 WHERE p."createdAt" >= $1::timestamp
 ORDER BY p."createdAt" ASC, p.id ASC
 LIMIT ${PAGE}`;

async function syncProblems(select, store, summary, site) {
  await pagedSync(select, store, "problem", BACKFILL_ALL, PROBLEM_SQL, async (rows) => {
    const suspended = await activeSuspensions(select, rows.map((row) => row.user_id));
    for (const row of rows) {
      const suspension = row.user_id ? suspended.get(row.user_id) || null : null;
      const isAppeal = Boolean(suspension);
      const label = PROBLEM_LABEL[row.kind] || "Problem report";
      const headline = snippet(row.message, 90);
      record(store, summary, {
        sourceKind: isAppeal ? "APPEAL" : "PROBLEM",
        originTable: "ProblemReport",
        sourceRef: row.id,
        title: isAppeal ? `Appeal (${String(row.kind).toLowerCase()}): ${headline}` : `${label}: ${headline}`,
        category: row.kind,
        severity: isAppeal ? "HIGH" : PROBLEM_SEVERITY[row.kind] || "LOW",
        initialStatus: row.status === "RESOLVED" ? "RESOLVED" : "NEW",
        appStatus: row.status,
        createdAt: row.created_at,
        detail: {
          origin: "ProblemReport",
          appRecordId: row.id,
          kind: row.kind,
          message: snippet(row.message, 4000),
          contactEmail: row.contact_email || null,
          pageUrl: row.page_url || null,
          userAgent: snippet(row.user_agent, 300),
          userId: row.user_id || null,
          suspension: suspension
            ? { reason: snippet(suspension.reason, 300), until: suspension.until || null, startedAt: suspension.started_at }
            : null,
          createdAt: row.created_at,
          resolvedAt: row.resolved_at || null,
          adminLink: `${site}/admin/problem-reports`,
        },
      });
    }
  });
}

const MESSAGE_REPORT_SQL = `SELECT r.id, r.kind, r."messageId" AS message_id, r."forgeId" AS forge_id, r."channelId" AS channel_id,
    r."authorUsername" AS author_username, r."contentSnapshot" AS content, r.reason, r.details, r.status,
    r."reporterId" AS reporter_id, r."createdAt"::text AS created_at, r."createdAt"::text AS cursor_at
  FROM "MessageReport" r
 WHERE r."createdAt" >= $1::timestamp
 ORDER BY r."createdAt" ASC, r.id ASC
 LIMIT ${PAGE}`;

async function syncMessageReports(select, store, summary, site) {
  await pagedSync(select, store, "message_report", BACKFILL_ALL, MESSAGE_REPORT_SQL, async (rows) => {
    for (const row of rows) {
      record(store, summary, {
        sourceKind: "MESSAGE_REPORT",
        originTable: "MessageReport",
        sourceRef: row.id,
        title: `${String(row.reason).toLowerCase().replace("_", " ")} report: ${snippet(row.content, 80)}`,
        category: row.reason,
        severity: REASON_SEVERITY[row.reason] || "LOW",
        initialStatus: row.status === "OPEN" ? "NEW" : "RESOLVED",
        appStatus: row.status,
        createdAt: row.created_at,
        detail: {
          origin: "MessageReport",
          appRecordId: row.id,
          reason: row.reason,
          reportKind: row.kind,
          content: snippet(row.content, 2000),
          details: snippet(row.details, 1000),
          authorUsername: row.author_username || null,
          reporterId: row.reporter_id,
          forgeId: row.forge_id,
          channelId: row.channel_id,
          messageId: row.message_id,
          createdAt: row.created_at,
          adminLink: `${site}/admin/reports`,
        },
      });
    }
  });
}

const SUPPORT_SQL = `SELECT t.id, t.number, t."userId" AS user_id, t.subject, t.category::text AS category,
    t.status::text AS status, t."createdAt"::text AS created_at, t."lastActivityAt"::text AS cursor_at
  FROM "SupportTicket" t
 WHERE t."lastActivityAt" >= $1::timestamp
 ORDER BY t."lastActivityAt" ASC, t.id ASC
 LIMIT ${PAGE}`;

const SUPPORT_MESSAGES_SQL = `SELECT ticket_id, from_staff, body, created_at FROM (
    SELECT m."ticketId" AS ticket_id, m."fromStaff" AS from_staff, left(m.body, 600) AS body,
           m."createdAt"::text AS created_at,
           row_number() OVER (PARTITION BY m."ticketId" ORDER BY m."createdAt" DESC) AS rn
      FROM "SupportMessage" m
     WHERE m."ticketId" = ANY($1::text[])
  ) x
 WHERE rn <= 5
 ORDER BY ticket_id, created_at`;

async function syncSupport(select, store, summary, site) {
  const start = daysAgoText(SUPPORT_BACKFILL_DAYS);
  await pagedSync(select, store, "support", start, SUPPORT_SQL, async (rows) => {
    const suspended = await activeSuspensions(select, rows.map((row) => row.user_id));
    const messagesResult = await select(SUPPORT_MESSAGES_SQL, [rows.map((row) => row.id)]);
    const messagesByTicket = new Map();
    for (const message of messagesResult.rows) {
      if (!messagesByTicket.has(message.ticket_id)) messagesByTicket.set(message.ticket_id, []);
      messagesByTicket.get(message.ticket_id).push({
        fromStaff: message.from_staff,
        body: snippet(message.body, 600),
        createdAt: message.created_at,
      });
    }
    for (const row of rows) {
      const suspension = row.user_id ? suspended.get(row.user_id) || null : null;
      const isAppeal = Boolean(suspension);
      const subject = snippet(row.subject, 80);
      record(store, summary, {
        sourceKind: isAppeal ? "APPEAL" : "SUPPORT",
        originTable: "SupportTicket",
        sourceRef: row.id,
        title: isAppeal ? `Appeal (support #${row.number}): ${subject}` : `Support #${row.number}: ${subject}`,
        category: row.category,
        severity: isAppeal ? "HIGH" : SUPPORT_SEVERITY[row.category] || "LOW",
        initialStatus: SUPPORT_STATUS[row.status] || "NEW",
        appStatus: row.status,
        createdAt: row.created_at,
        detail: {
          origin: "SupportTicket",
          appRecordId: row.id,
          number: row.number,
          subject: snippet(row.subject, 300),
          category: row.category,
          userId: row.user_id || null,
          suspension: suspension
            ? { reason: snippet(suspension.reason, 300), until: suspension.until || null, startedAt: suspension.started_at }
            : null,
          messages: messagesByTicket.get(row.id) || [],
          createdAt: row.created_at,
          adminLink: `${site}/admin`,
        },
      });
    }
  });
}

const SUSPENSION_SQL = `SELECT s.id, s."userId" AS user_id, u.username, s.reason, s."until"::text AS until,
    s."createdAt"::text AS created_at, s."liftedAt"::text AS lifted_at, s."liftNote" AS lift_note,
    CASE WHEN s."liftedAt" IS NOT NULL THEN 'LIFTED'
         WHEN s."until" IS NOT NULL AND s."until" <= ${NOW} THEN 'EXPIRED'
         ELSE 'ACTIVE' END AS state
  FROM "AccountSuspension" s
  LEFT JOIN "User" u ON u.id = s."userId"
 ORDER BY s."createdAt" DESC
 LIMIT 500`;

async function syncSuspensions(select, store, summary, site) {
  const { rows } = await select(SUSPENSION_SQL);
  for (const row of rows) {
    const who = row.username || "unknown user";
    record(store, summary, {
      sourceKind: "SUSPENSION",
      originTable: "AccountSuspension",
      sourceRef: row.id,
      title: `Suspension (${String(row.state).toLowerCase()}): ${who}`,
      category: "account",
      severity: row.state === "ACTIVE" ? "HIGH" : "LOW",
      initialStatus: row.state === "ACTIVE" ? "NEW" : "RESOLVED",
      appStatus: row.state,
      createdAt: row.created_at,
      detail: {
        origin: "AccountSuspension",
        appRecordId: row.id,
        username: row.username || null,
        userId: row.user_id,
        reason: snippet(row.reason, 500),
        until: row.until || null,
        startedAt: row.created_at,
        liftedAt: row.lifted_at || null,
        liftNote: snippet(row.lift_note, 500),
        state: row.state,
        adminLink: `${site}/admin`,
      },
    });
  }
}

const FORGE_BAN_SQL = `SELECT b.id, b."userId" AS user_id, u.username, b.reason, b."createdAt"::text AS created_at,
    f.name AS forge_name
  FROM "ForgeBan" b
  JOIN "Forge" f ON f.id = b."forgeId"
  LEFT JOIN "User" u ON u.id = b."userId"
 ORDER BY b."createdAt" DESC
 LIMIT 500`;

async function syncForgeBans(select, store, summary, site) {
  const { rows } = await select(FORGE_BAN_SQL);
  for (const row of rows) {
    const who = row.username || "unknown user";
    record(store, summary, {
      sourceKind: "FORGE_BAN",
      originTable: "ForgeBan",
      sourceRef: row.id,
      title: `Forge ban: ${who} from ${row.forge_name}`,
      category: "forge",
      severity: "MEDIUM",
      initialStatus: "NEW",
      appStatus: "ACTIVE",
      createdAt: row.created_at,
      detail: {
        origin: "ForgeBan",
        appRecordId: row.id,
        username: row.username || null,
        userId: row.user_id,
        forgeName: row.forge_name,
        reason: snippet(row.reason, 300),
        createdAt: row.created_at,
        adminLink: `${site}/admin`,
      },
    });
  }
}

function ensureBugCandidate(store, ticketId, row, count) {
  const ticket = store.getTicketRow(ticketId);
  if (!ticket || ticket.linked_bug_id) return;
  const bugId = store.createBug({
    title: maskEmails(`Bug candidate: ${snippet(row.message, 120)}`),
    notes: `Auto-created: error group ${String(row.fingerprint).slice(0, 12)} reached ${count} occurrence(s) (threshold ${ERROR_BUG_THRESHOLD}).`,
    autoCreated: true,
  });
  store.linkToBug(ticketId, bugId, { auto: true });
}

async function syncErrors(select, store, summary, site) {
  const cursor = store.getCursor("errors") || BACKFILL_ALL;
  const { rows } = await select(
    `SELECT e.fingerprint, e.source, e.message, e.path, e.count,
            e."firstSeenAt"::text AS first_seen, e."lastSeenAt"::text AS last_seen
       FROM "ErrorEvent" e
      WHERE e."lastSeenAt" >= $1::timestamp OR e.count >= ${ERROR_BUG_THRESHOLD}
      ORDER BY e."lastSeenAt" DESC
      LIMIT 300`,
    [cursor],
  );
  for (const row of rows) {
    const count = Number(row.count) || 0;
    const headline = snippet(row.message, 90);
    const result = record(store, summary, {
      sourceKind: "ERROR_GROUP",
      originTable: "ErrorEvent",
      sourceRef: row.fingerprint,
      title: `${row.source === "web" ? "Browser" : "Server"} error: ${headline}`,
      category: row.source,
      severity: count >= ERROR_BUG_THRESHOLD ? "HIGH" : "LOW",
      initialStatus: "NEW",
      appStatus: null,
      createdAt: row.first_seen,
      detail: {
        origin: "ErrorEvent",
        fingerprint: row.fingerprint,
        source: row.source,
        message: snippet(row.message, 400),
        path: snippet(row.path, 200),
        count,
        firstSeen: row.first_seen,
        lastSeen: row.last_seen,
        adminLink: `${site}/admin/errors`,
      },
    });
    if (count >= ERROR_BUG_THRESHOLD) ensureBugCandidate(store, result.id, row, count);
  }
  if (rows.length > 0) store.setCursor("errors", rows[0].last_seen);
}

const AUDIT_SQL = `SELECT a.id, a.operation::text AS operation, a."resourceType" AS resource_type, a."resourceId" AS resource_id,
    a."actorId" AS actor_id, a."errorMessage" AS error_message, a.endpoint, a.method, a."ipAddress" AS ip_address,
    a."createdAt"::text AS created_at, a."createdAt"::text AS cursor_at
  FROM "AuditLog" a
 WHERE a.status = 'FAILURE'
   AND a."resourceType" IN ('User', 'Payment', 'Forge')
   AND a."createdAt" >= $1::timestamp
 ORDER BY a."createdAt" ASC, a.id ASC
 LIMIT ${PAGE}`;

async function syncAuditFailures(select, store, summary, site) {
  await pagedSync(select, store, "audit", daysAgoText(SUPPORT_BACKFILL_DAYS), AUDIT_SQL, async (rows) => {
    for (const row of rows) {
      record(store, summary, {
        sourceKind: "AUDIT_FAILURE",
        originTable: "AuditLog",
        sourceRef: row.id,
        title: `Failed ${String(row.operation).toLowerCase()} on ${row.resource_type}`,
        category: row.resource_type,
        severity: "MEDIUM",
        initialStatus: "NEW",
        appStatus: "FAILURE",
        createdAt: row.created_at,
        detail: {
          origin: "AuditLog",
          appRecordId: row.id,
          operation: row.operation,
          resourceType: row.resource_type,
          resourceId: row.resource_id,
          actorId: row.actor_id || null,
          error: snippet(row.error_message, 300),
          endpoint: row.endpoint || null,
          method: row.method || null,
          ipAddress: row.ip_address || null,
          createdAt: row.created_at,
          adminLink: `${site}/admin`,
        },
      });
    }
  });
}

// Tickets whose app record is still open are re-checked, so a resolve or close in the app shows up here.
const STATUS_SPECS = [
  { table: "ProblemReport", finalStatuses: ["RESOLVED"], sql: `SELECT p.id, p.status::text AS status FROM "ProblemReport" p WHERE p.id = ANY($1::text[])` },
  { table: "MessageReport", finalStatuses: ["RESOLVED", "DISMISSED"], sql: `SELECT r.id, r.status AS status FROM "MessageReport" r WHERE r.id = ANY($1::text[])` },
  { table: "SupportTicket", finalStatuses: ["RESOLVED", "CLOSED"], sql: `SELECT t.id, t.status::text AS status FROM "SupportTicket" t WHERE t.id = ANY($1::text[])` },
];

async function syncAppStatuses(select, store, summary) {
  for (const spec of STATUS_SPECS) {
    const refs = store.refsForTable(spec.table, spec.finalStatuses);
    if (refs.length === 0) continue;
    const { rows } = await select(spec.sql, [refs.map((ref) => ref.source_ref)]);
    const byId = new Map(rows.map((row) => [row.id, row.status]));
    for (const ref of refs) {
      const status = byId.get(ref.source_ref);
      if (status && status !== ref.app_status && store.setAppStatus(ref.id, status)) summary.statusChanged += 1;
    }
  }
}

/** Each section gets its own read-only transaction, so one failing query cannot stop the others. */
async function syncFromApp(store) {
  const site = getPublicSiteUrl();
  const summary = { created: [], updated: 0, statusChanged: 0, errors: [] };
  const sections = [
    ["problems", (s) => syncProblems(s, store, summary, site)],
    ["message reports", (s) => syncMessageReports(s, store, summary, site)],
    ["support", (s) => syncSupport(s, store, summary, site)],
    ["suspensions", (s) => syncSuspensions(s, store, summary, site)],
    ["forge bans", (s) => syncForgeBans(s, store, summary, site)],
    ["error groups", (s) => syncErrors(s, store, summary, site)],
    ["audit failures", (s) => syncAuditFailures(s, store, summary, site)],
    ["status checks", (s) => syncAppStatuses(s, store, summary)],
  ];
  for (const [name, run] of sections) {
    try {
      await withReadOnly(run);
    } catch (err) {
      summary.errors.push(`${name}: ${scrubText(err.message || "failed")}`);
    }
  }
  if (summary.errors.length > 0) {
    throw new Error(`ticket sync incomplete (${summary.errors.join("; ")})`);
  }
  return summary;
}

/** Security lines from the pm2 logs become SECURITY_LOG tickets. Duplicates are ignored by line hash. */
function ingestSecurityHits(store, hits) {
  const created = [];
  const stamp = new Date().toISOString();
  for (const hit of hits) {
    const result = record(store, { created, updated: 0 }, {
      sourceKind: "SECURITY_LOG",
      originTable: "pm2 log",
      sourceRef: hit.ref,
      title: hit.title,
      category: hit.ruleId,
      severity: hit.severity,
      initialStatus: "NEW",
      appStatus: null,
      createdAt: stamp,
      detail: { origin: "pm2 log", app: hit.app, stream: hit.stream, line: hit.text },
    });
    void result;
  }
  return created;
}

module.exports = { syncFromApp, ingestSecurityHits };
