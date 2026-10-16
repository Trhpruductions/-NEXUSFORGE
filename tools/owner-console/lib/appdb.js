"use strict";

// The app database, read only. Every checkout sets a read-only session, opens a read-only transaction,
// and only accepts a single SELECT statement. Every transaction is rolled back at the end.

const fs = require("node:fs");
const path = require("node:path");
const { loadModule } = require("./modules");
const { getDatabaseUrl, scrubText } = require("./secrets");
const { DATA_DIR } = require("./config");

// The console reads through the read-only database role (data/schema-readonly.env) when it exists, so it does not
// hold the full-privilege URL for its own reads. It falls back to DATABASE_URL only when the role file is missing.
function readOnlyRoleUrl(file = path.join(DATA_DIR, "schema-readonly.env")) {
  try {
    const match = fs.readFileSync(file, "utf8").match(/^SCHEMA_READONLY_DATABASE_URL=(.+)$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

let pool = null;

function getPool() {
  if (pool) return pool;
  const url = readOnlyRoleUrl() || getDatabaseUrl();
  if (!url) throw new Error("No database URL: add the read-only role file in data/ or DATABASE_URL in apps/server/.env");
  const { Pool } = loadModule("pg");
  pool = new Pool({
    connectionString: url,
    max: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 4000,
    statement_timeout: 8000,
    query_timeout: 8000,
    application_name: "nexusforge-owner-console",
  });
  pool.on("error", () => {
    // Idle client errors are reported by the next query that fails; never let them crash the process.
  });
  return pool;
}

function assertSelectOnly(sql) {
  const text = String(sql).trim();
  if (!/^select\b/i.test(text)) throw new Error("only SELECT statements are allowed");
  if (text.replace(/;\s*$/, "").includes(";")) throw new Error("one statement per query");
}

/** Runs one SELECT on a client that is already inside a read-only transaction. */
function select(client, sql, params = []) {
  assertSelectOnly(sql);
  return client.query(sql, params);
}

/** Runs fn(select) on one connection in a read-only session and transaction. */
async function withReadOnly(fn) {
  const client = await getPool().connect();
  let broken = false;
  try {
    await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
    await client.query("BEGIN READ ONLY");
    return await fn((sql, params) => select(client, sql, params));
  } catch (err) {
    broken = true;
    throw new Error(scrubText(err && err.message ? err.message : "query failed"));
  } finally {
    try {
      await client.query("ROLLBACK");
    } catch {
      broken = true;
    }
    client.release(broken ? true : undefined);
  }
}

async function closePool() {
  if (!pool) return;
  const current = pool;
  pool = null;
  await current.end().catch(() => {});
}

module.exports = { withReadOnly, closePool, readOnlyRoleUrl };
