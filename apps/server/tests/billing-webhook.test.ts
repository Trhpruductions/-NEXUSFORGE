import "./helpers/env.js";
import "./helpers/stripe-test-env.js";
import { describe, it, before as beforeAll, after as afterAll } from "node:test";
import { randomUUID } from "node:crypto";
import { expect } from "./helpers/expect.js";
import { prisma } from "../src/lib/prisma.js";

// Every Stripe network call the webhook makes is stubbed below, which keeps these tests offline.
const { processStripeEvent, recordWebhookFailure } = await import("../src/lib/billing-webhook.js");
const { stripeClient } = await import("../src/lib/stripe.js");
const { getFinanceTotals } = await import("../src/lib/finance-metrics.js");
const { requireOwner } = await import("../src/middleware/owner.js");

const client = stripeClient as any;
const testRun = randomUUID().slice(0, 8);
const createdUserIds: string[] = [];
const createdEventIds: string[] = [];

type StubState = { fee: number; refunds: Array<{ id: string; amount: number; status: string }> };
const stub: StubState = { fee: 45, refunds: [] };

client.paymentIntents.retrieve = async () => ({ latest_charge: { balance_transaction: { fee: stub.fee } } });
client.refunds.list = async () => ({ data: stub.refunds.map((refund) => ({ ...refund, reason: null })) });
client.invoicePayments.list = async () => ({ data: [] });

function setLineItem(priceId: string, amountTotal: number, metadata: Record<string, string> = {}) {
  client.checkout.sessions.listLineItems = async () => ({
    data: [{ amount_total: amountTotal, price: { id: priceId, metadata } }],
  });
}

function stripeEvent(type: string, object: unknown, createdSeconds = Math.floor(Date.now() / 1000)) {
  const id = `evt_test_${testRun}_${randomUUID().slice(0, 8)}`;
  createdEventIds.push(id);
  return { id, object: "event", type, created: createdSeconds, livemode: false, data: { object } } as any;
}

async function makeUser(label: string) {
  const id = randomUUID();
  createdUserIds.push(id);
  await prisma.user.create({
    data: {
      id,
      username: `bw_${label}_${testRun}`,
      email: `bw_${label}_${testRun}@example.test`,
      password: "not-used",
      birthdate: new Date("1990-01-01"),
    },
  });
  return id;
}

function checkoutSession(overrides: Record<string, unknown>) {
  return {
    id: `cs_test_${randomUUID().slice(0, 12)}`,
    object: "checkout.session",
    mode: "payment",
    payment_status: "paid",
    amount_total: 500,
    currency: "usd",
    payment_intent: `pi_test_${randomUUID().slice(0, 12)}`,
    subscription: null,
    invoice: null,
    metadata: {},
    ...overrides,
  };
}

describe("billing webhook processing", () => {
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    userId = await makeUser("main");
    otherUserId = await makeUser("other");
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.webhookEvent.deleteMany({ where: { providerEventId: { in: createdEventIds } } });
  });

  it("grants a paid one-time add-on once, even when Stripe redelivers the event", async () => {
    setLineItem("price_boost", 500);
    const session = checkoutSession({ metadata: { userId, featureCode: "FORGE_BOOST_PACK", quantity: "2" } });
    const event = stripeEvent("checkout.session.completed", session);

    const first = await processStripeEvent(event);
    const redelivery = await processStripeEvent(event);

    expect(first.duplicate).toBe(false);
    expect(redelivery.duplicate).toBe(true);

    const entitlement = await prisma.featureEntitlement.findUnique({
      where: { userId_featureCode: { userId, featureCode: "FORGE_BOOST_PACK" } },
    });
    expect(entitlement?.quantity).toBe(2);

    const payment = await prisma.paymentTransaction.findUnique({
      where: { provider_providerPaymentId: { provider: "STRIPE", providerPaymentId: session.id } },
    });
    expect(payment?.status).toBe("SUCCEEDED");
    expect(payment?.kind).toBe("ONE_TIME");
    expect(payment?.amountCents).toBe(500);
  });

  it("does not grant a second time when a different event reports the same paid session", async () => {
    setLineItem("price_boost", 500);
    const session = checkoutSession({ metadata: { userId: otherUserId, featureCode: "FORGE_BOOST_PACK", quantity: "1" } });

    await processStripeEvent(stripeEvent("checkout.session.completed", session));
    const outcome = await processStripeEvent(stripeEvent("checkout.session.async_payment_succeeded", session));

    expect(outcome.note).toBe("Payment already recorded; grant skipped");
    const entitlement = await prisma.featureEntitlement.findUnique({
      where: { userId_featureCode: { userId: otherUserId, featureCode: "FORGE_BOOST_PACK" } },
    });
    expect(entitlement?.quantity).toBe(1);
  });

  it("records an unpaid checkout as pending and grants nothing until the async payment succeeds", async () => {
    setLineItem("price_boost", 900);
    const session = checkoutSession({ payment_status: "unpaid", amount_total: 900, metadata: { userId, featureCode: "EVENT_TICKET_PASS", quantity: "1" } });

    await processStripeEvent(stripeEvent("checkout.session.completed", session));
    const pending = await prisma.paymentTransaction.findUnique({
      where: { provider_providerPaymentId: { provider: "STRIPE", providerPaymentId: session.id } },
    });
    expect(pending?.status).toBe("PENDING");
    expect(await prisma.featureEntitlement.findUnique({ where: { userId_featureCode: { userId, featureCode: "EVENT_TICKET_PASS" } } })).toBeNull();

    const paidSession = { ...session, payment_status: "paid" };
    await processStripeEvent(stripeEvent("checkout.session.async_payment_succeeded", paidSession));
    const captured = await prisma.paymentTransaction.findUnique({
      where: { provider_providerPaymentId: { provider: "STRIPE", providerPaymentId: session.id } },
    });
    expect(captured?.status).toBe("SUCCEEDED");
    expect((await prisma.featureEntitlement.findUnique({ where: { userId_featureCode: { userId, featureCode: "EVENT_TICKET_PASS" } } }))?.quantity).toBe(1);
  });

  it("rolls back every write when a grant fails, so Stripe's retry can succeed", async () => {
    const ghostUserId = randomUUID();
    setLineItem("price_boost", 500);
    const session = checkoutSession({ metadata: { userId: ghostUserId, featureCode: "FORGE_BOOST_PACK", quantity: "1" } });
    const event = stripeEvent("checkout.session.completed", session);

    await expect(processStripeEvent(event)).rejects.toThrow();

    expect(await prisma.paymentTransaction.findUnique({
      where: { provider_providerPaymentId: { provider: "STRIPE", providerPaymentId: session.id } },
    })).toBeNull();
    expect(await prisma.webhookEvent.findUnique({ where: { providerEventId: event.id } })).toBeNull();

    await recordWebhookFailure(event, new Error("grant failed"));
    const failed = await prisma.webhookEvent.findUnique({ where: { providerEventId: event.id } });
    expect(failed?.status).toBe("FAILED");
    expect(failed?.lastError).toBe("grant failed");
  });

  it("tracks a dispute as money at risk and restores the payment when the dispute is won", async () => {
    const paymentIntentId = `pi_dispute_${testRun}`;
    const session = checkoutSession({ payment_intent: paymentIntentId, amount_total: 1200, metadata: { userId, featureCode: "TEAM_BRANDING_KIT", quantity: "1" } });
    setLineItem("price_kit", 1200);
    await processStripeEvent(stripeEvent("checkout.session.completed", session));

    const disputeId = `dp_${testRun}`;
    const dispute = { id: disputeId, object: "dispute", amount: 1200, status: "needs_response", payment_intent: paymentIntentId, reason: "fraudulent" };
    await processStripeEvent(stripeEvent("charge.dispute.created", dispute));

    let row = await prisma.paymentTransaction.findUnique({
      where: { provider_providerPaymentId: { provider: "STRIPE", providerPaymentId: session.id } },
    });
    expect(row?.status).toBe("DISPUTED");

    await processStripeEvent(stripeEvent("charge.dispute.closed", { ...dispute, status: "won" }, Math.floor(Date.now() / 1000) + 1));
    row = await prisma.paymentTransaction.findUnique({
      where: { provider_providerPaymentId: { provider: "STRIPE", providerPaymentId: session.id } },
    });
    expect(row?.status).toBe("SUCCEEDED");
    expect((await prisma.paymentDispute.findUnique({ where: { providerDisputeId: disputeId } }))?.status).toBe("WON");
  });

  it("records a full refund as REFUNDED and a partial refund without changing gross", async () => {
    const fullIntent = `pi_full_${testRun}`;
    const fullSession = checkoutSession({ payment_intent: fullIntent, amount_total: 700, metadata: { userId, featureCode: "EVENT_TICKET_PASS", quantity: "1" } });
    setLineItem("price_pass", 700);
    await processStripeEvent(stripeEvent("checkout.session.completed", fullSession));

    stub.refunds = [{ id: `re_full_${testRun}`, amount: 700, status: "succeeded" }];
    await processStripeEvent(stripeEvent("charge.refunded", { id: `ch_full_${testRun}`, object: "charge", payment_intent: fullIntent, amount: 700, amount_refunded: 700 }));

    const fullRow = await prisma.paymentTransaction.findUnique({
      where: { provider_providerPaymentId: { provider: "STRIPE", providerPaymentId: fullSession.id } },
    });
    expect(fullRow?.status).toBe("REFUNDED");
    expect(fullRow?.refundedCents).toBe(700);

    const partialIntent = `pi_partial_${testRun}`;
    const partialSession = checkoutSession({ payment_intent: partialIntent, amount_total: 1000, metadata: { userId, featureCode: "EVENT_TICKET_PASS", quantity: "1" } });
    setLineItem("price_pass", 1000);
    await processStripeEvent(stripeEvent("checkout.session.completed", partialSession));

    stub.refunds = [{ id: `re_partial_${testRun}`, amount: 250, status: "succeeded" }];
    await processStripeEvent(stripeEvent("charge.refunded", { id: `ch_partial_${testRun}`, object: "charge", payment_intent: partialIntent, amount: 1000, amount_refunded: 250 }));

    const partialRow = await prisma.paymentTransaction.findUnique({
      where: { provider_providerPaymentId: { provider: "STRIPE", providerPaymentId: partialSession.id } },
    });
    expect(partialRow?.status).toBe("SUCCEEDED");
    expect(partialRow?.refundedCents).toBe(250);
    expect(partialRow?.amountCents).toBe(1000);
    stub.refunds = [];
  });

  it("ignores a subscription update that is older than the one already applied", async () => {
    const subscriptionId = `sub_test_${testRun}`;
    const newer = Math.floor(Date.now() / 1000);
    await prisma.billingSubscription.create({
      data: {
        userId,
        providerCustomerId: `cus_${testRun}`,
        providerSubscriptionId: subscriptionId,
        tier: "PLUS",
        interval: "MONTHLY",
        status: "ACTIVE",
        providerEventCreatedAt: new Date(newer * 1000),
      },
    });

    const staleCancel = {
      id: subscriptionId,
      object: "subscription",
      customer: `cus_${testRun}`,
      status: "canceled",
      cancel_at_period_end: false,
      items: { data: [{ price: { id: "price_unknown" }, current_period_start: newer, current_period_end: newer + 2_592_000 }] },
    };
    const outcome = await processStripeEvent(stripeEvent("customer.subscription.deleted", staleCancel, newer - 60));

    expect(outcome.note).toBe("Stale subscription event ignored (a newer one was already applied)");
    expect((await prisma.billingSubscription.findUnique({ where: { providerSubscriptionId: subscriptionId } }))?.status).toBe("ACTIVE");
  });

  it("keeps the finance totals equal to the sum of the verified rows", async () => {
    const totals = await getFinanceTotals({ start: null, end: null }, true);
    const captured = await prisma.paymentTransaction.aggregate({
      where: { livemode: true, status: { in: ["SUCCEEDED", "REFUNDED", "DISPUTED"] } },
      _sum: { amountCents: true },
    });
    const pending = await prisma.paymentTransaction.aggregate({
      where: { livemode: true, status: "PENDING" },
      _sum: { amountCents: true },
    });
    const refunds = await prisma.paymentRefund.aggregate({
      where: { transaction: { livemode: true } },
      _sum: { amountCents: true },
    });

    expect(totals.grossCents).toBe(captured._sum.amountCents ?? 0);
    expect(totals.refundCents).toBe(refunds._sum.amountCents ?? 0);
    expect(totals.pendingCents).toBe(pending._sum.amountCents ?? 0);
    expect(totals.netCents).toBe(totals.grossCents - totals.refundCents - totals.lostDisputeCents - totals.feeCents);
  });
});

describe("owner-only gate", () => {
  function fakeResponse() {
    const response: { statusCode?: number; body?: unknown; status: (code: number) => any; json: (body: unknown) => any } = {
      status(code: number) {
        response.statusCode = code;
        return response;
      },
      json(body: unknown) {
        response.body = body;
        return response;
      },
    };
    return response;
  }

  it("rejects ADMIN and EXEC accounts from owner-only financial data", async () => {
    for (const appRole of ["ADMIN", "EXEC"] as const) {
      const id = await makeUser(`gate_${appRole.toLowerCase()}`);
      await prisma.user.update({ where: { id }, data: { appRole } });
      const res = fakeResponse();
      let reached = false;
      await requireOwner({ user: { id } } as any, res as any, () => { reached = true; });
      expect(reached).toBe(false);
      expect(res.statusCode).toBe(403);
    }
  });

  it("lets the OWNER account through", async () => {
    const id = await makeUser("gate_owner");
    await prisma.user.update({ where: { id }, data: { appRole: "OWNER" } });
    const res = fakeResponse();
    let reached = false;
    await requireOwner({ user: { id } } as any, res as any, () => { reached = true; });
    expect(reached).toBe(true);
  });

  it("rejects an OWNER account that has been suspended", async () => {
    const id = await makeUser("gate_suspended");
    await prisma.user.update({ where: { id }, data: { appRole: "OWNER", suspendedAt: new Date() } });
    const res = fakeResponse();
    let reached = false;
    await requireOwner({ user: { id } } as any, res as any, () => { reached = true; });
    expect(reached).toBe(false);
    expect(res.statusCode).toBe(403);
  });
});
