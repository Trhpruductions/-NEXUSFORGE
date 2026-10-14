#!/usr/bin/env node
/**
 * node scripts/stripe-webhook-setup.mjs [https://your-domain]
 *
 * Creates (or finds) the Stripe webhook that tells the app about renewals, cancellations
 * and failed payments, and saves its signing secret as STRIPE_WEBHOOK_SECRET in
 * apps/server/.env. Uses STRIPE_SECRET_KEY from that file. Never prints secrets.
 * Defaults to APP_WEB_URL. Stripe only shows a webhook's secret when it's created, so an
 * existing webhook for the same URL is replaced.
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
const events = ["checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_failed"];

const existing = await stripe.webhookEndpoints.list({ limit: 100 });
for (const endpoint of existing.data.filter((entry) => entry.url === url)) {
  await stripe.webhookEndpoints.del(endpoint.id);
  console.log(`Replaced the old webhook for ${url}`);
}
const created = await stripe.webhookEndpoints.create({ url, enabled_events: events, description: "Vexora Gaming billing" });

let text = fs.readFileSync(envPath, "utf8");
const eol = text.includes("\r\n") ? "\r\n" : "\n";
const line = `STRIPE_WEBHOOK_SECRET=${created.secret}`;
text = /^STRIPE_WEBHOOK_SECRET=.*$/m.test(text) ? text.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, line) : `${text.replace(/\s*$/, "")}${eol}${line}${eol}`;
fs.writeFileSync(envPath, text);
console.log(`Webhook ${created.id} -> ${url} (${events.length} events). Signing secret saved to apps/server/.env.`);
