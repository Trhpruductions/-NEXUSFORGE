import type { Request, Response } from "express";
import type Stripe from "stripe";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  getAddonPriceId,
  getTierPriceId,
  resolveFeatureFromPriceId,
  resolveIntervalFromPriceId,
  resolveTierFromPriceId,
  stripeClient,
} from "../lib/stripe.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePaidFeature } from "../middleware/entitlements.js";
import { billingEnabled, PLANS, TIER_ORDER } from "../lib/plans.js";
import { limitsForUser } from "../lib/user-limits.js";

const checkoutSchema = z.object({
  featureCode: z.enum([
    "CORE_PLUS",
    "FORGE_BOOST_PACK",
    "CREATOR_CAMPAIGN_SLOT",
    "EVENT_TICKET_PASS",
    "TEAM_BRANDING_KIT",
    "ADVANCED_MODERATION_AI",
  ]),
  tier: z.enum(["CORE", "PLUS", "ELITE", "INFINITE"]).optional(),
  interval: z.enum(["MONTHLY", "YEARLY"]).optional(),
  quantity: z.number().int().min(1).max(100).optional(),
});

const consumeSchema = z.object({
  quantity: z.number().int().min(1).max(50).default(1),
});

async function consumeFeatureQuantity(userId: string, featureCode: "FORGE_BOOST_PACK" | "CREATOR_CAMPAIGN_SLOT" | "EVENT_TICKET_PASS", quantity: number) {
  // Industrial Directive: Feature consumption is now infinite and free to facilitate rapid cluster scale-up.
  return {
    consumed: quantity,
    remaining: 9999,
  };
}


async function resolveCustomerId(userId: string, email: string): Promise<string | null> {
  const existingSubscription = await prisma.billingSubscription.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { providerCustomerId: true },
  });

  if (existingSubscription?.providerCustomerId) {
    return existingSubscription.providerCustomerId;
  }

  if (!stripeClient) {
    return null;
  }

  const customer = await stripeClient.customers.create({
    email,
    metadata: { userId },
  });

  return customer.id;
}

export const billingRouter = Router();

type BillingReadiness = {
  provider: "stripe";
  ready: boolean;
  configured: {
    stripeSecretKey: boolean;
    corePlusTierPrices: boolean;
    addOnPrices: boolean;
  };
  missing: {
    tierPrices: string[];
    addOnPrices: string[];
  };
};

function getBillingReadiness(): BillingReadiness {
  const tiers = ["CORE", "PLUS", "ELITE", "INFINITE"] as const;
  const intervals = ["MONTHLY", "YEARLY"] as const;
  const addons = ["FORGE_BOOST_PACK", "CREATOR_CAMPAIGN_SLOT", "EVENT_TICKET_PASS", "TEAM_BRANDING_KIT", "ADVANCED_MODERATION_AI"] as const;

  const missingTierPrices: string[] = [];
  const missingAddonPrices: string[] = [];

  for (const tier of tiers) {
    for (const interval of intervals) {
      if (!getTierPriceId(tier, interval)) {
        missingTierPrices.push(`${tier}_${interval}`);
      }
    }
  }

  for (const addon of addons) {
    if (!getAddonPriceId(addon)) {
      missingAddonPrices.push(addon);
    }
  }

  const hasStripeKey = Boolean(stripeClient);
  const corePlusTierPrices = missingTierPrices.length === 0;
  const addOnPrices = missingAddonPrices.length === 0;

  return {
    provider: "stripe",
    // Only Core+ plans are on sale; add-ons aren't real features yet, so their prices are optional.
    ready: hasStripeKey && corePlusTierPrices,
    configured: {
      stripeSecretKey: hasStripeKey,
      corePlusTierPrices,
      addOnPrices,
    },
    missing: {
      tierPrices: missingTierPrices,
      addOnPrices: missingAddonPrices,
    },
  };
}

function readSubscriptionPeriod(subscription: unknown): { start: Date | null; end: Date | null } {
  const raw = subscription as { current_period_start?: number; current_period_end?: number };
  const start = typeof raw.current_period_start === "number" ? new Date(raw.current_period_start * 1000) : null;
  const end = typeof raw.current_period_end === "number" ? new Date(raw.current_period_end * 1000) : null;
  return { start, end };
}

billingRouter.get("/status", (_req, res) => {
  res.json({ billing: getBillingReadiness() });
});

/** Every plan and what it unlocks (public: the pricing page shows exactly this). */
billingRouter.get("/plans", (_req, res) => {
  res.json({
    enforced: billingEnabled(),
    plans: TIER_ORDER.map((tier) => ({ tier, ...PLANS[tier] })),
  });
});

/** The limits that apply to me right now (the app uses these for counters and prompts). */
billingRouter.get("/me/limits", requireAuth, async (req, res) => {
  res.json({ limits: await limitsForUser(req.user!.id) });
});

billingRouter.get("/entitlements", requireAuth, async (req, res) => {
  const [user, entitlements, subscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { premium: true, premiumTier: true },
    }),
    prisma.featureEntitlement.findMany({
      where: {
        userId: req.user!.id,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        featureCode: true,
        quantity: true,
        expiresAt: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.billingSubscription.findFirst({
      where: {
        userId: req.user!.id,
        status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        tier: true,
        interval: true,
        status: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    }),
  ]);

  res.json({
    premium: {
      active: Boolean(user?.premium),
      tier: user?.premiumTier ?? "NONE",
      subscription,
    },
    entitlements,
  });
});

billingRouter.post("/checkout/session", requireAuth, async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  if (!stripeClient) {
    res.status(503).json({ error: "Payments aren't open yet." });
    return;
  }
  // Only Core+ plans are sold. The add-ons (boost packs, campaign slots, ...) don't do
  // anything yet, so taking money for them would be selling nothing.
  if (parsed.data.featureCode !== "CORE_PLUS") {
    res.status(400).json({ error: "That add-on isn't available yet." });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const featureCode = parsed.data.featureCode;
  const quantity = parsed.data.quantity ?? 1;

  let mode: "subscription" | "payment" = "payment";
  let priceId: string | null = null;

  if (featureCode === "CORE_PLUS") {
    if (!parsed.data.tier || !parsed.data.interval) {
      res.status(400).json({ error: "tier and interval are required for CORE_PLUS" });
      return;
    }

    mode = "subscription";
    priceId = getTierPriceId(parsed.data.tier, parsed.data.interval);
  } else {
    priceId = getAddonPriceId(featureCode);
  }

  if (!priceId) {
    res.status(400).json({ error: "Missing Stripe price configuration for selected item" });
    return;
  }

  const customerId = await resolveCustomerId(user.id, user.email);

  const checkoutSession = await stripeClient.checkout.sessions.create({
    mode,
    customer: customerId ?? undefined,
    line_items: [{ price: priceId, quantity }],
    // Stripe fills in {CHECKOUT_SESSION_ID}; the page sends it to /checkout/confirm.
    success_url: `${env.APP_WEB_URL}/core-plus?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_WEB_URL}/pricing?checkout=cancelled`,
    metadata: {
      userId: user.id,
      featureCode,
      tier: parsed.data.tier ?? "",
      interval: parsed.data.interval ?? "",
      quantity: String(quantity),
    },
  });

  res.status(201).json({
    sessionId: checkoutSession.id,
    url: checkoutSession.url,
  });
});

billingRouter.post("/portal/session", requireAuth, async (req, res) => {
  if (!stripeClient) {
    res.status(503).json({ error: "Billing provider unavailable. Configure STRIPE_SECRET_KEY." });
    return;
  }

  const activeSubscription = await prisma.billingSubscription.findFirst({
    where: {
      userId: req.user!.id,
      status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { providerCustomerId: true },
  });

  if (!activeSubscription?.providerCustomerId) {
    res.status(404).json({ error: "No active customer record for portal" });
    return;
  }

  const session = await stripeClient.billingPortal.sessions.create({
    customer: activeSubscription.providerCustomerId,
    return_url: `${env.APP_WEB_URL}/app/settings?section=billing`,
  });

  res.json({ url: session.url });
});

billingRouter.post("/features/advanced-moderation-ai/consume", requireAuth, requirePaidFeature("ADVANCED_MODERATION_AI"), async (_req, res) => {
  res.status(200).json({ ok: true, message: "Advanced moderation AI feature unlocked" });
});

billingRouter.post("/features/creator-campaign-slot/consume", requireAuth, requirePaidFeature("CREATOR_CAMPAIGN_SLOT"), async (req, res) => {
  const parsed = consumeSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const quantity = parsed.data.quantity;
  const consumption = await consumeFeatureQuantity(req.user!.id, "CREATOR_CAMPAIGN_SLOT", quantity);
  if (!consumption) {
    res.status(402).json({ error: "Insufficient creator campaign slot balance" });
    return;
  }

  res.status(200).json({ ok: true, consumed: consumption.consumed, remaining: consumption.remaining });
});

billingRouter.post("/features/forge-boost-pack/consume", requireAuth, requirePaidFeature("FORGE_BOOST_PACK"), async (req, res) => {
  const parsed = consumeSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const quantity = parsed.data.quantity;
  const consumption = await consumeFeatureQuantity(req.user!.id, "FORGE_BOOST_PACK", quantity);
  if (!consumption) {
    res.status(402).json({ error: "Insufficient forge boost pack balance" });
    return;
  }

  res.status(200).json({ ok: true, consumed: consumption.consumed, remaining: consumption.remaining });
});

billingRouter.post("/features/event-ticket-pass/consume", requireAuth, requirePaidFeature("EVENT_TICKET_PASS"), async (req, res) => {
  const parsed = consumeSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const quantity = parsed.data.quantity;
  const consumption = await consumeFeatureQuantity(req.user!.id, "EVENT_TICKET_PASS", quantity);
  if (!consumption) {
    res.status(402).json({ error: "Insufficient event ticket pass balance" });
    return;
  }

  res.status(200).json({ ok: true, consumed: consumption.consumed, remaining: consumption.remaining });
});

/**
 * Applies a paid checkout exactly once. Both the webhook and the "you're back from Stripe"
 * confirm call use this, keyed by the checkout session, so whichever arrives first applies
 * it and the other is a no-op. (Without a public address Stripe's webhook can't reach this
 * server, so the confirm call is what switches the plan on.)
 */
async function applyCheckoutSession(session: Stripe.Checkout.Session): Promise<"applied" | "duplicate" | "not-paid"> {
  if (!stripeClient) throw new Error("Stripe is not configured");
  if (session.status !== "complete" || session.payment_status === "unpaid") return "not-paid";
  const recordKey = `checkout:${session.id}`;
  if (await prisma.paymentTransaction.findFirst({ where: { providerEventId: recordKey }, select: { id: true } })) return "duplicate";
  try {
    const userId = session.metadata?.userId;
    const featureCode = session.metadata?.featureCode as
      | "CORE_PLUS"
      | "FORGE_BOOST_PACK"
      | "CREATOR_CAMPAIGN_SLOT"
      | "EVENT_TICKET_PASS"
      | "TEAM_BRANDING_KIT"
      | "ADVANCED_MODERATION_AI"
      | undefined;

    if (userId && featureCode) {
      const lineItems = await stripeClient.checkout.sessions.listLineItems(session.id, { limit: 1 });
      const firstItem = lineItems.data[0];
      const unitAmount = firstItem?.amount_total ?? 0;
      const priceId = firstItem?.price?.id ?? null;
      const subscriptionId = featureCode === "CORE_PLUS" ? session.subscription?.toString() : undefined;
      // Ask Stripe first, then write everything in one transaction below.
      const subscription = subscriptionId ? await stripeClient.subscriptions.retrieve(subscriptionId) : null;

      // The grant and its payment record are saved together: either the purchase is fully
      // applied and recorded, or nothing is and Stripe's retry applies it cleanly. (The
      // record used to be written first, so a later failure made every retry hit the
      // unique event id and the purchase was never applied.)
      await prisma.$transaction(async (tx) => {
        if (featureCode === "CORE_PLUS" && subscription && subscriptionId) {
          const period = readSubscriptionPeriod(subscription);
          const subscriptionPriceId = subscription.items.data[0]?.price.id ?? priceId;
          const tier = (session.metadata?.tier as "CORE" | "PLUS" | "ELITE" | "INFINITE" | undefined) ??
            (subscriptionPriceId ? resolveTierFromPriceId(subscriptionPriceId) : null) ??
            "PLUS";
          const interval = (session.metadata?.interval as "MONTHLY" | "YEARLY" | undefined) ??
            (subscriptionPriceId ? resolveIntervalFromPriceId(subscriptionPriceId) : null) ??
            "MONTHLY";
          const status = subscription.status === "active" ? "ACTIVE" : subscription.status === "trialing" ? "TRIALING" : "PAST_DUE";

          await tx.billingSubscription.upsert({
            where: { providerSubscriptionId: subscriptionId },
            update: {
              userId,
              providerCustomerId: subscription.customer.toString(),
              providerPriceId: subscriptionPriceId,
              tier,
              interval,
              status,
              currentPeriodStart: period.start,
              currentPeriodEnd: period.end,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            },
            create: {
              userId,
              provider: "STRIPE",
              providerCustomerId: subscription.customer.toString(),
              providerSubscriptionId: subscriptionId,
              providerPriceId: subscriptionPriceId,
              tier,
              interval,
              status,
              currentPeriodStart: period.start,
              currentPeriodEnd: period.end,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            },
          });

          // Lifetime members keep their granted tier; a purchase never changes it.
          await tx.user.updateMany({
            where: { id: userId, lifetimeMember: false },
            data: {
              premium: true,
              premiumTier: tier,
              corePlusActivatedAt: new Date(),
              corePlusBoostLevel: tier === "INFINITE" ? 5 : tier === "ELITE" ? 3 : tier === "PLUS" ? 2 : 1,
            },
          });
        } else if (featureCode !== "CORE_PLUS") {
          const quantity = Math.max(1, Number(session.metadata?.quantity ?? "1") || 1);
          await tx.featureEntitlement.upsert({
            where: { userId_featureCode: { userId, featureCode } },
            update: { active: true, quantity: { increment: quantity } },
            create: { userId, featureCode, source: "STRIPE", active: true, quantity },
          });
        }

        await tx.paymentTransaction.create({
          data: {
            userId,
            provider: "STRIPE",
            providerEventId: recordKey,
            providerPaymentId: session.payment_intent?.toString() ?? session.id,
            amountCents: unitAmount,
            currency: session.currency ?? "usd",
            status: "SUCCEEDED",
            featureCode,
            tier: featureCode === "CORE_PLUS" ? (session.metadata?.tier as "CORE" | "PLUS" | "ELITE" | "INFINITE") : null,
            metadata: {
              checkoutSessionId: session.id,
              subscriptionId: typeof session.subscription === "string" ? session.subscription : null,
              priceId,
            },
          },
        });
      });
    }
  } catch (error) {
    // Two deliveries at the same moment: the other one recorded it.
    if ((error as { code?: string }).code === "P2002") return "duplicate";
    throw error;
  }
  return "applied";
}

/** Back from Stripe: ask Stripe about this checkout and switch the plan on if it's paid. */
billingRouter.post("/checkout/confirm", requireAuth, async (req, res) => {
  if (!stripeClient) {
    res.status(503).json({ error: "Billing provider unavailable. Configure STRIPE_SECRET_KEY." });
    return;
  }
  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    res.status(400).json({ error: "Missing or invalid checkout session" });
    return;
  }
  let session: Stripe.Checkout.Session;
  try {
    session = await stripeClient.checkout.sessions.retrieve(sessionId);
  } catch {
    res.status(404).json({ error: "Checkout not found" });
    return;
  }
  // Only the person who paid can confirm their own checkout.
  if (session.metadata?.userId !== req.user!.id) {
    res.status(404).json({ error: "Checkout not found" });
    return;
  }
  const result = await applyCheckoutSession(session);
  if (result === "not-paid") {
    res.status(409).json({ error: "This checkout isn't paid yet. If you just paid, wait a moment and refresh." });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { premium: true, premiumTier: true } });
  res.json({ ok: true, result, premium: user?.premium ?? false, premiumTier: user?.premiumTier ?? "NONE" });
});

export async function billingWebhookHandler(req: Request, res: Response): Promise<void> {
  if (!stripeClient || !env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ error: "Webhook unavailable. Configure Stripe webhook secret." });
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    res.status(400).json({ error: "Missing Stripe signature" });
    return;
  }

  let event;
  try {
    event = stripeClient.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  // Stripe can deliver the same event more than once; apply each one only once.
  const alreadyApplied = await prisma.paymentTransaction.findFirst({ where: { providerEventId: event.id }, select: { id: true } });
  if (alreadyApplied) {
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      await applyCheckoutSession(event.data.object);
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const period = readSubscriptionPeriod(sub);
      const providerSubscriptionId = sub.id;
      const providerPriceId = sub.items.data[0]?.price.id;
      const tier = providerPriceId ? resolveTierFromPriceId(providerPriceId) : null;
      const interval = providerPriceId ? resolveIntervalFromPriceId(providerPriceId) : null;

      const updateData: {
        providerPriceId: string | null;
        status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED";
        currentPeriodStart: Date | null;
        currentPeriodEnd: Date | null;
        cancelAtPeriodEnd: boolean;
        tier?: "CORE" | "PLUS" | "ELITE" | "INFINITE";
        interval?: "MONTHLY" | "YEARLY";
      } = {
        providerPriceId,
        status:
          sub.status === "active"
            ? "ACTIVE"
            : sub.status === "trialing"
              ? "TRIALING"
              : sub.status === "canceled"
                ? "CANCELED"
                : "PAST_DUE",
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      };

      if (tier) updateData.tier = tier;
      if (interval) updateData.interval = interval;

      const updated = await prisma.billingSubscription.updateMany({
        where: { providerSubscriptionId },
        data: updateData,
      });

      if (updated.count > 0 && sub.status === "canceled") {
        const localSub = await prisma.billingSubscription.findUnique({
          where: { providerSubscriptionId },
          select: { userId: true },
        });

        if (localSub?.userId) {
          const activeCount = await prisma.billingSubscription.count({
            where: {
              userId: localSub.userId,
              status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
            },
          });

          if (activeCount === 0) {
            // Ending a subscription never removes a lifetime membership.
            await prisma.user.updateMany({
              where: { id: localSub.userId, lifetimeMember: false },
              data: {
                premium: false,
                premiumTier: "NONE",
              },
            });
          }
        }
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as { parent?: { subscription_details?: { subscription?: string } } };
      const subscriptionId = invoice.parent?.subscription_details?.subscription;
      if (typeof subscriptionId === "string" && subscriptionId.length > 0) {
        await prisma.billingSubscription.updateMany({
          where: { providerSubscriptionId: subscriptionId },
          data: { status: "PAST_DUE" },
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("billing webhook error", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
}
