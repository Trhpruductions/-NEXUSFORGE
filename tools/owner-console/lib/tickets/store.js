"use strict";

// The console's own triage store (node:sqlite). It is the only thing this console writes.
// The app database is never written to from here.

const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const { DATA_DIR, TICKET_DB_FILE } = require("../config");

// Who made a change: the owner through this console, or the console itself for automatic steps (ingest, auto-linking).
const OWNER_ACTOR = "owner";
const SYSTEM_ACTOR = "system";

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const TICKET_STATUSES = ["NEW", "TRIAGED", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"];
const BUG_STATUSES = ["OPEN", "FIXING", "FIXED"];
const SOURCE_KINDS = [
  "PROBLEM",
  "MESSAGE_REPORT",
  "SUPPORT",
  "APPEAL",
  "SUSPENSION",
  "FORGE_BAN",
  "ERROR_GROUP",
  "SECURITY_LOG",
  "AUDIT_FAILURE",
  "MANUAL_INCIDENT",
];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_kind TEXT NOT NULL,
  origin_table TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  app_status TEXT,
  owner_note TEXT NOT NULL DEFAULT '',
  linked_bug_id INTEGER,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  seq INTEGER NOT NULL,
  UNIQUE (source_kind, source_ref)
);
CREATE INDEX IF NOT EXISTS tickets_seq ON tickets (seq);
CREATE TABLE IF NOT EXISTS bugs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  fixed_in TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  auto_created INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
  ticket_id INTEGER,
  bug_id INTEGER,
  detail TEXT NOT NULL DEFAULT '',
  actor TEXT
);
CREATE TABLE IF NOT EXISTS cursors (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const LIGHT_COLUMNS = `id, source_kind, origin_table, source_ref, title, category, severity, status, app_status,
  owner_note, linked_bug_id, created_at, first_seen_at, updated_at, seq`;

function nowIso() {
  return new Date().toISOString();
}

function toLight(row) {
  if (!row) return null;
  return {
    id: row.id,
    sourceKind: row.source_kind,
    originTable: row.origin_table,
    sourceRef: row.source_ref,
    title: row.title,
    category: row.category,
    severity: row.severity,
    status: row.status,
    appStatus: row.app_status,
    ownerNote: row.owner_note,
    linkedBugId: row.linked_bug_id,
    createdAt: row.created_at,
    firstSeenAt: row.first_seen_at,
    updatedAt: row.updated_at,
    seq: row.seq,
  };
}

class TicketStore {
  constructor(file = TICKET_DB_FILE) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 2000;");
    this.db.exec(SCHEMA);
    this.migrate();
    const max = this.db.prepare("SELECT COALESCE(MAX(seq), 0) AS seq FROM tickets").get();
    this.seq = Number(max.seq) || 0;
    this.stmts = {
      findTicket: this.db.prepare("SELECT * FROM tickets WHERE source_kind = ? AND source_ref = ?"),
      getTicket: this.db.prepare("SELECT * FROM tickets WHERE id = ?"),
      insertTicket: this.db.prepare(`INSERT INTO tickets
        (source_kind, origin_table, source_ref, title, category, severity, status, app_status, created_at,
         first_seen_at, updated_at, seq, detail_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
      listTickets: this.db.prepare(`SELECT ${LIGHT_COLUMNS} FROM tickets ORDER BY id DESC LIMIT 5000`),
      changedSince: this.db.prepare(`SELECT ${LIGHT_COLUMNS} FROM tickets WHERE seq > ? ORDER BY seq ASC LIMIT 1000`),
      updateTicketFields: this.db.prepare("UPDATE tickets SET status = ?, severity = ?, category = ?, updated_at = ?, seq = ? WHERE id = ?"),
      updateNote: this.db.prepare("UPDATE tickets SET owner_note = ?, updated_at = ?, seq = ? WHERE id = ?"),
      updateLink: this.db.prepare("UPDATE tickets SET linked_bug_id = ?, updated_at = ?, seq = ? WHERE id = ?"),
      updateAppStatus: this.db.prepare("UPDATE tickets SET app_status = ?, updated_at = ?, seq = ? WHERE id = ?"),
      updateIngested: this.db.prepare("UPDATE tickets SET app_status = ?, title = ?, detail_json = ?, updated_at = ?, seq = ? WHERE id = ?"),
      refsForTable: this.db.prepare("SELECT id, source_ref, app_status FROM tickets WHERE origin_table = ? AND (app_status IS NULL OR app_status NOT IN (?, ?)) LIMIT 500"),
      insertAction: this.db.prepare("INSERT INTO actions (at, action, ticket_id, bug_id, detail, target, result, actor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
      listActions: this.db.prepare("SELECT id, at, action, ticket_id, bug_id, detail, target, result, actor FROM actions ORDER BY id DESC LIMIT ?"),
      actionsForTicket: this.db.prepare("SELECT id, at, action, ticket_id, bug_id, detail, actor FROM actions WHERE ticket_id = ? ORDER BY id DESC LIMIT 50"),
      insertBug: this.db.prepare("INSERT INTO bugs (title, status, fixed_in, notes, auto_created, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"),
      getBug: this.db.prepare("SELECT * FROM bugs WHERE id = ?"),
      listBugs: this.db.prepare(`SELECT b.*, (SELECT COUNT(*) FROM tickets t WHERE t.linked_bug_id = b.id) AS linked_count
        FROM bugs b ORDER BY b.id DESC LIMIT 1000`),
      updateBug: this.db.prepare("UPDATE bugs SET title = ?, status = ?, fixed_in = ?, notes = ?, updated_at = ? WHERE id = ?"),
      getCursor: this.db.prepare("SELECT value FROM cursors WHERE name = ?"),
      setCursor: this.db.prepare("INSERT INTO cursors (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value"),
    };
  }

  /** Adds the target, result and actor columns to actions on stores created before they existed. Old rows keep no actor. */
  migrate() {
    const columns = this.db.prepare("PRAGMA table_info(actions)").all().map((column) => column.name);
    if (!columns.includes("target")) this.db.exec("ALTER TABLE actions ADD COLUMN target TEXT");
    if (!columns.includes("result")) this.db.exec("ALTER TABLE actions ADD COLUMN result TEXT");
    if (!columns.includes("actor")) this.db.exec("ALTER TABLE actions ADD COLUMN actor TEXT");
  }

  nextSeq() {
    this.seq += 1;
    return this.seq;
  }

  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  getCursor(name) {
    const row = this.stmts.getCursor.get(name);
    return row ? row.value : null;
  }

  setCursor(name, value) {
    this.stmts.setCursor.run(name, String(value));
  }

  logAction(action, { ticketId = null, bugId = null, detail = "", target = null, result = null, actor = OWNER_ACTOR } = {}) {
    this.stmts.insertAction.run(nowIso(), action, ticketId, bugId, String(detail).slice(0, 2000), target, result, actor);
  }

  /** Ops actions (restart, build, check, schema): the time, the action, the target, the result and who ran it. */
  logOps({ action, target, result, detail = "" }) {
    this.transaction(() => this.logAction(action, { target, result, detail }));
  }

  /**
   * Inserts a ticket found in the app, or refreshes its app-side fields if it already exists.
   * Owner triage fields (status, severity, category, note, bug link) are never overwritten here.
   * @returns {{id:number, created:boolean, changed:boolean}}
   */
  ingest(row) {
    const detailJson = JSON.stringify(row.detail || {});
    const existing = this.stmts.findTicket.get(row.sourceKind, row.sourceRef);
    if (!existing) {
      const stamp = nowIso();
      return this.transaction(() => {
        const result = this.stmts.insertTicket.run(
          row.sourceKind,
          row.originTable,
          row.sourceRef,
          row.title,
          row.category ?? null,
          row.severity,
          row.initialStatus || "NEW",
          row.appStatus ?? null,
          row.createdAt || stamp,
          stamp,
          stamp,
          this.nextSeq(),
          detailJson,
        );
        return { id: Number(result.lastInsertRowid), created: true, changed: true };
      });
    }
    const appChanged = (existing.app_status ?? null) !== (row.appStatus ?? null);
    const titleChanged = existing.title !== row.title;
    const detailChanged = existing.detail_json !== detailJson;
    if (!appChanged && !titleChanged && !detailChanged) return { id: existing.id, created: false, changed: false };
    const stamp = nowIso();
    this.transaction(() => {
      this.stmts.updateIngested.run(row.appStatus ?? null, row.title, detailJson, stamp, this.nextSeq(), existing.id);
    });
    return { id: existing.id, created: false, changed: true };
  }

  getTicketRow(id) {
    return this.stmts.getTicket.get(id) || null;
  }

  findTicketRow(sourceKind, sourceRef) {
    return this.stmts.findTicket.get(sourceKind, sourceRef) || null;
  }

  listTickets() {
    return this.stmts.listTickets.all().map(toLight);
  }

  changedSince(seq) {
    return this.stmts.changedSince.all(seq).map(toLight);
  }

  getTicketDetail(id) {
    const row = this.getTicketRow(id);
    if (!row) return null;
    let detail = {};
    try {
      detail = JSON.parse(row.detail_json);
    } catch {
      detail = {};
    }
    return {
      ...toLight(row),
      detail,
      actions: this.stmts.actionsForTicket.all(id),
    };
  }

  /** Triage: status, severity and category. Every change is written to the actions log. */
  triage(id, { status, severity, category }) {
    const row = this.getTicketRow(id);
    if (!row) throw new Error("ticket not found");
    const nextStatus = status ?? row.status;
    const nextSeverity = severity ?? row.severity;
    const nextCategory = category ?? row.category;
    if (!TICKET_STATUSES.includes(nextStatus)) throw new Error("unknown status");
    if (!SEVERITIES.includes(nextSeverity)) throw new Error("unknown severity");
    const changes = [];
    if (nextStatus !== row.status) changes.push(`status ${row.status} to ${nextStatus}`);
    if (nextSeverity !== row.severity) changes.push(`severity ${row.severity} to ${nextSeverity}`);
    if (nextCategory !== row.category) changes.push(`category ${row.category ?? "none"} to ${nextCategory ?? "none"}`);
    if (changes.length === 0) return toLight(row);
    this.transaction(() => {
      this.stmts.updateTicketFields.run(nextStatus, nextSeverity, nextCategory ?? null, nowIso(), this.nextSeq(), id);
      this.logAction("ticket.triage", { ticketId: id, detail: changes.join("; ") });
    });
    return toLight(this.getTicketRow(id));
  }

  setNote(id, note) {
    const row = this.getTicketRow(id);
    if (!row) throw new Error("ticket not found");
    const text = String(note || "").slice(0, 4000);
    this.transaction(() => {
      this.stmts.updateNote.run(text, nowIso(), this.nextSeq(), id);
      this.logAction("ticket.note", { ticketId: id, detail: `note of ${text.length} characters` });
    });
    return toLight(this.getTicketRow(id));
  }

  linkToBug(ticketId, bugId, { auto = false } = {}) {
    const ticket = this.getTicketRow(ticketId);
    if (!ticket) throw new Error("ticket not found");
    const bug = this.stmts.getBug.get(bugId);
    if (!bug) throw new Error("bug not found");
    this.transaction(() => {
      this.stmts.updateLink.run(bugId, nowIso(), this.nextSeq(), ticketId);
      this.logAction(auto ? "bug.auto_link" : "ticket.link_bug", { ticketId, bugId, detail: `linked to bug ${bugId}`, actor: auto ? SYSTEM_ACTOR : OWNER_ACTOR });
    });
    return toLight(this.getTicketRow(ticketId));
  }

  createIncident({ title, severity, note }) {
    if (!SEVERITIES.includes(severity)) throw new Error("unknown severity");
    const cleanTitle = typeof title === "string" ? title.trim().slice(0, 200) : "";
    if (!cleanTitle) throw new Error("a title is required");
    const stamp = nowIso();
    const ref = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return this.transaction(() => {
      const result = this.stmts.insertTicket.run(
        "MANUAL_INCIDENT",
        "console",
        ref,
        cleanTitle,
        "incident",
        severity,
        "NEW",
        null,
        stamp,
        stamp,
        stamp,
        this.nextSeq(),
        JSON.stringify({ origin: "console", note: String(note || "").slice(0, 4000) }),
      );
      const id = Number(result.lastInsertRowid);
      this.logAction("incident.create", { ticketId: id, detail: `severity ${severity}` });
      return toLight(this.getTicketRow(id));
    });
  }

  listBugs() {
    return this.stmts.listBugs.all().map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      fixedIn: row.fixed_in,
      notes: row.notes,
      autoCreated: row.auto_created === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      linkedCount: row.linked_count,
    }));
  }

  createBug({ title, notes = "", autoCreated = false }) {
    const clean = String(title || "").trim().slice(0, 200);
    if (!clean) throw new Error("bug title is required");
    const stamp = nowIso();
    return this.transaction(() => {
      const result = this.stmts.insertBug.run(clean, "OPEN", "", String(notes).slice(0, 2000), autoCreated ? 1 : 0, stamp, stamp);
      const id = Number(result.lastInsertRowid);
      this.logAction(autoCreated ? "bug.auto_create" : "bug.create", { bugId: id, detail: clean, actor: autoCreated ? SYSTEM_ACTOR : OWNER_ACTOR });
      return id;
    });
  }

  updateBug(id, { status, fixedIn, notes }) {
    const row = this.stmts.getBug.get(id);
    if (!row) throw new Error("bug not found");
    const nextStatus = status ?? row.status;
    if (!BUG_STATUSES.includes(nextStatus)) throw new Error("unknown bug status");
    const nextFixed = fixedIn === undefined ? row.fixed_in : String(fixedIn).slice(0, 200);
    const nextNotes = notes === undefined ? row.notes : String(notes).slice(0, 2000);
    this.transaction(() => {
      this.stmts.updateBug.run(row.title, nextStatus, nextFixed, nextNotes, nowIso(), id);
      const detail = [
        nextStatus !== row.status ? `status ${row.status} to ${nextStatus}` : null,
        nextFixed !== row.fixed_in ? `fixed in ${nextFixed || "none"}` : null,
        nextNotes !== row.notes ? "notes changed" : null,
      ].filter(Boolean).join("; ");
      this.logAction(nextStatus === "FIXED" && row.status !== "FIXED" ? "bug.fixed" : "bug.update", { bugId: id, detail: detail || "no change" });
    });
    return this.listBugs().find((bug) => bug.id === id);
  }

  listActions(limit = 200) {
    return this.stmts.listActions.all(Math.min(limit, 500)).map((row) => ({
      id: row.id,
      at: row.at,
      action: row.action,
      ticketId: row.ticket_id,
      bugId: row.bug_id,
      detail: row.detail,
      target: row.target,
      result: row.result,
      actor: row.actor ?? null,
    }));
  }

  /** Tickets from one app table whose app-side status is not final yet. Used to pick up app-side changes. */
  refsForTable(table, finalStatuses) {
    const [a, b] = [finalStatuses[0] || "", finalStatuses[1] || ""];
    return this.stmts.refsForTable.all(table, a, b);
  }

  setAppStatus(id, appStatus) {
    const row = this.getTicketRow(id);
    if (!row || row.app_status === appStatus) return false;
    this.transaction(() => {
      this.stmts.updateAppStatus.run(appStatus, nowIso(), this.nextSeq(), id);
    });
    return true;
  }

  close() {
    this.db.close();
  }
}

module.exports = { TicketStore, SEVERITIES, TICKET_STATUSES, BUG_STATUSES, SOURCE_KINDS, toLight };
