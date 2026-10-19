#!/usr/bin/env node
/**
 * Proves the newest database backup can actually be restored, without touching the live database server.
 *
 *   node scripts/ops/backup-restore-check.mjs              # check the newest dump
 *   node scripts/ops/backup-restore-check.mjs <file.dump>  # check a specific dump
 *
 * What it does:
 *   1. Creates a throwaway Postgres instance in a new temporary folder (password-protected, localhost only,
 *      its own port), so the live server on 5433 is never used for the restore.
 *   2. Restores the dump into it with pg_restore and fails on any restore error.
 *   3. Counts the rows of every table in the restored copy, and compares the list of tables (read-only) with
 *      the live database, so a backup that silently misses tables is caught.
 *   4. Stops the throwaway instance and deletes its folder (it holds a copy of user data).
 *
 * Prints only table names and row counts: no credentials and no user data.
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "apps/server/package.json"));
const dotenv = require("dotenv");
const pg = require("pg");

const pgBin = process.env.PG_BIN || "C:\\Program Files\\PostgreSQL\\17\\bin";
const backupDir = process.env.VEXORA_BACKUP_DIR || "D:\\NexusForgeDB\\backups";
const port = Number(process.env.RESTORE_CHECK_PORT || 5499);
const tool = (name) => path.join(pgBin, process.platform === "win32" ? `${name}.exe` : name);

function newestDump() {
  const dir = path.join(backupDir, "db");
  const dumps = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith(".dump")).sort() : [];
  if (!dumps.length) throw new Error(`no .dump files in ${dir}`);
  return path.join(dir, dumps[dumps.length - 1]);
}

function run(cmd, args, env, { detachOutput = false } = {}) {
  // pg_ctl start leaves the new server holding any output pipe it was given, so waiting for the output would hang
  // forever: give it no pipes (its log goes to server.log).
  const result = spawnSync(cmd, args, { env: { ...process.env, ...env }, encoding: "utf8", ...(detachOutput ? { stdio: "ignore" } : {}) });
  if (result.status !== 0) {
    throw new Error(`${path.basename(cmd)} failed (${result.status}): ${(result.stderr || result.stdout || result.error?.message || "").trim().slice(0, 2000)}`);
  }
  return result;
}

async function tableCounts(client) {
  const tables = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name",
  );
  const counts = new Map();
  for (const { table_name: name } of tables.rows) {
    const { rows } = await client.query(`select count(*)::bigint as n from "public"."${name.replace(/"/g, '""')}"`);
    counts.set(name, Number(rows[0].n));
  }
  return counts;
}

const dumpFile = process.argv[2] ? path.resolve(process.argv[2]) : newestDump();
if (!fs.existsSync(dumpFile)) throw new Error(`dump not found: ${dumpFile}`);
const workDir = fs.mkdtempSync(path.join(process.env.RESTORE_CHECK_TMP || os.tmpdir(), "nfg-restore-check-"));
const dataDir = path.join(workDir, "data");
const password = crypto.randomBytes(24).toString("hex");
const pwFile = path.join(workDir, "pw.txt");
const superEnv = { PGPASSWORD: password };
let started = false;
let failed = false;

console.log(`[restore-check] dump: ${dumpFile} (${(fs.statSync(dumpFile).size / 1024).toFixed(0)} KB, made ${fs.statSync(dumpFile).mtime.toISOString()})`);
try {
  // 1. Throwaway instance with password authentication only.
  fs.writeFileSync(pwFile, password, { mode: 0o600 });
  run(tool("initdb"), ["-D", dataDir, "-U", "restorecheck", "--pwfile", pwFile, "-A", "scram-sha-256", "-E", "UTF8", "--no-instructions"]);
  fs.rmSync(pwFile, { force: true });
  run(tool("pg_ctl"), ["-D", dataDir, "-o", `-p ${port} -c listen_addresses=localhost`, "-l", path.join(workDir, "server.log"), "-w", "-t", "60", "start"], {}, { detachOutput: true });
  started = true;
  console.log(`[restore-check] throwaway Postgres started on localhost:${port}`);

  // 2. Restore. --no-owner/--no-privileges: the live roles don't exist in the throwaway instance.
  run(tool("createdb"), ["-h", "localhost", "-p", String(port), "-U", "restorecheck", "restored"], superEnv);
  const started2 = Date.now();
  run(tool("pg_restore"), ["-h", "localhost", "-p", String(port), "-U", "restorecheck", "-d", "restored", "--no-owner", "--no-privileges", "--exit-on-error", dumpFile], superEnv);
  console.log(`[restore-check] restored with no errors in ${((Date.now() - started2) / 1000).toFixed(1)} s`);

  // 3. Row counts in the copy, and the live table list for comparison (read-only).
  const copy = new pg.Client({ host: "localhost", port, user: "restorecheck", password, database: "restored" });
  await copy.connect();
  const restored = await tableCounts(copy);
  await copy.end();

  const parsed = dotenv.parse(fs.readFileSync(path.join(root, "apps/server/.env")));
  const live = new pg.Client({ connectionString: parsed.DATABASE_URL, connectionTimeoutMillis: 10000 });
  await live.connect();
  await live.query("SET default_transaction_read_only = on");
  const liveCounts = await tableCounts(live);
  await live.end();

  const missing = [...liveCounts.keys()].filter((name) => !restored.has(name));
  const extra = [...restored.keys()].filter((name) => !liveCounts.has(name));
  let rows = 0;
  console.log("\n  table                               backup rows   live rows now");
  for (const [name, n] of restored) {
    rows += n;
    console.log(`  ${name.padEnd(36)}${String(n).padStart(11)}   ${String(liveCounts.get(name) ?? "-").padStart(13)}`);
  }
  console.log(`\n[restore-check] ${restored.size} tables, ${rows} rows restored; live has ${liveCounts.size} tables.`);
  if (missing.length) {
    failed = true;
    console.log(`[restore-check] FAIL: tables in the live database but not in the backup: ${missing.join(", ")}`);
  }
  if (extra.length) console.log(`[restore-check] note: tables in the backup that the live database no longer has: ${extra.join(", ")}`);
  console.log("[restore-check] (row counts differ a little when people used the app after the backup was made)");
} catch (error) {
  failed = true;
  console.error(`[restore-check] FAIL: ${error.message}`);
} finally {
  if (started) {
    try {
      run(tool("pg_ctl"), ["-D", dataDir, "-m", "fast", "-w", "-t", "60", "stop"]);
      console.log("[restore-check] throwaway Postgres stopped");
    } catch (error) {
      console.error(`[restore-check] could not stop the throwaway instance: ${error.message}`);
    }
  }
  // The copy contains user data: remove it.
  fs.rmSync(workDir, { recursive: true, force: true });
  console.log(`[restore-check] removed ${workDir}`);
}
console.log(failed ? "[restore-check] RESULT: FAILED" : "[restore-check] RESULT: PASSED");
process.exit(failed ? 1 : 0);
