import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import { recordFailedPayment, recordRefund, recordRenewalPayment, type LooseCharge, type LooseInvoice } from "../src/lib/billing-ledger.js";
import { assertNotLiveDatabase } from "./helpers/live-database-guard.js";

// Writes test rows, so it must never run against the live database.
assertNotLiveDatabase();

const RUN = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const createdUserIds: string[] = [];

async function makeSubscriber(label: string, tier: "CORE" | "PLUS" | "ELITE" | "INFINITE" = "PLUS") {
  const userId = randomUUID();
  createdUserIds.push(userId);
  await prisma.user.create({
    data: {
      id: userId,
      username: `bl_${label}_${RUN}`.slice(0, 32),
      email: `bl_${label}_${RUN}@example.com`,
      password: "not-a-login-in-this-test",
      birthdate: new Date("1990-01-01"),
    },
  });
  const subscriptionId = `sub_bl_${label}_${RUN}`;
  await prisma.billingSubscription.create({
    data: {
      userId,
      providerCustomerId: `cus_bl_${label}_${RUN}`,
      providerSubscriptionId: subscriptionId,
      tier,
      interval: "MONTHLY",
      status: "ACTIVE",
    },
  });
  return { userId, subscriptionId };
}

function invoice(overrides: Partial<LooseInvoice> & { id: string }): LooseInvoice {
  return { billing_reason: "subscription_cycle", amount_paid: 1499, amount_due: 1499, currency: "usd", ...overrides };
}

after(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

test("a renewal the card paid is recorded as a successful Core+ payment, once", async () => {
  const { userId, subscriptionId } = await makeSubscriber("renew", "ELITE");
  const id = `in_renew_${RUN}`;

  assert.equal(await recordRenewalPayment(invoice({ id, subscription: subscriptionId })), "recorded");
  assert.equal(await recordRenewalPayment(invoice({ id, subscription: subscriptionId })), "duplicate");

  const rows = await prisma.paymentTransaction.findMany({ where: { providerPaymentId: id } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].userId, userId);
  assert.equal(rows[0].amountCents, 1499);
  assert.equal(rows[0].status, "SUCCEEDED");
  assert.equal(rows[0].featureCode, "CORE_PLUS");
  assert.equal(rows[0].tier, "ELITE");
  assert.equal(rows[0].providerEventId, `invoice:${id}`);
});

test("the first invoice of a new subscription is not recorded again: checkout already records it", async () => {
  const { subscriptionId } = await makeSubscriber("first");
  const id = `in_first_${RUN}`;
  assert.equal(await recordRenewalPayment(invoice({ id, subscription: subscriptionId, billing_reason: "subscription_create" })), "skipped");
  assert.equal(await prisma.paymentTransaction.count({ where: { providerPaymentId: id } }), 0);
});

test("a renewal for a subscription the app does not know, or for nothing paid, is skipped", async () => {
  assert.equal(await recordRenewalPayment(invoice({ id: `in_unknown_${RUN}`, subscription: `sub_nobody_${RUN}` })), "skipped");
  const { subscriptionId } = await makeSubscriber("zero");
  assert.equal(await recordRenewalPayment(invoice({ id: `in_zero_${RUN}`, subscription: subscriptionId, amount_paid: 0 })), "skipped");
});

test("a failed renewal is recorded as FAILED, and each retry of it is recorded once", async () => {
  const { subscriptionId } = await makeSubscriber("failed");
  const invoiceId = `in_failed_${RUN}`;
  assert.equal(await recordFailedPayment(`evt_1_${RUN}`, invoice({ id: invoiceId, subscription: subscriptionId, amount_due: 1499 })), "recorded");
  assert.equal(await recordFailedPayment(`evt_1_${RUN}`, invoice({ id: invoiceId, subscription: subscriptionId, amount_due: 1499 })), "duplicate");
  assert.equal(await recordFailedPayment(`evt_2_${RUN}`, invoice({ id: invoiceId, subscription: subscriptionId, amount_due: 1499 })), "recorded");

  const rows = await prisma.paymentTransaction.findMany({ where: { providerPaymentId: invoiceId, status: "FAILED" } });
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.amountCents === 1499 && row.featureCode === "CORE_PLUS"));
});

test("a full refund marks the payment REFUNDED and records the refunded amount", async () => {
  const { userId } = await makeSubscriber("refund-full");
  const intent = `pi_full_${RUN}`;
  await prisma.paymentTransaction.create({
    data: { userId, providerEventId: `checkout:cs_full_${RUN}`, providerPaymentId: intent, amountCents: 1000, status: "SUCCEEDED", featureCode: "FORGE_BOOST_PACK" },
  });

  const charge: LooseCharge = { id: `ch_full_${RUN}`, amount: 1000, amount_refunded: 1000, payment_intent: intent };
  assert.equal(await recordRefund(charge), "updated");
  assert.equal(await recordRefund(charge), "updated", "a repeated delivery applies the same cumulative total");

  const row = await prisma.paymentTransaction.findFirstOrThrow({ where: { providerPaymentId: intent } });
  assert.equal(row.status, "REFUNDED");
  assert.equal((row.metadata as { amountRefundedCents: number }).amountRefundedCents, 1000);
});

test("a partial refund keeps the payment SUCCEEDED and records only the refunded part", async () => {
  const { userId } = await makeSubscriber("refund-part");
  const intent = `pi_part_${RUN}`;
  await prisma.paymentTransaction.create({
    data: { userId, providerEventId: `checkout:cs_part_${RUN}`, providerPaymentId: intent, amountCents: 2000, status: "SUCCEEDED", featureCode: "EVENT_TICKET_PASS" },
  });

  await recordRefund({ id: `ch_part_${RUN}`, amount: 2000, amount_refunded: 500, payment_intent: intent });

  const row = await prisma.paymentTransaction.findFirstOrThrow({ where: { providerPaymentId: intent } });
  assert.equal(row.status, "SUCCEEDED");
  assert.equal((row.metadata as { amountRefundedCents: number }).amountRefundedCents, 500);
});

test("a refund matches a renewal through the invoice it was charged on", async () => {
  const { subscriptionId } = await makeSubscriber("refund-invoice");
  const invoiceId = `in_refund_${RUN}`;
  await recordRenewalPayment(invoice({ id: invoiceId, subscription: subscriptionId, amount_paid: 1499 }));

  assert.equal(await recordRefund({ id: `ch_inv_${RUN}`, amount: 1499, amount_refunded: 1499, invoice: invoiceId }), "updated");
  const row = await prisma.paymentTransaction.findFirstOrThrow({ where: { providerPaymentId: invoiceId } });
  assert.equal(row.status, "REFUNDED");
});

test("a refund for a charge the app never recorded changes nothing", async () => {
  assert.equal(await recordRefund({ id: `ch_none_${RUN}`, amount: 500, amount_refunded: 500, payment_intent: `pi_none_${RUN}` }), "unknown");
  assert.equal(await recordRefund({ id: `ch_bare_${RUN}`, amount: 500, amount_refunded: 500 }), "unknown");
});
