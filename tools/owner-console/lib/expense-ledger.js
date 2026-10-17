"use strict";

// The owner's expense records, kept in the console's own triage store (data/console.sqlite). Nothing is written to the
// app database. Every create, edit and void is kept in expense_revisions with the before and after values, and an
// expense is never deleted: a mistake is voided, and the void reason stays on record.

const { validateExpense, summarizeExpenses, utcDateText } = require("./expenses");

const EXPENSE_SCHEMA = `
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  voided INTEGER NOT NULL DEFAULT 0,
  void_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS expenses_date ON expenses (expense_date);
CREATE TABLE IF NOT EXISTS expense_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id INTEGER NOT NULL,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS expense_revisions_expense ON expense_revisions (expense_id);
`;

const OWNER = "owner";

function toRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    amountCents: row.amount_cents,
    currency: row.currency,
    expenseDate: row.expense_date,
    category: row.category,
    description: row.description,
    reference: row.reference,
    voided: row.voided === 1,
    voidReason: row.void_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function snapshot(record) {
  return JSON.stringify({
    amountCents: record.amountCents,
    currency: record.currency,
    expenseDate: record.expenseDate,
    category: record.category,
    description: record.description,
    reference: record.reference,
    voided: record.voided,
    voidReason: record.voidReason,
  });
}

class ExpenseLedger {
  constructor(db) {
    this.db = db;
    db.exec(EXPENSE_SCHEMA);
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

  get(id) {
    return toRecord(this.db.prepare("SELECT * FROM expenses WHERE id = ?").get(id));
  }

  revisions(id) {
    return this.db
      .prepare("SELECT id, at, action, actor, before_json, after_json FROM expense_revisions WHERE expense_id = ? ORDER BY id ASC")
      .all(id)
      .map((row) => ({
        id: row.id,
        at: row.at,
        action: row.action,
        actor: row.actor,
        before: row.before_json ? JSON.parse(row.before_json) : null,
        after: JSON.parse(row.after_json),
      }));
  }

  /** Checks the input, then stores it with its first revision. Returns { record } or { errors }. */
  create(input, { now = new Date(), actor = OWNER } = {}) {
    const checked = validateExpense(input, { today: utcDateText(now) });
    if (checked.errors) return checked;
    const at = now.toISOString();
    const record = this.transaction(() => {
      const result = this.db
        .prepare(`INSERT INTO expenses (amount_cents, currency, expense_date, category, description, reference, voided, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`)
        .run(checked.value.amountCents, checked.value.currency, checked.value.expenseDate, checked.value.category, checked.value.description, checked.value.reference, at, at);
      const created = this.get(Number(result.lastInsertRowid));
      this.db.prepare("INSERT INTO expense_revisions (expense_id, at, action, actor, before_json, after_json) VALUES (?, ?, 'create', ?, NULL, ?)").run(created.id, at, actor, snapshot(created));
      return created;
    });
    return { record };
  }

  /** Changes the fields sent. Refused once an expense is voided. Returns { record } or { errors } or { notFound }. */
  update(id, input, { now = new Date(), actor = OWNER } = {}) {
    const current = this.get(id);
    if (!current) return { notFound: true };
    if (current.voided) return { errors: ["A voided expense cannot be changed. Add a new one instead."] };
    const checked = validateExpense(input, { today: utcDateText(now), partial: true });
    if (checked.errors) return checked;
    const merged = { ...current, ...checked.value };
    const at = now.toISOString();
    const record = this.transaction(() => {
      this.db
        .prepare("UPDATE expenses SET amount_cents = ?, currency = ?, expense_date = ?, category = ?, description = ?, reference = ?, updated_at = ? WHERE id = ?")
        .run(merged.amountCents, merged.currency, merged.expenseDate, merged.category, merged.description, merged.reference, at, id);
      const updated = this.get(id);
      this.db.prepare("INSERT INTO expense_revisions (expense_id, at, action, actor, before_json, after_json) VALUES (?, ?, 'update', ?, ?, ?)").run(id, at, actor, snapshot(current), snapshot(updated));
      return updated;
    });
    return { record };
  }

  /** Voids an expense: it stops counting, stays listed, and the reason is kept. Returns { record } or { errors } or { notFound }. */
  void(id, reason, { now = new Date(), actor = OWNER } = {}) {
    const current = this.get(id);
    if (!current) return { notFound: true };
    if (current.voided) return { errors: ["This expense is already voided."] };
    const text = typeof reason === "string" ? reason.trim() : "";
    if (text.length < 3) return { errors: ["Give a reason of at least three characters."] };
    if (text.length > 200) return { errors: ["The reason must be 200 characters or fewer."] };
    const at = now.toISOString();
    const record = this.transaction(() => {
      this.db.prepare("UPDATE expenses SET voided = 1, void_reason = ?, updated_at = ? WHERE id = ?").run(text, at, id);
      const updated = this.get(id);
      this.db.prepare("INSERT INTO expense_revisions (expense_id, at, action, actor, before_json, after_json) VALUES (?, ?, 'void', ?, ?, ?)").run(id, at, actor, snapshot(current), snapshot(updated));
      return updated;
    });
    return { record };
  }

  /** Expenses dated within [from, to] (YYYY-MM-DD, inclusive), newest first. Voided ones are included only when asked. */
  list({ from, to, includeVoided = false, limit = 200 } = {}) {
    const rows = this.db
      .prepare(`SELECT * FROM expenses
                WHERE expense_date >= ? AND expense_date <= ? AND (? = 1 OR voided = 0)
                ORDER BY expense_date DESC, id DESC LIMIT ?`)
      .all(from || "0000-01-01", to || "9999-12-31", includeVoided ? 1 : 0, Math.min(500, limit));
    return rows.map(toRecord);
  }

  /** Totals of live (not voided) expenses dated within [from, to], grouped by category and currency. */
  summary({ from, to }) {
    const rows = this.db
      .prepare(`SELECT category, currency, COUNT(*) AS count, COALESCE(SUM(amount_cents), 0) AS cents
                FROM expenses WHERE voided = 0 AND expense_date >= ? AND expense_date <= ?
                GROUP BY category, currency`)
      .all(from, to)
      .map((row) => ({ category: row.category, currency: row.currency, count: Number(row.count), cents: Number(row.cents) }));
    return summarizeExpenses(rows);
  }
}

module.exports = { ExpenseLedger, EXPENSE_SCHEMA };
