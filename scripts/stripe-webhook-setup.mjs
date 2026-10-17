#!/usr/bin/env node
/**
 * node scripts/stripe-webhook-setup.mjs [https://your-domain]
 *
 * Makes sure the Stripe webhook for this app listens for every event the billing code uses. Uses STRIPE_SECRET_KEY
 * from apps/server/.env. Never prints secrets.
 *
 * - Prints the Stripe account and mode it is connected to, so you can confirm them before it changes anything.
 * - If a webhook already exists for the URL, its event list is updated in place. Stripe keeps the signing secret
 *   when only the events change, so STRIPE_WEBHOOK_SECRET stays valid and the running server needs no restart.
 * - If none exists, one is created and its signing secret is saved as STRIPE_WEBHOOK_SECRET in apps/server/.env.
 *   (Stripe only shows that secret once, at creation.)
 *
 * Defaults to APP_WEB_URL.
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

const base = (process.argv[2] || process.env.APP_WEB_URL || "").replace(/\/+$/, "");
if (!/^https:\/\//.test(base)) {
  console.error("Needs a public https address (argument or APP_WEB_URL).");
  process.exit(1);
}
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY isn't set in apps/server/.env.");
  process.exit(1);
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const url = `${base}/api/billing/webhook`;
// Must match the events applyBillingEvent() handles in apps/server/src/routes/billing.routes.ts.
const events = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid", // renewals
  "invoice.payment_failed", // failed renewals
  "charge.refunded", // refunds
  "charge.dispute.created", // disputes opened
  "charge.dispute.closed", // disputes won or lost
];

const account = await stripe.accounts.retrieve();
const mode = process.env.STRIPE_SECRET_KEY.startsWith("sk_test_") ? "test" : process.env.STRIPE_SECRET_KEY.startsWith("sk_live_") ? "live" : "unknown";
console.log(`Stripe account ${account.id}, ${mode} mode. Endpoint: ${url}`);

const existing = await stripe.webhookEndpoints.list({ limit: 100 });
const matching = existing.data.filter((entry) => entry.url === url);

if (matching.length > 0) {
  const [keep, ...extra] = matching;
  const before = new Set(keep.enabled_events);
  const updated = await stripe.webhookEndpoints.update(keep.id, { enabled_events: events });
  const added = events.filter((event) => !before.has(event));
  const removed = [...before].filter((event) => !events.includes(event));
  console.log(`Updated webhook ${updated.id} in place. Signing secret unchanged.`);
  console.log(`  added: ${added.length ? added.join(", ") : "none"}`);
  console.log(`  removed: ${removed.length ? removed.join(", ") : "none"}`);
  if (extra.length) console.log(`  note: ${extra.length} other endpoint(s) use the same URL and were left as they are.`);
  process.exit(0);
}

const created = await stripe.webhookEndpoints.create({ url, enabled_events: events, description: "Vexora Gaming billing" });

let text = fs.readFileSync(envPath, "utf8");
const eol = text.includes("\r\n") ? "\r\n" : "\n";
const line = `STRIPE_WEBHOOK_SECRET=${created.secret}`;
text = /^STRIPE_WEBHOOK_SECRET=.*$/m.test(text) ? text.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, line) : `${text.replace(/\s*$/, "")}${eol}${line}${eol}`;
fs.writeFileSync(envPath, text);
console.log(`Created webhook ${created.id} -> ${url} (${events.length} events). Signing secret saved to apps/server/.env. Restart the backend to load it.`);
