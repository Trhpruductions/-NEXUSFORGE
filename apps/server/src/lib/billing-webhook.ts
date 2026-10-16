import type Stripe from "stripe";
import { BillingStatus, DisputeStatus, Prisma, PaymentKind, PaymentStatus } from "@prisma/client";
import type { BillingInterval, PaidFeatureCode, PremiumTier } from "@prisma/client";
import { prisma } from "./prisma.js";
import { EconomyAuthority } from "./economy-authority.js";
import { resolveIntervalFromPriceId, resolveTierFromPriceId, stripeClient } from "./stripe.js";

/**
 * Stripe webhook processing.
 *
 * Each delivery runs in three steps:
 *  1. enrich: fetch anything we need from Stripe (line items, subscriptions, fees, refunds).
 *     Network calls stay outside the database transaction.
 *  2. apply: every database write for the event runs in one serializable transaction, together
 *     with the WebhookEvent ledger row. If anything throws, the whole event rolls back and the
 *     route returns 500 so Stripe retries it.
 *  3. A PROCESSED ledger row is only committed alongside the writes it describes, so a redelivered
 *     event is a no-op. Failures are recorded in the ledger outside the rolled-back transaction.
 *
 * Revenue is recognised only from events that carry a paid status. Checkout creation, redirects and
 * client confirmations never write to PaymentTransaction.
 */

const CAPTURED_STATUSES: readonly PaymentStatus[] = [PaymentStatus.SUCCEEDED, PaymentStatus.REFUNDED, PaymentStatus.DISPUTED];
const ACTIVE_BILLING_STATUSES: readonly BillingStatus[] = [BillingStatus.ACTIVE, BillingStatus.TRIALING, BillingStatus.PAST_DUE];

type Tx = Prisma.TransactionClient;

type Enriched =
  | { kind: "checkout"; event: Stripe.CheckoutSessionCompletedEvent | Stripe.CheckoutSessionAsyncPaymentSucceededEvent; session: Stripe.Checkout.Session; priceId: string | null; lineAmountCents: number | null; coinAmount: number | null; subscription: Stripe.Subscription | null; paymentIntentId: string | null; feeCents: number | null }
  | { kind: "checkout_failed"; event: Stripe.CheckoutSessionAsyncPaymentFailedEvent; session: Stripe.Checkout.Session }
  | { kind: "invoice"; event: Stripe.InvoicePaidEvent | Stripe.InvoicePaymentFailedEvent; invoice: Stripe.Invoice; subscriptionId: string | null; paymentIntentId: string | null; feeCents: number | null; paid: boolean }
  | { kind: "subscription"; event: Stripe.CustomerSubscriptionUpdatedEvent | Stripe.CustomerSubscriptionDeletedEvent; subscription: Stripe.Subscription }
  | { kind: "refund"; event: Stripe.ChargeRefundedEvent; charge: Stripe.Charge; paymentIntentId: string | null; refunds: Stripe.Refund[] }
  | { kind: "dispute"; event: Stripe.ChargeDisputeCreatedEvent | Stripe.ChargeDisputeUpdatedEvent | Stripe.ChargeDisputeClosedEvent; dispute: Stripe.Dispute; paymentIntentId: string | null }
  | { kind: "ignored"; event: Stripe.Event };

export type WebhookOutcome = { duplicate: boolean; note: string | null };

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Subscription period dates moved from the subscription to its items in current Stripe API versions. */
export function readSubscriptionPeriod(subscription: Stripe.Subscription): { start: Date | null; end: Date | null } {
  const item = subscription.items.data[0] as { current_period_start?: number; current_period_end?: number } | undefined;
  const legacy = subscription as unknown as { current_period_start?: number; current_period_end?: number };
  const start = item?.current_period_start ?? legacy.current_period_start;
  const end = item?.current_period_end ?? legacy.current_period_end;
  return {
    start: typeof start === "number" ? new Date(start * 1000) : null,
    end: typeof end === "number" ? new Date(end * 1000) : null,
  };
}

export function mapSubscriptionStatus(status: Stripe.Subscription.Status): BillingStatus {
  switch (status) {
    case "active":
      return BillingStatus.ACTIVE;
    case "trialing":
      return BillingStatus.TRIALING;
    case "canceled":
      return BillingStatus.CANCELED;
    case "incomplete_expired":
      return BillingStatus.EXPIRED;
    default:
      // past_due, unpaid, incomplete and paused all keep access in question until Stripe resolves them.
      return BillingStatus.PAST_DUE;
  }
}

export function mapDisputeStatus(status: Stripe.Dispute.Status): DisputeStatus {
  switch (status) {
    case "won":
    case "prevented":
    case "warning_closed":
      return DisputeStatus.WON;
    case "lost":
      return DisputeStatus.LOST;
    default:
      return DisputeStatus.OPEN;
  }
}

async function fetchFeeCents(paymentIntentId: string | null): Promise<number | null> {
  if (!stripeClient || !paymentIntentId) return null;
  try {
    const intent = await stripeClient.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });
    const charge = intent.latest_charge;
    if (!charge || typeof charge === "string") return null;
    const balance = charge.balance_transaction;
    if (!balance || typeof balance === "string") return null;
    return balance.fee;
  } catch (error) {
    // The fee is informational. A Stripe read failure must not block recording the payment.
    console.warn("billing webhook: fee lookup failed", paymentIntentId, error);
    return null;
  }
}

async function fetchInvoicePaymentIntent(invoiceId: string): Promise<string | null> {
  if (!stripeClient) return null;
  const payments = await stripeClient.invoicePayments.list({ invoice: invoiceId, limit: 10 });
  for (const invoicePayment of payments.data) {
    if (invoicePayment.payment.type === "payment_intent") {
      const intentId = idOf(invoicePayment.payment.payment_intent ?? null);
      if (intentId) return intentId;
    }
  }
  return null;
}

async function enrich(event: Stripe.Event): Promise<Enriched> {
  if (!stripeClient) {
    throw new Error("Stripe client is not configured");
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      // Payments that are not paid yet are recorded as PENDING by the apply step and never granted.
      if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
        return { kind: "checkout", event, session, priceId: null, lineAmountCents: null, coinAmount: null, subscription: null, paymentIntentId: null, feeCents: null };
      }

      const lineItems = await stripeClient.checkout.sessions.listLineItems(session.id, { limit: 1, expand: ["data.price"] });
      const firstItem = lineItems.data[0];
      const priceId = firstItem?.price?.id ?? null;
      const coinRaw = firstItem?.price?.metadata?.coin_amount;
      const coinAmount = coinRaw && /^\d+$/.test(coinRaw) ? Number(coinRaw) : null;

      const subscriptionId = idOf(session.subscription);
      const subscription = subscriptionId ? await stripeClient.subscriptions.retrieve(subscriptionId) : null;

      let paymentIntentId = idOf(session.payment_intent);
      if (!paymentIntentId && session.invoice) {
        paymentIntentId = await fetchInvoicePaymentIntent(idOf(session.invoice)!);
      }

      return {
        kind: "checkout",
        event,
        session,
        priceId,
        lineAmountCents: firstItem?.amount_total ?? null,
        coinAmount,
        subscription,
        paymentIntentId,
        feeCents: await fetchFeeCents(paymentIntentId),
      };
    }

    case "checkout.session.async_payment_failed":
      return { kind: "checkout_failed", event, session: event.data.object };

    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription ?? null);
      const paid = event.type === "invoice.paid";
      const paymentIntentId = paid ? await fetchInvoicePaymentIntent(invoice.id) : null;
      return {
        kind: "invoice",
        event,
        invoice,
        subscriptionId,
        paymentIntentId,
        feeCents: paid ? await fetchFeeCents(paymentIntentId) : null,
        paid,
      };
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return { kind: "subscription", event, subscription: event.data.object };

    case "charge.refunded": {
      const charge = event.data.object;
      const paymentIntentId = idOf(charge.payment_intent);
      const refunds = await stripeClient.refunds.list({ charge: charge.id, limit: 100 });
      return { kind: "refund", event, charge, paymentIntentId, refunds: refunds.data };
    }

    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed":
      return { kind: "dispute", event, dispute: event.data.object, paymentIntentId: idOf(event.data.object.payment_intent) };

    default:
      return { kind: "ignored", event };
  }
}

type PaymentWrite = {
  eventId: string;
  providerPaymentId: string;
  userId: string;
  kind: PaymentKind;
  featureCode: PaidFeatureCode;
  tier: PremiumTier | null;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  paymentIntentId: string | null;
  subscriptionId: string | null;
  feeCents: number | null;
  metadata: Prisma.InputJsonObject;
};

/**
 * Creates or advances the PaymentTransaction for one provider payment. Captured money is never
 * moved back to PENDING or FAILED, and `transitionedToSucceeded` is true only the first time a
 * payment is captured, so grants like add-on quantities run once.
 */
async function writePayment(tx: Tx, write: PaymentWrite) {
  const existing = await tx.paymentTransaction.findUnique({
    where: { provider_providerPaymentId: { provider: "STRIPE", providerPaymentId: write.providerPaymentId } },
  });

  const wasCaptured = existing ? CAPTURED_STATUSES.includes(existing.status) : false;
  const status = wasCaptured && write.status !== PaymentStatus.SUCCEEDED ? existing!.status : write.status;

  const data = {
    providerEventId: write.eventId,
    kind: write.kind,
    featureCode: write.featureCode,
    tier: write.tier,
    status,
    amountCents: write.amountCents,
    currency: write.currency,
    providerPaymentIntentId: write.paymentIntentId ?? existing?.providerPaymentIntentId ?? null,
    providerSubscriptionId: write.subscriptionId ?? existing?.providerSubscriptionId ?? null,
    feeCents: write.feeCents ?? existing?.feeCents ?? null,
    metadata: write.metadata,
  };

  const row = existing
    ? await tx.paymentTransaction.update({ where: { id: existing.id }, data })
    : await tx.paymentTransaction.create({
        data: { ...data, provider: "STRIPE", providerPaymentId: write.providerPaymentId, userId: write.userId },
      });

  return { row, transitionedToSucceeded: !wasCaptured && row.status === PaymentStatus.SUCCEEDED };
}

/** Recomputes a payment's status from its refunds and disputes after a refund or dispute event. */
async function recalculatePaymentStatus(tx: Tx, transactionId: string) {
  const row = await tx.paymentTransaction.findUnique({
    where: { id: transactionId },
    include: { disputes: { select: { status: true } } },
  });
  if (!row) return;

  const refundedAggregate = await tx.paymentRefund.aggregate({
    where: { transactionId },
    _sum: { amountCents: true },
  });
  const refundedCents = refundedAggregate._sum.amountCents ?? 0;
  // Open and lost disputes keep the money out of the account. Won disputes return it.
  const hasOpenOrLostDispute = row.disputes.some((dispute) => dispute.status !== DisputeStatus.WON);

  let status: PaymentStatus = PaymentStatus.SUCCEEDED;
  if (refundedCents >= row.amountCents && row.amountCents > 0) {
    status = PaymentStatus.REFUNDED;
  } else if (hasOpenOrLostDispute) {
    status = PaymentStatus.DISPUTED;
  }

  await tx.paymentTransaction.update({
    where: { id: transactionId },
    data: { refundedCents, status },
  });
}

async function upsertSubscription(
  tx: Tx,
  params: {
    userId: string;
    subscription: Stripe.Subscription;
    eventCreatedAt: Date;
    tier: PremiumTier;
    interval: BillingInterval;
  },
) {
  const { subscription } = params;
  const period = readSubscriptionPeriod(subscription);
  const status = mapSubscriptionStatus(subscription.status);
  const priceId = subscription.items.data[0]?.price.id ?? null;

  const data = {
    userId: params.userId,
    providerCustomerId: idOf(subscription.customer) ?? "",
    providerPriceId: priceId,
    tier: params.tier,
    interval: params.interval,
    status,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    providerEventCreatedAt: params.eventCreatedAt,
  };

  await tx.billingSubscription.upsert({
    where: { providerSubscriptionId: subscription.id },
    update: data,
    create: { ...data, provider: "STRIPE", providerSubscriptionId: subscription.id },
  });
}

/** Keeps User.premium in line with the user's Stripe subscriptions after a terminal change. */
async function syncPremiumAfterSubscriptionEnd(tx: Tx, userId: string) {
  const stillActive = await tx.billingSubscription.count({
    where: { userId, status: { in: [...ACTIVE_BILLING_STATUSES] } },
  });
  if (stillActive === 0) {
    await tx.user.update({ where: { id: userId }, data: { premium: false, premiumTier: "NONE" } });
  }
}

function boostLevelForTier(tier: PremiumTier): number {
  switch (tier) {
    case "INFINITE":
      return 5;
    case "ELITE":
      return 3;
    case "PLUS":
      return 2;
    default:
      return 1;
  }
}

async function applyCheckout(tx: Tx, enriched: Extract<Enriched, { kind: "checkout" }>): Promise<string | null> {
  const { event, session } = enriched;
  const userId = session.metadata?.userId;
  const featureCode = session.metadata?.featureCode as PaidFeatureCode | undefined;
  if (!userId || !featureCode) {
    return "Checkout session has no userId or featureCode metadata";
  }

  const isSubscription = featureCode === "CORE_PLUS";
  const kind = isSubscription ? PaymentKind.SUBSCRIPTION : featureCode === "COIN_PACK" ? PaymentKind.COIN_PACK : PaymentKind.ONE_TIME;
  const providerPaymentId = session.id;
  const amountCents = session.amount_total ?? enriched.lineAmountCents ?? 0;
  const currency = session.currency ?? "usd";
  const tierFromMetadata = (session.metadata?.tier || null) as PremiumTier | null;

  if (session.payment_status === "unpaid") {
    // Waiting on an async payment method. Record it so the console shows it as pending, grant nothing.
    await writePayment(tx, {
      eventId: event.id,
      providerPaymentId,
      userId,
      kind,
      featureCode,
      tier: tierFromMetadata,
      status: PaymentStatus.PENDING,
      amountCents,
      currency,
      paymentIntentId: null,
      subscriptionId: idOf(session.subscription),
      feeCents: null,
      metadata: { checkoutSessionId: session.id, priceId: enriched.priceId },
    });
    return null;
  }

  const { row, transitionedToSucceeded } = await writePayment(tx, {
    eventId: event.id,
    providerPaymentId,
    userId,
    kind,
    featureCode,
    tier: isSubscription ? tierFromMetadata : null,
    status: PaymentStatus.SUCCEEDED,
    amountCents,
    currency,
    paymentIntentId: enriched.paymentIntentId,
    subscriptionId: idOf(session.subscription),
    feeCents: enriched.feeCents,
    metadata: { checkoutSessionId: session.id, priceId: enriched.priceId },
  });

  if (!transitionedToSucceeded) {
    // Already granted by an earlier event for this same payment.
    return "Payment already recorded; grant skipped";
  }

  if (isSubscription) {
    const subscription = enriched.subscription;
    if (!subscription) return "Subscription checkout completed without a subscription id";

    const tier = tierFromMetadata ?? (enriched.priceId ? resolveTierFromPriceId(enriched.priceId) : null) ?? "PLUS";
    const interval = ((session.metadata?.interval || null) as BillingInterval | null) ??
      (enriched.priceId ? resolveIntervalFromPriceId(enriched.priceId) : null) ??
      "MONTHLY";

    await upsertSubscription(tx, {
      userId,
      subscription,
      eventCreatedAt: new Date(event.created * 1000),
      tier,
      interval,
    });

    await tx.paymentTransaction.update({
      where: { id: row.id },
      data: { providerSubscriptionId: subscription.id },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        premium: true,
        premiumTier: tier,
        corePlusActivatedAt: new Date(),
        corePlusBoostLevel: boostLevelForTier(tier),
      },
    });
    return null;
  }

  if (featureCode === "COIN_PACK") {
    if (!enriched.coinAmount || enriched.coinAmount <= 0) {
      return "Coin pack price has no valid coin_amount metadata; coins not credited";
    }
    await EconomyAuthority.applyChange(tx, {
      userId,
      amount: BigInt(enriched.coinAmount),
      currencyType: "NC",
      reason: "Coin pack purchase",
      referenceId: `stripe:${providerPaymentId}`,
      type: "COIN_PURCHASE",
      metadata: { providerPaymentId, priceId: enriched.priceId },
    });
    return null;
  }

  const quantity = Math.max(1, Number(session.metadata?.quantity ?? "1") || 1);
  await tx.featureEntitlement.upsert({
    where: { userId_featureCode: { userId, featureCode } },
    update: { active: true, quantity: { increment: quantity } },
    create: { userId, featureCode, source: "STRIPE", active: true, quantity },
  });
  return null;
}

async function applyCheckoutFailed(tx: Tx, enriched: Extract<Enriched, { kind: "checkout_failed" }>): Promise<string | null> {
  const { session, event } = enriched;
  const userId = session.metadata?.userId;
  const featureCode = session.metadata?.featureCode as PaidFeatureCode | undefined;
  if (!userId || !featureCode) return "Checkout session has no userId or featureCode metadata";

  const isSubscription = featureCode === "CORE_PLUS";
  const kind = isSubscription ? PaymentKind.SUBSCRIPTION : featureCode === "COIN_PACK" ? PaymentKind.COIN_PACK : PaymentKind.ONE_TIME;
  await writePayment(tx, {
    eventId: event.id,
    providerPaymentId: session.id,
    userId,
    kind,
    featureCode,
    tier: isSubscription ? ((session.metadata?.tier || null) as PremiumTier | null) : null,
    status: PaymentStatus.FAILED,
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    paymentIntentId: idOf(session.payment_intent),
    subscriptionId: idOf(session.subscription),
    feeCents: null,
    metadata: { checkoutSessionId: session.id },
  });
  return null;
}

async function applyInvoice(tx: Tx, enriched: Extract<Enriched, { kind: "invoice" }>): Promise<string | null> {
  const { invoice, event, subscriptionId } = enriched;

  // A paid first invoice is recorded from checkout.session.completed, so skip it here to avoid counting it twice.
  if (enriched.paid && invoice.billing_reason === "subscription_create") {
    return null;
  }

  if (!subscriptionId) {
    return null; // Not a subscription invoice, so nothing in this integration tracks it.
  }

  const local = await tx.billingSubscription.findUnique({ where: { providerSubscriptionId: subscriptionId } });
  if (!local) {
    return `Invoice for unknown subscription ${subscriptionId}`;
  }

  const eventCreatedAt = new Date(event.created * 1000);
  const isStale = local.providerEventCreatedAt !== null && local.providerEventCreatedAt > eventCreatedAt;

  if (enriched.paid) {
    if (invoice.amount_paid > 0) {
      await writePayment(tx, {
        eventId: event.id,
        providerPaymentId: invoice.id,
        userId: local.userId,
        kind: PaymentKind.RENEWAL,
        featureCode: "CORE_PLUS",
        tier: local.tier,
        status: PaymentStatus.SUCCEEDED,
        amountCents: invoice.amount_paid,
        currency: invoice.currency,
        paymentIntentId: enriched.paymentIntentId,
        subscriptionId,
        feeCents: enriched.feeCents,
        metadata: { invoiceId: invoice.id, billingReason: invoice.billing_reason },
      });
    }
    if (!isStale) {
      await tx.billingSubscription.update({
        where: { id: local.id },
        data: { status: BillingStatus.ACTIVE, providerEventCreatedAt: eventCreatedAt },
      });
    }
    return null;
  }

  // invoice.payment_failed: record the failed attempt and move the subscription to PAST_DUE.
  if (invoice.amount_due > 0) {
    await writePayment(tx, {
      eventId: event.id,
      providerPaymentId: invoice.id,
      userId: local.userId,
      kind: invoice.billing_reason === "subscription_create" ? PaymentKind.SUBSCRIPTION : PaymentKind.RENEWAL,
      featureCode: "CORE_PLUS",
      tier: local.tier,
      status: PaymentStatus.FAILED,
      amountCents: invoice.amount_due,
      currency: invoice.currency,
      paymentIntentId: null,
      subscriptionId,
      feeCents: null,
      metadata: { invoiceId: invoice.id, billingReason: invoice.billing_reason },
    });
  }
  if (!isStale) {
    await tx.billingSubscription.update({
      where: { id: local.id },
      data: { status: BillingStatus.PAST_DUE, providerEventCreatedAt: eventCreatedAt },
    });
  }
  return null;
}

async function applySubscription(tx: Tx, enriched: Extract<Enriched, { kind: "subscription" }>): Promise<string | null> {
  const { subscription, event } = enriched;
  const local = await tx.billingSubscription.findUnique({ where: { providerSubscriptionId: subscription.id } });
  if (!local) {
    return `Subscription ${subscription.id} is not linked to a local user`;
  }

  const eventCreatedAt = new Date(event.created * 1000);
  if (local.providerEventCreatedAt && local.providerEventCreatedAt > eventCreatedAt) {
    return "Stale subscription event ignored (a newer one was already applied)";
  }

  const priceId = subscription.items.data[0]?.price.id ?? null;
  const period = readSubscriptionPeriod(subscription);
  const status = mapSubscriptionStatus(subscription.status);

  await tx.billingSubscription.update({
    where: { id: local.id },
    data: {
      providerPriceId: priceId,
      tier: (priceId ? resolveTierFromPriceId(priceId) : null) ?? local.tier,
      interval: (priceId ? resolveIntervalFromPriceId(priceId) : null) ?? local.interval,
      status,
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      providerEventCreatedAt: eventCreatedAt,
    },
  });

  if (status === BillingStatus.CANCELED || status === BillingStatus.EXPIRED) {
    await syncPremiumAfterSubscriptionEnd(tx, local.userId);
  }
  return null;
}

async function applyRefund(tx: Tx, enriched: Extract<Enriched, { kind: "refund" }>): Promise<string | null> {
  if (!enriched.paymentIntentId) {
    return `Refund on charge ${enriched.charge.id} has no payment intent`;
  }

  const row = await tx.paymentTransaction.findFirst({ where: { providerPaymentIntentId: enriched.paymentIntentId } });
  if (!row) {
    return `Refund for unknown payment intent ${enriched.paymentIntentId}`;
  }

  for (const refund of enriched.refunds) {
    await tx.paymentRefund.upsert({
      where: { providerRefundId: refund.id },
      update: { amountCents: refund.amount, status: refund.status ?? "unknown", reason: refund.reason ?? null },
      create: {
        transactionId: row.id,
        providerRefundId: refund.id,
        amountCents: refund.amount,
        status: refund.status ?? "unknown",
        reason: refund.reason ?? null,
      },
    });
  }

  await recalculatePaymentStatus(tx, row.id);
  return null;
}

async function applyDispute(tx: Tx, enriched: Extract<Enriched, { kind: "dispute" }>): Promise<string | null> {
  if (!enriched.paymentIntentId) {
    return `Dispute ${enriched.dispute.id} has no payment intent`;
  }

  const row = await tx.paymentTransaction.findFirst({ where: { providerPaymentIntentId: enriched.paymentIntentId } });
  if (!row) {
    return `Dispute for unknown payment intent ${enriched.paymentIntentId}`;
  }

  const { dispute } = enriched;
  const status = mapDisputeStatus(dispute.status);
  const closed = status !== DisputeStatus.OPEN;

  await tx.paymentDispute.upsert({
    where: { providerDisputeId: dispute.id },
    update: {
      status,
      providerStatus: dispute.status,
      closedAt: closed ? new Date() : null,
      amountCents: dispute.amount,
      reason: dispute.reason ?? null,
    },
    create: {
      transactionId: row.id,
      providerDisputeId: dispute.id,
      amountCents: dispute.amount,
      status,
      providerStatus: dispute.status,
      reason: dispute.reason ?? null,
      closedAt: closed ? new Date() : null,
    },
  });

  await recalculatePaymentStatus(tx, row.id);
  return null;
}

async function applyEnriched(tx: Tx, enriched: Enriched): Promise<string | null> {
  switch (enriched.kind) {
    case "checkout":
      return applyCheckout(tx, enriched);
    case "checkout_failed":
      return applyCheckoutFailed(tx, enriched);
    case "invoice":
      return applyInvoice(tx, enriched);
    case "subscription":
      return applySubscription(tx, enriched);
    case "refund":
      return applyRefund(tx, enriched);
    case "dispute":
      return applyDispute(tx, enriched);
    case "ignored":
      return null;
  }
}

function isRetryableTransactionError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  // P2034: serialization failure or deadlock. Retry the whole event.
  return code === "P2034";
}

async function runSerializable<T>(work: (tx: Tx) => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  } catch (error) {
    if (isRetryableTransactionError(error) && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt + Math.random() * 50));
      return runSerializable(work, attempt + 1);
    }
    throw error;
  }
}

/** Applies one verified Stripe event exactly once. Throws if it should be retried by Stripe. */
export async function processStripeEvent(event: Stripe.Event): Promise<WebhookOutcome> {
  const enriched = await enrich(event);

  return runSerializable(async (tx) => {
    const existing = await tx.webhookEvent.findUnique({ where: { providerEventId: event.id } });
    if (existing?.status === "PROCESSED") {
      return { duplicate: true, note: null };
    }

    const note = await applyEnriched(tx, enriched);
    const now = new Date();

    await tx.webhookEvent.upsert({
      where: { providerEventId: event.id },
      create: {
        providerEventId: event.id,
        type: event.type,
        livemode: event.livemode,
        status: "PROCESSED",
        attempts: 1,
        note,
        processedAt: now,
      },
      update: {
        status: "PROCESSED",
        attempts: { increment: 1 },
        lastError: null,
        note,
        processedAt: now,
      },
    });

    return { duplicate: false, note };
  });
}

/** Records a failed attempt outside the rolled-back transaction so the owner console can show it. */
export async function recordWebhookFailure(event: Stripe.Event, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  try {
    await prisma.webhookEvent.upsert({
      where: { providerEventId: event.id },
      create: {
        providerEventId: event.id,
        type: event.type,
        livemode: event.livemode,
        status: "FAILED",
        attempts: 1,
        lastError: message.slice(0, 1000),
      },
      update: {
        status: "FAILED",
        attempts: { increment: 1 },
        lastError: message.slice(0, 1000),
      },
    });
  } catch (ledgerError) {
    console.error("billing webhook: could not record failure", event.id, ledgerError);
  }
}
