#!/usr/bin/env node
/**
 * node scripts/rehome-urls.mjs <old-origin> <new-origin>
 *
 * When the app's public address changes (a new quick-tunnel address, or moving to a real
 * domain), links to uploaded files saved with the old address would break. This rewrites
 * the old origin to the new one in every text/JSON column of the database, skipping
 * anything that looks like a secret (passwords, tokens, hashes). Prints counts only.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const [from, to] = process.argv.slice(2).map((value) => (value ?? "").replace(/\/+$/, ""));
const isOrigin = (value) => /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(value);
if (!isOrigin(from) || !isOrigin(to) || from === to) {
  console.log("[rehome] nothing to do");
  process.exit(0);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "apps/server/package.json"));
require("dotenv").config({ path: path.join(root, "apps/server/.env"), quiet: true });
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const quote = (name) => `"${name.replace(/"/g, '""')}"`;
try {
  const columns = await db.$queryRawUnsafe(`
    SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type IN ('text', 'character varying', 'json', 'jsonb', 'ARRAY')
      AND table_name NOT LIKE '\\_prisma%'
      AND column_name !~* '(password|secret|token|hash|salt|key)'`);
  let total = 0;
  for (const { table_name: table, column_name: column, data_type: type } of columns) {
    const col = `${quote(table)}.${quote(column)}`;
    let sql;
    if (type === "json" || type === "jsonb") {
      sql = `UPDATE ${quote(table)} SET ${quote(column)} = replace(${col}::text, $1, $2)::${type} WHERE ${col}::text LIKE '%' || $1 || '%'`;
    } else if (type === "ARRAY") {
      sql = `UPDATE ${quote(table)} SET ${quote(column)} = (SELECT array_agg(replace(v, $1, $2)) FROM unnest(${col}) AS v) WHERE array_to_string(${col}, ' ') LIKE '%' || $1 || '%'`;
    } else {
      sql = `UPDATE ${quote(table)} SET ${quote(column)} = replace(${col}, $1, $2) WHERE ${col} LIKE '%' || $1 || '%'`;
    }
    try {
      const changed = await db.$executeRawUnsafe(sql, from, to);
      if (changed) console.log(`[rehome] ${table}.${column}: ${changed}`);
      total += changed;
    } catch (error) {
      // e.g. an array of a non-text type; skip it.
      if (!/function|operator|does not exist|cannot cast/i.test(String(error?.message))) throw error;
    }
  }
  console.log(`[rehome] ${total} value(s) moved from ${from} to ${to}`);
} finally {
  await db.$disconnect();
}
