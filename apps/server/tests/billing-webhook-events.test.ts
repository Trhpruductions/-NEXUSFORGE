import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
import { claimStripeEvent, markStripeEventApplied, releaseStripeEvent } from "../src/lib/billing-events.js";
import { applyBillingEvent } from "../src/routes/billing.routes.js";
import { assertNotLiveDatabase } from "./helpers/live-database-guard.js";

// Applies Stripe-shaped webhook events against the test database. No calls to Stripe are made.
assertNotLiveDatabase();

const RUN = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const createdUserIds: string[] = [];
let seq = 0;
const id = (label: string) => `${label}_${RUN}_${++seq}`;

function stripeEvent(type: string, object: unknown, options: { id?: string; created?: number; livemode?: boolean } = {}): Stripe.Event {
  return {
    id: options.id ?? id("evt"),
    object: "event",
    type,
    created: options.created ?? Math.floor(Date.now() / 1000),
    livemode: options.livemode ?? false,
    data: { object },
    api_version: null,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

async function makeSubscriber(label: string, tier: "CORE" | "PLUS" | "ELITE" | "INFINITE" = "PLUS") {
  const userId = randomUUID();
  createdUserIds.push(userId);
  await prisma.user.create({
    data: {
      id: userId,
      username: `we_${label}_${RUN}`.slice(0, 32),
      email: `we_${label}_${RUN}@example.com`,
      password: "not-a-login-in-this-test",
      birthdate: new Date("1990-01-01"),
      premium: true,
      premiumTier: tier,
    },
  });
  const subscriptionId = `sub_we_${label}_${RUN}`;
  await prisma.billingSubscription.create({
    data: {
      userId,
      providerCustomerId: `cus_we_${label}_${RUN}`,
      providerSubscriptionId: subscriptionId,
      tier,
      interval: "MONTHLY",
      status: "ACTIVE",
    },
  });
  return { userId, subscriptionId };
}

function subscriptionObject(subscriptionId: string, status: string, priceId = "price_unknown_in_tests") {
  return {
    id: subscriptionId,
    object: "subscription",
    status,
    cancel_at_period_end: false,
    current_period_start: Math.floor(Date.now() / 1000) - 86400,
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
    items: { data: [{ price: { id: priceId } }] },
  };
}

function invoiceObject(invoiceId: string, subscriptionId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: invoiceId,
    object: "invoice",
    billing_reason: "subscription_cycle",
    amount_paid: 1499,
    amount_due: 1499,
    currency: "usd",
    subscription: subscriptionId,
    livemode: false,
    ...overrides,
  };
}

async function paymentsFor(providerPaymentId: string) {
  return prisma.paymentTransaction.findMany({ where: { providerPaymentId } });
}

async function subscriptionStatus(subscriptionId: string) {
  return prisma.billingSubscription.findUniqueOrThrow({ where: { providerSubscriptionId: subscriptionId }, select: { status: true, tier: true, metadata: true } });
}

after(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

test("an event is claimed once: a repeated delivery is a duplicate, and a failed attempt can be retried", async () => {
  const event = stripeEvent("invoice.paid", {}, { id: id("evt_claim") });
  assert.equal(await claimStripeEvent(event), "claimed");
  assert.equal(await claimStripeEvent(event), "duplicate", "a second delivery while the first is applying is a duplicate");

  await releaseStripeEvent(event.id);
  assert.equal(await claimStripeEvent(event), "claimed", "after a failed attempt is released, Stripe's retry claims it");

  await markStripeEventApplied(event.id);
  assert.equal(await claimStripeEvent(event), "duplicate", "once applied, it is never applied again");
});

test("a successful renewal is recorded once, however many times Stripe delivers it", async () => {
  const { subscriptionId } = await makeSubscriber("renew");
  const invoice = invoiceObject(id("in_renew"), subscriptionId);
  await applyBillingEvent(stripeEvent("invoice.paid", invoice));
  await applyBillingEvent(stripeEvent("invoice.paid", invoice));
  await applyBillingEvent(stripeEvent("invoice.paid", invoice, { id: id("evt_renew_again") }));

  const rows = await paymentsFor(invoice.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "SUCCEEDED");
  assert.equal(rows[0].amountCents, 1499);
  assert.equal((rows[0].metadata as { billingReason?: string }).billingReason, "subscription_cycle");
});

test("the first invoice of a new subscription is not recorded again: checkout records it", async () => {
  const { subscriptionId } = await makeSubscriber("first");
  const invoice = invoiceObject(id("in_first"), subscriptionId, { billing_reason: "subscription_create" });
  await applyBillingEvent(stripeEvent("invoice.paid", invoice));
  assert.equal((await paymentsFor(invoice.id)).length, 0);
});

test("a failed renewal is recorded as FAILED, the subscription is past due, and a repeat of the same event adds nothing", async () => {
  const { subscriptionId } = await makeSubscriber("failed");
  const invoice = invoiceObject(id("in_failed"), subscriptionId);
  const failure = stripeEvent("invoice.payment_failed", invoice, { id: id("evt_failed"), created: Math.floor(Date.now() / 1000) });
  await applyBillingEvent(failure);
  await applyBillingEvent(failure);

  const rows = await paymentsFor(invoice.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "FAILED");
  assert.equal(rows[0].amountCents, 1499);
  assert.equal((await subscriptionStatus(subscriptionId)).status, "PAST_DUE");
});

test("a refund marks a renewal REFUNDED, and a repeated refund event changes nothing", async () => {
  const { subscriptionId } = await makeSubscriber("refund");
  const invoice = invoiceObject(id("in_refund"), subscriptionId);
  await applyBillingEvent(stripeEvent("invoice.paid", invoice));

  const refund = stripeEvent("charge.refunded", { id: id("ch_refund"), amount: 1499, amount_refunded: 1499, invoice: invoice.id });
  await applyBillingEvent(refund);
  await applyBillingEvent(refund);

  const [row] = await paymentsFor(invoice.id);
  assert.equal(row.status, "REFUNDED");
  assert.equal((row.metadata as { amountRefundedCents?: number }).amountRefundedCents, 1499);
});

test("a dispute is open money until it closes; a lost dispute is counted as money taken back", async () => {
  const { userId } = await makeSubscriber("dispute");
  const intent = id("pi_dispute");
  await prisma.paymentTransaction.create({
    data: { userId, providerEventId: id("checkout_dispute"), providerPaymentId: intent, amountCents: 2000, status: "SUCCEEDED", featureCode: "EVENT_TICKET_PASS" },
  });
  const dispute = { id: id("dp"), object: "dispute", amount: 2000, currency: "usd", status: "needs_response", reason: "fraudulent", payment_intent: intent, livemode: false };

  await applyBillingEvent(stripeEvent("charge.dispute.created", dispute));
  let [row] = await prisma.paymentTransaction.findMany({ where: { providerPaymentId: intent } });
  let metadata = row.metadata as { disputeOpenCents?: number; disputeLostCents?: number };
  assert.equal(metadata.disputeOpenCents, 2000);
  assert.equal(metadata.disputeLostCents ?? 0, 0);

  await applyBillingEvent(stripeEvent("charge.dispute.closed", { ...dispute, status: "lost" }));
  [row] = await prisma.paymentTransaction.findMany({ where: { providerPaymentId: intent } });
  metadata = row.metadata as { disputeOpenCents?: number; disputeLostCents?: number };
  assert.equal(metadata.disputeOpenCents, 0);
  assert.equal(metadata.disputeLostCents, 2000);
  assert.equal(row.status, "SUCCEEDED", "a dispute does not change the payment's own status");
});

test("an older subscription event that arrives late cannot overwrite a newer one", async () => {
  const { subscriptionId } = await makeSubscriber("late");
  const now = Math.floor(Date.now() / 1000);
  await applyBillingEvent(stripeEvent("customer.subscription.deleted", subscriptionObject(subscriptionId, "canceled"), { created: now }));
  assert.equal((await subscriptionStatus(subscriptionId)).status, "CANCELED");

  await applyBillingEvent(stripeEvent("customer.subscription.updated", subscriptionObject(subscriptionId, "active"), { created: now - 600 }));
  assert.equal((await subscriptionStatus(subscriptionId)).status, "CANCELED", "the older update must not revive the subscription");
});

test("a late payment failure does not mark a subscription past due after a newer successful event", async () => {
  const { subscriptionId } = await makeSubscriber("late-fail");
  const now = Math.floor(Date.now() / 1000);
  await applyBillingEvent(stripeEvent("customer.subscription.updated", subscriptionObject(subscriptionId, "active"), { created: now }));

  const invoice = invoiceObject(id("in_late_fail"), subscriptionId);
  await applyBillingEvent(stripeEvent("invoice.payment_failed", invoice, { created: now - 900 }));

  assert.equal((await subscriptionStatus(subscriptionId)).status, "ACTIVE");
  assert.equal((await paymentsFor(invoice.id)).length, 1, "the failed payment is still recorded");
});

test("a tier change at Stripe moves the user to the new tier", async (t) => {
  if (!env.STRIPE_PRICE_ELITE_MONTHLY) {
    t.skip("STRIPE_PRICE_ELITE_MONTHLY is not set in this environment");
    return;
  }
  const { userId, subscriptionId } = await makeSubscriber("upgrade", "PLUS");
  await applyBillingEvent(stripeEvent("customer.subscription.updated", subscriptionObject(subscriptionId, "active", env.STRIPE_PRICE_ELITE_MONTHLY)));

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { premium: true, premiumTier: true } });
  assert.equal(user.premium, true);
  assert.equal(user.premiumTier, "ELITE");
  assert.equal((await subscriptionStatus(subscriptionId)).tier, "ELITE");
});

test("a subscription the app did not sell is ignored and creates no record", async () => {
  const unknown = `sub_unknown_${RUN}`;
  await applyBillingEvent(stripeEvent("customer.subscription.created", subscriptionObject(unknown, "active")));
  assert.equal(await prisma.billingSubscription.count({ where: { providerSubscriptionId: unknown } }), 0);
});

test("renewals record the Stripe mode they were charged in", async () => {
  const { subscriptionId } = await makeSubscriber("mode");
  const live = invoiceObject(id("in_live"), subscriptionId, { livemode: true });
  await applyBillingEvent(stripeEvent("invoice.paid", live, { livemode: true }));
  const [row] = await paymentsFor(live.id);
  assert.equal((row.metadata as { livemode?: boolean }).livemode, true);
});
