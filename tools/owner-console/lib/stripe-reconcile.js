"use strict";

// Compares Stripe's records with the app's payment records for the last N days. Read only on both sides: it reads
// invoices and charges from Stripe and selects from the app database through the read-only role. It never writes.
// Only counts and Stripe object ids are reported. No names, emails or keys.

const { withReadOnly, closePool } = require("./appdb");
const { loadEnvFiles } = require("./envfiles");
const { loadModule } = require("./modules");

const DAY_S = 24 * 60 * 60;

/** Stripe, for reading. The key stays in memory in this process and is never printed. */
function stripeClient() {
  const key = loadEnvFiles().valueOf("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set in apps/server/.env");
  const Stripe = loadModule("stripe");
  return { stripe: new Stripe(key), mode: key.startsWith("sk_test_") ? "test" : key.startsWith("sk_live_") ? "live" : "unknown" };
}

async function collectAll(iterable) {
  const items = [];
  for await (const item of iterable) items.push(item);
  return items;
}

/**
 * Runs the comparison. Returns counts plus the Stripe ids that do not line up, for the owner to look at.
 * @param {{ days?: number }} options
 */
async function reconcileStripe({ days = 30 } = {}) {
  const { stripe, mode } = stripeClient();
  const since = Math.floor(Date.now() / 1000) - days * DAY_S;

  const account = await stripe.accounts.retrieve();
  const invoices = await collectAll(stripe.invoices.list({ created: { gte: since }, status: "paid", limit: 100 }));
  const charges = await collectAll(stripe.charges.list({ created: { gte: since }, limit: 100 }));
  const sessions = await collectAll(stripe.checkout.sessions.list({ created: { gte: since }, limit: 100 }));

  // Checkout payments recorded before the app keyed them by invoice or payment intent carry the session id instead.
  // The session says which invoice or payment intent it produced, so those records still line up with Stripe's charges.
  const sessionIdsByInvoice = new Map();
  const sessionIdsByIntent = new Map();
  for (const session of sessions) {
    if (typeof session.invoice === "string") sessionIdsByInvoice.set(session.invoice, [...(sessionIdsByInvoice.get(session.invoice) ?? []), session.id]);
    if (typeof session.payment_intent === "string") sessionIdsByIntent.set(session.payment_intent, [...(sessionIdsByIntent.get(session.payment_intent) ?? []), session.id]);
  }
  // Subscription checkouts have no payment intent of their own. Each one's invoice has a payment, and that payment's
  // intent is the one a charge carries, so the invoice is the link between them.
  const invoiceByIntent = new Map();
  for (const session of sessions) {
    if (typeof session.invoice !== "string" || typeof session.payment_intent === "string") continue;
    const invoicePayments = await collectAll(stripe.invoicePayments.list({ invoice: session.invoice, limit: 10 }));
    for (const entry of invoicePayments) {
      const intent = entry.payment?.payment_intent;
      if (typeof intent === "string") invoiceByIntent.set(intent, session.invoice);
    }
  }
  const invoiceOf = (charge) => (typeof charge.invoice === "string" ? charge.invoice : invoiceByIntent.get(charge.payment_intent) ?? null);
  const sessionKeysFor = (charge) => {
    const invoice = invoiceOf(charge);
    return [...(invoice ? sessionIdsByInvoice.get(invoice) ?? [] : []), ...(sessionIdsByIntent.get(charge.payment_intent) ?? [])];
  };

  const localRows = await withReadOnly(async (select) => (
    await select(
      `SELECT "providerPaymentId" AS payment_id, status::text AS status, "amountCents" AS amount_cents,
              metadata->>'amountRefundedCents' AS refunded_cents, metadata->>'livemode' AS livemode,
              "providerEventId" AS event_key
         FROM "PaymentTransaction"
        WHERE "createdAt" >= now() - ($1::int * interval '1 day') AND provider = 'STRIPE'`,
      [days],
    )
  ).rows);

  const localByPaymentId = new Map();
  for (const row of localRows) {
    if (!row.payment_id) continue;
    if (!localByPaymentId.has(row.payment_id)) localByPaymentId.set(row.payment_id, []);
    localByPaymentId.get(row.payment_id).push(row);
  }

  const findLocal = (...keys) => keys.filter(Boolean).flatMap((key) => localByPaymentId.get(key) ?? []);
  const findForCharge = (charge) => findLocal(charge.payment_intent, invoiceOf(charge), ...sessionKeysFor(charge));

  // 1. Every paid renewal Stripe charged should be a recorded successful payment with the same amount.
  const renewalInvoices = invoices.filter((inv) => inv.billing_reason === "subscription_cycle" && inv.amount_paid > 0);
  const missingRenewals = [];
  const amountMismatches = [];
  for (const invoice of renewalInvoices) {
    const rows = findLocal(invoice.id).filter((row) => row.status === "SUCCEEDED" || row.status === "REFUNDED");
    if (rows.length === 0) missingRenewals.push(invoice.id);
    else if (rows.every((row) => row.amount_cents !== invoice.amount_paid)) amountMismatches.push(invoice.id);
  }

  // 2. Every charge Stripe refunded should show the same refunded amount in the app.
  const refundMismatches = [];
  for (const charge of charges.filter((c) => c.amount_refunded > 0)) {
    const rows = findForCharge(charge);
    if (rows.length === 0) {
      refundMismatches.push({ charge: charge.id, problem: "not recorded" });
      continue;
    }
    const recorded = rows.reduce((sum, row) => sum + Number(row.refunded_cents ?? (row.status === "REFUNDED" ? row.amount_cents : 0)), 0);
    if (recorded !== charge.amount_refunded) refundMismatches.push({ charge: charge.id, problem: `stripe ${charge.amount_refunded}, app ${recorded}` });
  }

  // 3. Successful charges in Stripe that the app has no record of (checkouts and renewals).
  const succeededCharges = charges.filter((c) => c.status === "succeeded" && c.paid);
  const unrecordedCharges = succeededCharges.filter((c) => findForCharge(c).length === 0).map((c) => c.id);

  // 4. Records the app holds as successful that Stripe does not show in this window (could be older or test leftovers).
  const stripeIds = new Set([...invoices.map((i) => i.id), ...invoiceByIntent.values(), ...charges.flatMap((c) => [c.payment_intent, c.invoice]).filter(Boolean)]);
  const sessionsThatMatch = new Set(
    sessions.filter((s) => (typeof s.invoice === "string" && stripeIds.has(s.invoice)) || (typeof s.payment_intent === "string" && stripeIds.has(s.payment_intent))).map((s) => s.id),
  );
  const appOnly = localRows
    .filter((row) => row.status === "SUCCEEDED" && row.payment_id && !stripeIds.has(row.payment_id) && !sessionsThatMatch.has(row.payment_id))
    .map((row) => row.payment_id);

  // 5. Environment: a record tagged with the other mode than the key in use.
  const wrongMode = localRows.filter((row) => row.livemode !== null && row.livemode !== undefined && (row.livemode === "true") !== (mode === "live")).length;
  const untagged = localRows.filter((row) => row.livemode === null || row.livemode === undefined).length;

  return {
    checkedAt: new Date().toISOString(),
    stripeAccount: account.id,
    stripeMode: mode,
    windowDays: days,
    stripe: { paidRenewalInvoices: renewalInvoices.length, charges: charges.length, refundedCharges: charges.filter((c) => c.amount_refunded > 0).length, succeededCharges: succeededCharges.length },
    app: { paymentRecords: localRows.length },
    problems: {
      renewalsNotRecorded: missingRenewals,
      renewalAmountMismatches: amountMismatches,
      refundsDisagree: refundMismatches,
      chargesNotRecorded: unrecordedCharges,
      appRecordsWithoutStripe: appOnly,
      recordsInWrongMode: wrongMode,
      recordsWithoutModeTag: untagged,
    },
  };
}

module.exports = { reconcileStripe, closePool };
