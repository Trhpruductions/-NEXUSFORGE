"use strict";

// Classifies the SQL printed by `prisma migrate diff --script`. Nothing is applied from here.
//
// Status, from most serious to least:
//   unknown       the check did not run to a clean finish, was a dry run, was cut off, or its output cannot be read.
//                 It is never shown as "in sync".
//   destructive   a DROP appears anywhere in a statement, including inside an ALTER that also adds a column.
//   not_additive  a change that is not a pure addition: RENAME, ALTER COLUMN, SET NOT NULL, a NOT NULL column
//                 without a DEFAULT, or any statement that is not CREATE or ALTER.
//   additive      only new tables, columns, indexes, enum values or constraints. Applying is still a manual step.
//   in_sync       the check ran cleanly and printed Prisma's "empty migration" marker.

const EMPTY_MARKER = /This is an empty migration/i;

function isAdditiveAlter(statement) {
  if (/\bDROP\b/i.test(statement)) return false;
  if (/\bRENAME\b/i.test(statement) || /\bALTER\s+COLUMN\b/i.test(statement) || /\bSET\s+NOT\s+NULL\b/i.test(statement)) return false;
  if (!/ADD\s+(COLUMN|CONSTRAINT|VALUE)\b/i.test(statement)) return false;
  if (/ADD\s+COLUMN/i.test(statement) && /NOT\s+NULL/i.test(statement) && !/DEFAULT/i.test(statement)) return false;
  return true;
}

function result(status, verdict, counts, notes = [], exitCode = null) {
  return {
    status,
    additive: status === "in_sync" || status === "additive",
    statementCount: counts.statementCount,
    creates: counts.creates,
    drops: counts.drops,
    alters: counts.alters,
    alterNotAdditive: counts.alterNotAdditive,
    others: counts.others,
    unreadable: counts.unreadable,
    exitCode,
    verdict,
    notes: notes.slice(0, 40),
  };
}

const EMPTY_COUNTS = { statementCount: 0, creates: 0, drops: 0, alters: 0, alterNotAdditive: 0, others: 0, unreadable: 0 };

function classifySchemaSql(sql, { exitCode, dryRun = false, truncated = false } = {}) {
  const text = String(sql || "");
  if (dryRun) {
    return result("unknown", "Not checked: this was a dry run, so the command was printed and never run.", EMPTY_COUNTS, [], exitCode ?? null);
  }
  if (exitCode !== 0) {
    const shown = exitCode === undefined || exitCode === null ? "none" : String(exitCode);
    return result("unknown", `Not verified: the check did not finish cleanly (exit code ${shown}). Its output cannot be used to conclude anything.`, EMPTY_COUNTS, [], exitCode ?? null);
  }
  if (truncated) {
    return result("unknown", "Not verified: the output was cut off before the end, so it cannot be read in full.", EMPTY_COUNTS, [], exitCode);
  }

  const code = text
    .split(/\r?\n/)
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
  const statements = code
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  const counts = { ...EMPTY_COUNTS, statementCount: statements.length };
  const notes = [];
  for (const statement of statements) {
    const firstLine = statement.split("\n")[0].slice(0, 120);
    if (/\bDROP\b/i.test(statement)) {
      counts.drops += 1;
      notes.push(`DROP: ${firstLine}`);
    }
    if (/^CREATE\s/i.test(statement)) {
      counts.creates += 1;
    } else if (/^ALTER\s/i.test(statement)) {
      counts.alters += 1;
      if (!isAdditiveAlter(statement)) {
        counts.alterNotAdditive += 1;
        notes.push(`Not additive: ${firstLine}`);
      }
    } else if (/^(DROP|UPDATE|INSERT|DELETE|TRUNCATE|GRANT|REVOKE|COMMENT|RENAME)\b/i.test(statement)) {
      if (!/^DROP\s/i.test(statement)) {
        counts.others += 1;
        notes.push(`Other statement: ${firstLine}`);
      }
    } else {
      // Not SQL this check is known to print. Treat the whole output as unreadable rather than guess.
      counts.unreadable += 1;
      notes.push(`Unrecognised text: ${firstLine}`);
    }
  }

  if (statements.length === 0) {
    if (EMPTY_MARKER.test(text)) {
      return result("in_sync", "In sync: the check ran cleanly and found no differences. Nothing to apply.", counts, [], exitCode);
    }
    return result("unknown", "Not verified: the check printed no statements and no recognizable confirmation, so the schema state is unknown.", counts, [], exitCode);
  }
  if (counts.drops > 0) {
    return result("destructive", "Destructive: this contains DROP. Do not apply anything without reviewing every line.", counts, notes, exitCode);
  }
  if (counts.unreadable > 0) {
    return result("unknown", "Not verified: part of the output is not SQL this check recognises, so it cannot be classified.", counts, notes, exitCode);
  }
  if (counts.alterNotAdditive > 0 || counts.others > 0) {
    return result("not_additive", "Review needed: this contains changes that are not pure additions (for example RENAME, ALTER COLUMN, or a NOT NULL column without a default).", counts, notes, exitCode);
  }
  return result("additive", "Additive: only new tables, columns, indexes, enum values or constraints. Applying is still a manual step that needs your approval.", counts, notes, exitCode);
}

module.exports = { classifySchemaSql, isAdditiveAlter };
