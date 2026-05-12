import type { Request, Response } from "express";
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
  const entitlement = await prisma.featureEntitlement.findUnique({
    where: {
      userId_featureCode: {
        userId,
        featureCode,
      },
    },
  });

  if (!entitlement || !entitlement.active || entitlement.quantity < quantity) {
    return null;
  }

  const updated = await prisma.featureEntitlement.update({
    where: {
      userId_featureCode: {
        userId,
        featureCode,
      },
    },
    data: {
      quantity: entitlement.quantity - quantity,
      active: entitlement.quantity - quantity > 0,
    },
    select: {
      quantity: true,
    },
  });

  return {
    consumed: quantity,
    remaining: updated.quantity,
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
    ready: hasStripeKey && corePlusTierPrices && addOnPrices,
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
    res.status(503).json({ error: "Billing provider unavailable. Configure STRIPE_SECRET_KEY." });
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
    success_url: `${env.APP_WEB_URL}/core-plus?checkout=success`,
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
    return_url: `${env.APP_WEB_URL}/settings`,
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

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
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

        await prisma.paymentTransaction.create({
          data: {
            userId,
            provider: "STRIPE",
            providerEventId: event.id,
            providerPaymentId: session.payment_intent?.toString() ?? session.id,
            amountCents: unitAmount,
            currency: session.currency ?? "usd",
            status: "SUCCEEDED",
            featureCode,
            tier: featureCode === "CORE_PLUS" ? session.metadata?.tier as "CORE" | "PLUS" | "ELITE" | "INFINITE" : null,
            metadata: {
              checkoutSessionId: session.id,
              subscriptionId: typeof session.subscription === "string" ? session.subscription : null,
              priceId,
            },
          },
        });

        if (featureCode === "CORE_PLUS") {
          const subscriptionId = session.subscription?.toString();
          if (subscriptionId) {
            const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
            const period = readSubscriptionPeriod(subscription);
            const subscriptionPriceId = subscription.items.data[0]?.price.id ?? priceId;
            const tier = (session.metadata?.tier as "CORE" | "PLUS" | "ELITE" | "INFINITE" | undefined) ??
              (subscriptionPriceId ? resolveTierFromPriceId(subscriptionPriceId) : null) ??
              "PLUS";
            const interval = (session.metadata?.interval as "MONTHLY" | "YEARLY" | undefined) ??
              (subscriptionPriceId ? resolveIntervalFromPriceId(subscriptionPriceId) : null) ??
              "MONTHLY";

            await prisma.billingSubscription.upsert({
              where: {
                providerSubscriptionId: subscriptionId,
              },
              update: {
                userId,
                providerCustomerId: subscription.customer.toString(),
                providerPriceId: subscriptionPriceId,
                tier,
                interval,
                status: subscription.status === "active" ? "ACTIVE" : subscription.status === "trialing" ? "TRIALING" : "PAST_DUE",
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
                status: subscription.status === "active" ? "ACTIVE" : subscription.status === "trialing" ? "TRIALING" : "PAST_DUE",
                currentPeriodStart: period.start,
                currentPeriodEnd: period.end,
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
              },
            });

            await prisma.user.update({
              where: { id: userId },
              data: {
                premium: true,
                premiumTier: tier,
                corePlusActivatedAt: new Date(),
                corePlusBoostLevel:
                  tier === "INFINITE"
                    ? 5
                    : tier === "ELITE"
                      ? 3
                      : tier === "PLUS"
                        ? 2
                        : 1,
              },
            });
          }
        } else {
          await prisma.featureEntitlement.upsert({
            where: {
              userId_featureCode: {
                userId,
                featureCode,
              },
            },
            update: {
              active: true,
              quantity: {
                increment: Number(session.metadata?.quantity ?? "1"),
              },
            },
            create: {
              userId,
              featureCode,
              source: "STRIPE",
              active: true,
              quantity: Number(session.metadata?.quantity ?? "1"),
            },
          });
        }
      }
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
            await prisma.user.update({
              where: { id: localSub.userId },
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
