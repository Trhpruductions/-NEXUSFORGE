"use strict";

// Every change in the triage log names who made it: the owner through the console, or the system for automatic steps.
// Each test uses its own temporary database file, never the triage store.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { TicketStore } = require("../lib/tickets/store");

function withStore(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "console-actor-"));
  const store = new TicketStore(path.join(dir, "test.sqlite"));
  try {
    fn(store, dir);
  } finally {
    store.close();
  }
}

function ingestSupportTicket(store, ref = "ticket-1") {
  return store.ingest({
    sourceKind: "SUPPORT",
    originTable: "SupportTicket",
    sourceRef: ref,
    title: "Cannot log in",
    category: "ACCOUNT",
    severity: "MEDIUM",
    initialStatus: "NEW",
    appStatus: "OPEN",
    createdAt: "2026-10-15T00:00:00.000Z",
    detail: {},
  });
}

function latestAction(store, action) {
  return store.listActions(500).find((row) => row.action === action);
}

test("triage, notes and manual incidents are recorded as the owner", () => {
  withStore((store) => {
    const { id } = ingestSupportTicket(store);
    store.triage(id, { status: "TRIAGED" });
    assert.equal(latestAction(store, "ticket.triage").actor, "owner");

    store.setNote(id, "checked the logs");
    assert.equal(latestAction(store, "ticket.note").actor, "owner");

    store.createIncident({ title: "Login outage", severity: "HIGH", note: "" });
    assert.equal(latestAction(store, "incident.create").actor, "owner");

    const bugId = store.createBug({ title: "Login bug" });
    store.updateBug(bugId, { status: "FIXING" });
    assert.equal(latestAction(store, "bug.update").actor, "owner");
  });
});

test("an automatic bug link and an automatic bug are recorded as the system", () => {
  withStore((store) => {
    const { id } = ingestSupportTicket(store);
    const bugId = store.createBug({ title: "Bug candidate", autoCreated: true });
    assert.equal(latestAction(store, "bug.auto_create").actor, "system");

    store.linkToBug(id, bugId, { auto: true });
    assert.equal(latestAction(store, "bug.auto_link").actor, "system");
  });
});

test("a manual bug link is recorded as the owner", () => {
  withStore((store) => {
    const { id } = ingestSupportTicket(store);
    const bugId = store.createBug({ title: "Manual bug" });
    store.linkToBug(id, bugId);
    assert.equal(latestAction(store, "ticket.link_bug").actor, "owner");
  });
});

test("the ticket history shows the actor on each change", () => {
  withStore((store) => {
    const { id } = ingestSupportTicket(store);
    store.triage(id, { severity: "HIGH" });
    const detail = store.getTicketDetail(id);
    assert.ok(detail.actions.length >= 1);
    assert.equal(detail.actions[0].actor, "owner");
  });
});

test("a store created before the actor column is upgraded, and its old rows show no actor", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "console-actor-old-"));
  const file = path.join(dir, "old.sqlite");
  const old = new DatabaseSync(file);
  old.exec(`
    CREATE TABLE actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      action TEXT NOT NULL,
      ticket_id INTEGER,
      bug_id INTEGER,
      detail TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO actions (at, action, detail) VALUES ('2026-10-01T00:00:00.000Z', 'ticket.note', 'before the upgrade');
  `);
  old.close();

  const store = new TicketStore(file);
  try {
    const columns = store.db.prepare("PRAGMA table_info(actions)").all().map((column) => column.name);
    assert.ok(columns.includes("actor"));
    const { id } = ingestSupportTicket(store);
    store.setNote(id, "after the upgrade");
    const rows = store.listActions(10);
    assert.equal(rows[0].actor, "owner");
    const oldRow = rows.find((row) => row.detail === "before the upgrade");
    assert.equal(oldRow.actor, null);
  } finally {
    store.close();
  }
});
