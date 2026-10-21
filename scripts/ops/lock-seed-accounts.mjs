#!/usr/bin/env node
/**
 * Locks the demo accounts created by apps/server/prisma/seed-user-groups.ts (every account with an
 * @nexusforge.local address). Their passwords were written in plain text in that file, the repository is public,
 * and several of them had staff roles (OWNER, EXEC, ADMIN, MODERATOR) with no two-factor sign-in: anyone reading
 * the repo could have signed in as them.
 *
 *   node scripts/ops/lock-seed-accounts.mjs                       # dry run against the live database
 *   node scripts/ops/lock-seed-accounts.mjs --test-db --apply     # do it on nexusforge_test
 *   node scripts/ops/lock-seed-accounts.mjs --apply               # do it on the live database (owner approval)
 *
 * For each account, in one transaction:
 *   - the password becomes a hash of 32 random bytes that are thrown away (nobody can sign in with a password);
 *   - staff powers are removed (appRole USER, isAdmin false);
 *   - every refresh token is revoked (any open session ends at its next refresh).
 * Nothing is deleted: profiles, medals and memberships stay, so the demo community still looks the same.
 * Undo for one account: an owner resets its password and role from the admin tools.
 * Prints usernames and roles only, never passwords or hashes.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const serverDir = path.join(root, "apps/server");
const require = createRequire(path.join(serverDir, "package.json"));
const pg = require("pg");
const bcrypt = require("bcryptjs");
const parsed = require("dotenv").parse(fs.readFileSync(path.join(serverDir, ".env")));

const apply = process.argv.includes("--apply");
const useTestDb = process.argv.includes("--test-db");
// LOCK_DB_URL points the script at a throwaway copy for testing (e.g. a restored backup).
const url = new URL(process.env.LOCK_DB_URL || parsed.DATABASE_URL);
if (useTestDb) url.pathname = "/nexusforge_test";
const dbName = url.pathname.slice(1);

const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 10000 });
await client.connect();
const { rows } = await client.query(
  `select id, username, "appRole" as role, "isAdmin" as admin from "User" where lower(email) like '%@nexusforge.local' order by "appRole" desc, username`,
);
console.log(`database: ${dbName}; demo accounts (@nexusforge.local): ${rows.length}; mode: ${apply ? "APPLY" : "dry run"}`);
for (const row of rows) console.log(`  ${row.username.padEnd(18)} ${row.role}${row.admin ? " +admin" : ""}`);

if (!apply) {
  console.log("\nDry run: nothing changed. Add --apply to lock these accounts.");
  await client.end();
  process.exit(0);
}

await client.query("BEGIN");
try {
  let revoked = 0;
  for (const row of rows) {
    const unusable = await bcrypt.hash(crypto.randomBytes(32).toString("base64"), 12);
    await client.query(`update "User" set password = $1, "appRole" = 'USER', "isAdmin" = false where id = $2`, [unusable, row.id]);
    const r = await client.query(`update "RefreshToken" set "revokedAt" = now() where "userId" = $1 and "revokedAt" is null`, [row.id]);
    revoked += r.rowCount;
  }
  await client.query("COMMIT");
  console.log(`\nLocked ${rows.length} accounts: passwords replaced with unusable ones, staff roles removed, ${revoked} session token(s) revoked.`);
} catch (error) {
  await client.query("ROLLBACK");
  console.error(`Nothing changed (rolled back): ${error.message}`);
  process.exitCode = 1;
}
await client.end();
