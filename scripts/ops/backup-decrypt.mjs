#!/usr/bin/env node
/**
 * Turns an encrypted off-site backup copy back into the original file.
 *
 *   node scripts/ops/backup-decrypt.mjs <file.enc> <output file>
 *
 * The key is read from BACKUP_ENCRYPTION_KEY (environment or apps/server/.env). Afterwards:
 *   - a database dump (vexora-*.dump):   check it with  node scripts/ops/backup-restore-check.mjs <output file>
 *                                        then restore it as described in scripts/vexora-backup.mjs
 *   - an uploads archive (uploads-*.tar): unpack with  tar -xf <output file> -C <uploads folder>
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { backupKey, decryptFile } from "../lib/backup-crypto.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
if (!process.env.BACKUP_ENCRYPTION_KEY) {
  const require = createRequire(path.join(root, "apps/server/package.json"));
  require("dotenv").config({ path: path.join(root, "apps/server/.env"), quiet: true });
}
const [source, target] = process.argv.slice(2);
if (!source || !target) {
  console.error("usage: node scripts/ops/backup-decrypt.mjs <file.enc> <output file>");
  process.exit(2);
}
if (fs.existsSync(target)) {
  console.error(`refusing to overwrite ${target}`);
  process.exit(2);
}
await decryptFile(path.resolve(source), path.resolve(target), backupKey());
console.log(`decrypted -> ${path.resolve(target)} (${(fs.statSync(target).size / 1024).toFixed(0)} KB)`);
