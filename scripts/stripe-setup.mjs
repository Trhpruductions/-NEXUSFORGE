#!/usr/bin/env node
/**
 * One-time Stripe setup for Vexora Gaming Core+ (npm run stripe:setup).
 *
 * Reads STRIPE_SECRET_KEY from apps/server/.env (never printed), then creates, or reuses if
 * they already exist, the four Core+ products and their monthly/yearly prices, matching the
 * prices shown in the app. Writes the eight STRIPE_PRICE_* ids into apps/server/.env.
 *
 * Test keys (sk_test_...) only, unless you pass --live on purpose.
 * Safe to run again: prices are found by their lookup key (vexora_core_monthly, ...).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, "apps/server/.env");
const require = createRequire(path.join(root, "apps/server/package.json"));
require("dotenv").config({ path: envPath, quiet: true });
const Stripe = require("stripe");

const key = process.env.STRIPE_SECRET_KEY ?? "";
const allowLive = process.argv.includes("--live");
if (!key) {
  console.error("STRIPE_SECRET_KEY isn't set in apps/server/.env. Add your Stripe secret key there first.");
  process.exit(1);
}
if (!key.startsWith("sk_test_") && !(allowLive && key.startsWith("sk_live_"))) {
  console.error(key.startsWith("sk_live_")
    ? "That's a LIVE key. Run with --live only when you really mean to create real prices."
    : "STRIPE_SECRET_KEY doesn't look like a Stripe secret key (sk_test_... or sk_live_...).");
  process.exit(1);
}
const mode = key.startsWith("sk_live_") ? "LIVE" : "test";
const stripe = new Stripe(key);

// Must match apps/web/src/lib/pricing-catalog.ts.
const TIERS = [
  { tier: "CORE", name: "Starter Core", monthly: 399, yearly: 3900 },
  { tier: "PLUS", name: "Plus Command", monthly: 999, yearly: 9900 },
  { tier: "ELITE", name: "Elite Creator", monthly: 1999, yearly: 19900 },
  { tier: "INFINITE", name: "Infinite League", monthly: 3999, yearly: 39900 },
];

async function findPrice(lookupKey) {
  const found = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  return found.data[0] ?? null;
}

async function findOrCreateProduct(tier, name) {
  const existing = await stripe.products.search({ query: `metadata['vexora_tier']:'${tier}'`, limit: 1 }).catch(() => ({ data: [] }));
  if (existing.data[0]) return existing.data[0];
  return stripe.products.create({ name: `Vexora Core+ ${name}`, metadata: { vexora_tier: tier } });
}

const ids = {};
console.log(`Setting up Core+ prices in Stripe (${mode} mode)...`);
for (const t of TIERS) {
  let product = null;
  for (const [interval, amount] of [["MONTHLY", t.monthly], ["YEARLY", t.yearly]]) {
    const lookupKey = `vexora_${t.tier.toLowerCase()}_${interval.toLowerCase()}`;
    let price = await findPrice(lookupKey);
    if (price && price.unit_amount !== amount) {
      console.log(`  ${lookupKey}: amount changed, making a new price`);
      price = null;
    }
    if (!price) {
      product ??= await findOrCreateProduct(t.tier, t.name);
      price = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: amount,
        recurring: { interval: interval === "MONTHLY" ? "month" : "year" },
        lookup_key: lookupKey,
        transfer_lookup_key: true,
        metadata: { vexora_tier: t.tier, vexora_interval: interval },
      });
      console.log(`  created ${lookupKey}  $${(amount / 100).toFixed(2)}  ${price.id}`);
    } else {
      console.log(`  found   ${lookupKey}  $${(amount / 100).toFixed(2)}  ${price.id}`);
    }
    ids[`STRIPE_PRICE_${t.tier}_${interval}`] = price.id;
  }
}

// Write the price ids into .env (replacing old lines, keeping everything else as is).
let text = fs.readFileSync(envPath, "utf8");
const eol = text.includes("\r\n") ? "\r\n" : "\n";
for (const [name, value] of Object.entries(ids)) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  text = pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\s*$/, "")}${eol}${line}${eol}`;
}
fs.writeFileSync(envPath, text);
console.log(`\nSaved ${Object.keys(ids).length} price ids to apps/server/.env.`);
console.log("Restart the server to use them: pm2 restart nexusforge-backend-workspace --update-env");
