#!/usr/bin/env node
/**
 * Backs up Vexora Gaming: the Postgres database (pg_dump, custom format) and the uploads
 * folder. Keeps the newest KEEP backups of each and deletes older ones.
 *
 *   node scripts/vexora-backup.mjs            # back up now
 *   node scripts/vexora-backup.mjs --list     # list existing backups
 *
 * Restore a database dump (into an EMPTY database):
 *   pg_restore --clean --if-exists -h localhost -p 5433 -U <user> -d nexusforge <file>.dump
 *
 * Reads DATABASE_URL and UPLOAD_DIR from apps/server/.env. The password is passed to
 * pg_dump through the environment, never on the command line or in logs.
 * Backups go to VEXORA_BACKUP_DIR, or D:\NexusForgeDB\backups by default.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "apps/server/package.json"));
require("dotenv").config({ path: path.join(root, "apps/server/.env"), quiet: true });

const KEEP = Number(process.env.VEXORA_BACKUP_KEEP || 14);
const backupDir = process.env.VEXORA_BACKUP_DIR || "D:\\NexusForgeDB\\backups";
const pgBin = process.env.PG_BIN || "C:\\Program Files\\PostgreSQL\\17\\bin";

function list(dir, pattern) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => pattern.test(name)).sort();
}

if (process.argv.includes("--list")) {
  for (const name of list(path.join(backupDir, "db"), /\.dump$/)) {
    const size = fs.statSync(path.join(backupDir, "db", name)).size;
    console.log(`db/${name}  ${(size / 1024).toFixed(0)} KB`);
  }
  for (const name of list(path.join(backupDir, "uploads"), /^uploads-/)) console.log(`uploads/${name}`);
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 13);
fs.mkdirSync(path.join(backupDir, "db"), { recursive: true });
fs.mkdirSync(path.join(backupDir, "uploads"), { recursive: true });

// 1. Database.
const db = new URL(process.env.DATABASE_URL ?? "");
const dumpFile = path.join(backupDir, "db", `vexora-${stamp}.dump`);
const dump = spawnSync(
  path.join(pgBin, "pg_dump.exe"),
  ["-h", db.hostname, "-p", db.port || "5432", "-U", decodeURIComponent(db.username), "-d", db.pathname.slice(1), "-Fc", "-f", dumpFile],
  { env: { ...process.env, PGPASSWORD: decodeURIComponent(db.password) }, encoding: "utf8" },
);
if (dump.status !== 0) {
  console.error("[backup] database dump FAILED:", (dump.stderr || dump.error?.message || "").trim());
  process.exit(1);
}
console.log(`[backup] database -> ${dumpFile} (${(fs.statSync(dumpFile).size / 1024).toFixed(0)} KB)`);

// 2. Uploads (a dated copy; they're small today, switch to a mirror if they grow).
const uploadDir = process.env.UPLOAD_DIR;
if (uploadDir && fs.existsSync(uploadDir)) {
  const target = path.join(backupDir, "uploads", `uploads-${stamp}`);
  fs.cpSync(uploadDir, target, { recursive: true });
  console.log(`[backup] uploads -> ${target}`);
}

// 3. Keep the newest KEEP of each.
for (const name of list(path.join(backupDir, "db"), /\.dump$/).slice(0, -KEEP)) fs.rmSync(path.join(backupDir, "db", name));
for (const name of list(path.join(backupDir, "uploads"), /^uploads-/).slice(0, -KEEP)) fs.rmSync(path.join(backupDir, "uploads", name), { recursive: true, force: true });
console.log(`[backup] done (keeping the newest ${KEEP})`);
