"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const { ExpenseLedger } = require("../lib/expense-ledger");

// Each test gets its own throwaway SQLite file, so nothing touches the console's real triage store.
function openLedger() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "expense-ledger-"));
  const db = new DatabaseSync(path.join(dir, "test.sqlite"));
  const ledger = new ExpenseLedger(db);
  return { ledger, db, dir, close: () => db.close() };
}

const NOW = new Date("2026-10-16T12:00:00Z");
const HOSTING = { amount: "20.00", date: "2026-10-10", category: "HOSTING", description: "Server rent" };

test("an expense is stored with a first revision that records who created it", () => {
  const { ledger, db, close } = openLedger();
  try {
    const { record } = ledger.create(HOSTING, { now: NOW });
    assert.equal(record.amountCents, 2000);
    assert.equal(record.currency, "USD");
    assert.equal(record.voided, false);
    const revisions = ledger.revisions(record.id);
    assert.equal(revisions.length, 1);
    assert.equal(revisions[0].action, "create");
    assert.equal(revisions[0].actor, "owner");
    assert.equal(revisions[0].before, null);
    assert.equal(revisions[0].after.amountCents, 2000);
  } finally {
    close();
  }
});

test("an invalid expense is refused and nothing is stored", () => {
  const { ledger, db, close } = openLedger();
  try {
    const result = ledger.create({ ...HOSTING, amount: "-5" }, { now: NOW });
    assert.ok(result.errors);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM expenses").get().n, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM expense_revisions").get().n, 0);
  } finally {
    close();
  }
});

test("an edit keeps the before and after values in the revision history", () => {
  const { ledger, close } = openLedger();
  try {
    const { record } = ledger.create(HOSTING, { now: NOW });
    const updated = ledger.update(record.id, { amount: "25.50", description: "Server rent, October" }, { now: NOW });
    assert.equal(updated.record.amountCents, 2550);
    const revisions = ledger.revisions(record.id);
    assert.deepEqual(revisions.map((r) => r.action), ["create", "update"]);
    assert.equal(revisions[1].before.amountCents, 2000);
    assert.equal(revisions[1].after.amountCents, 2550);
    assert.equal(revisions[1].after.description, "Server rent, October");
  } finally {
    close();
  }
});

test("a voided expense stops counting, stays listed when asked, keeps its reason, and cannot be edited", () => {
  const { ledger, close } = openLedger();
  try {
    const { record } = ledger.create(HOSTING, { now: NOW });
    ledger.create({ ...HOSTING, amount: "5.00", category: "SOFTWARE" }, { now: NOW });
    assert.equal(ledger.summary({ from: "2026-10-01", to: "2026-10-31" }).usdCents, 2500);

    const voided = ledger.void(record.id, "Entered twice", { now: NOW });
    assert.equal(voided.record.voided, true);
    assert.equal(voided.record.voidReason, "Entered twice");

    assert.equal(ledger.summary({ from: "2026-10-01", to: "2026-10-31" }).usdCents, 500);
    assert.equal(ledger.list({ from: "2026-10-01", to: "2026-10-31" }).length, 1);
    assert.equal(ledger.list({ from: "2026-10-01", to: "2026-10-31", includeVoided: true }).length, 2);

    assert.match(ledger.update(record.id, { amount: "1.00" }, { now: NOW }).errors[0], /cannot be changed/);
    assert.match(ledger.void(record.id, "again", { now: NOW }).errors[0], /already voided/);
    assert.equal(ledger.revisions(record.id).at(-1).action, "void");
  } finally {
    close();
  }
});

test("a void needs a real reason", () => {
  const { ledger, close } = openLedger();
  try {
    const { record } = ledger.create(HOSTING, { now: NOW });
    assert.match(ledger.void(record.id, "no", { now: NOW }).errors[0], /at least three/);
    assert.match(ledger.void(record.id, "x".repeat(201), { now: NOW }).errors[0], /200 characters/);
    assert.equal(ledger.get(record.id).voided, false);
  } finally {
    close();
  }
});

test("unknown expenses are reported as not found, never created", () => {
  const { ledger, close } = openLedger();
  try {
    assert.deepEqual(ledger.update(999, { amount: "1" }, { now: NOW }), { notFound: true });
    assert.deepEqual(ledger.void(999, "reason here", { now: NOW }), { notFound: true });
    assert.equal(ledger.get(999), null);
  } finally {
    close();
  }
});

test("the summary groups by category and currency, and only counts dates inside the range", () => {
  const { ledger, close } = openLedger();
  try {
    ledger.create(HOSTING, { now: NOW });
    ledger.create({ ...HOSTING, amount: "1.00", category: "PROCESSING_FEES", reference: "stmt-2026-10" }, { now: NOW });
    ledger.create({ ...HOSTING, amount: "9.00", currency: "eur", category: "MARKETING", date: "2026-09-30" }, { now: NOW });
    ledger.create({ ...HOSTING, amount: "4.00", category: "OTHER", date: "2026-10-01" }, { now: NOW });

    const october = ledger.summary({ from: "2026-10-01", to: "2026-10-31" });
    assert.equal(october.operatingCents, 2000 + 400);
    assert.equal(october.feeCents, 100);
    assert.equal(october.feeCount, 1);
    assert.equal(october.otherCurrencyCount, 0);
    assert.equal(october.usdCents, 2500);

    const withEuro = ledger.summary({ from: "2026-09-01", to: "2026-09-30" });
    assert.equal(withEuro.operatingCents, 0);
    assert.equal(withEuro.otherCurrencyCount, 1);
    assert.equal(withEuro.byCurrency.EUR.cents, 900);
  } finally {
    close();
  }
});

test("the list is newest first and includes the reference", () => {
  const { ledger, close } = openLedger();
  try {
    ledger.create({ ...HOSTING, date: "2026-10-01", reference: "first" }, { now: NOW });
    ledger.create({ ...HOSTING, date: "2026-10-12", reference: "second" }, { now: NOW });
    const rows = ledger.list({ from: "2026-10-01", to: "2026-10-31" });
    assert.deepEqual(rows.map((r) => r.reference), ["second", "first"]);
  } finally {
    close();
  }
});

test("the store can be opened again and keeps its expenses", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "expense-reopen-"));
  const file = path.join(dir, "test.sqlite");
  const first = new DatabaseSync(file);
  new ExpenseLedger(first).create(HOSTING, { now: NOW });
  first.close();
  const second = new DatabaseSync(file);
  try {
    assert.equal(new ExpenseLedger(second).list({ from: "2026-10-01", to: "2026-10-31" }).length, 1);
  } finally {
    second.close();
  }
});
