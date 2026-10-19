#!/usr/bin/env node
/**
 * One-time setup for the encrypted off-site backup copy (see docs/BACKUP-AND-RECOVERY.md).
 *
 *   node scripts/ops/setup-offsite-backup.mjs                 # OneDrive\NexusForge Backups
 *   node scripts/ops/setup-offsite-backup.mjs "<other folder>"
 *
 * - Creates the folder (default: "NexusForge Backups" in this user's OneDrive).
 * - Adds BACKUP_OFFSITE_DIR to apps/server/.env.
 * - If no BACKUP_ENCRYPTION_KEY exists yet, generates one, adds it to apps/server/.env and shows it ONCE so it
 *   can be saved in a password manager. An existing key is never replaced: copies already made with it would
 *   become unreadable.
 * Run it in your own terminal: the key is meant for your eyes and your password manager only.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// NF_ENV_FILE lets the script be tried on a throwaway file first.
const envFile = process.env.NF_ENV_FILE || path.join(root, "apps/server/.env");
const oneDrive = process.env.OneDrive || process.env.OneDriveConsumer || process.env.OneDriveCommercial;
const target = path.resolve(process.argv[2] || (oneDrive ? path.join(oneDrive, "NexusForge Backups") : ""));
if (!process.argv[2] && !oneDrive) {
  console.error("OneDrive isn't set up for this Windows user. Pass a folder: node scripts/ops/setup-offsite-backup.mjs <folder>");
  process.exit(2);
}
if (!fs.existsSync(envFile)) {
  console.error(`Not found: ${envFile}`);
  process.exit(2);
}

const text = fs.readFileSync(envFile, "utf8");
const eol = text.includes("\r\n") ? "\r\n" : "\n";
const has = (name) => new RegExp(`^\\s*${name}\\s*=\\s*\\S`, "m").test(text);
const lines = [];

fs.mkdirSync(target, { recursive: true });
if (has("BACKUP_OFFSITE_DIR")) {
  console.log("BACKUP_OFFSITE_DIR is already set in apps/server/.env: left unchanged.");
} else {
  lines.push(`BACKUP_OFFSITE_DIR=${target}`);
}

let newKey = null;
if (has("BACKUP_ENCRYPTION_KEY")) {
  console.log("BACKUP_ENCRYPTION_KEY is already set: kept (a new key would make existing copies unreadable).");
} else {
  newKey = crypto.randomBytes(32).toString("base64");
  lines.push(`BACKUP_ENCRYPTION_KEY=${newKey}`);
}

if (lines.length) {
  const block = [
    "",
    "# Encrypted off-site backup copies, written by the nightly backup (scripts/vexora-backup.mjs).",
    "# Keep a copy of BACKUP_ENCRYPTION_KEY in a password manager: without it the copies can't be restored.",
    ...lines,
    "",
  ].join(eol);
  fs.appendFileSync(envFile, (text.endsWith("\n") ? "" : eol) + block);
}

console.log(`\nOff-site folder: ${target}`);
if (newKey) {
  console.log("\n================================================================================");
  console.log(" BACKUP ENCRYPTION KEY - save this in your password manager NOW.");
  console.log(" It is shown only this once. Without it the OneDrive copies cannot be restored.");
  console.log("--------------------------------------------------------------------------------");
  console.log(` ${newKey}`);
  console.log("================================================================================\n");
}
console.log("Done. The nightly backup (04:00) will now also write an encrypted copy to that folder.");
