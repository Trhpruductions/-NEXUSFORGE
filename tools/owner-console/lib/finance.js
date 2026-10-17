"use strict";

// Finance panel: money and memberships for the owner, read from the app database. Read only: every figure comes from a
// SELECT through the read-only role, and nothing here is served to the public website.
//
// What is and is not in the numbers:
// - Revenue counts payments the app has recorded from Stripe: checkouts, renewals (invoice.paid), refunds (charge.refunded)
//   and failed renewals (invoice.payment_failed). A payment only counts once Stripe has told the app about it.
// - Store purchases (Apple, Google) have no price in the app, so they are counted and never added to revenue.
// - Processing fees are not recorded by the app, so they are reported as unavailable, not estimated.
// - Pending payments are shown separately and are not part of revenue.

const { withReadOnly } = require("./appdb");
const { loadEnvFiles } = require("./envfiles");

const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_MS = 30 * 1000;
const MEMBER_LIMIT = 300;
const RECENT_LIMIT = 25;

// Same wording as the website's catalog, so the owner sees the same names.
const FEATURE_LABELS = {
  CORE_PLUS: "Core+ subscription",
  FORGE_BOOST_PACK: "Forge Boost Packs",
  CREATOR_CAMPAIGN_SLOT: "Creator Campaign Slot",
  EVENT_TICKET_PASS: "Event Ticket Pass",
  TEAM_BRANDING_KIT: "Team Branding Kit",
  ADVANCED_MODERATION_AI: "Activity pressure",
};

const TIERS = ["CORE", "PLUS", "ELITE", "INFINITE"];
const TIER_PRICE_KEYS = TIERS.flatMap((tier) => [`STRIPE_PRICE_${tier}_MONTHLY`, `STRIPE_PRICE_${tier}_YEARLY`]);

// Refunded amount on a payment: the amount Stripe reported, or the whole payment when it was refunded in full.
const REFUND_SQL = `COALESCE(("metadata"->>'amountRefundedCents')::bigint, CASE WHEN status::text = 'REFUNDED' THEN "amountCents" ELSE 0 END)`;

/** Percent growth from the previous window to this one, the same rule the website used. */
function growthPercent(current, previous) {
  if (previous > 0) return Number((((current - previous) / previous) * 100).toFixed(2));
  return current > 0 ? 100 : 0;
}

/** Store purchases grouped by store: active, expired and revoked counts, and how many were bought in the last 30 days. */
function summarizeStore(rows) {
  const byProvider = new Map();
  for (const row of rows) {
    if (!byProvider.has(row.provider)) {
      byProvider.set(row.provider, { provider: row.provider, active: 0, expired: 0, revoked: 0, purchasesLast30Days: 0 });
    }
    const entry = byProvider.get(row.provider);
    if (row.status === "ACTIVE") entry.active += row.total;
    else if (row.status === "EXPIRED") entry.expired += row.total;
    else if (row.status === "REVOKED") entry.revoked += row.total;
    entry.purchasesLast30Days += row.last30;
  }
  return [...byProvider.values()].sort((a, b) => a.provider.localeCompare(b.provider));
}

/** Whether Stripe is set up, from the presence of each key only. No value is read out or returned. */
function billingReadiness(describe) {
  const stripeKeyPresent = describe("STRIPE_SECRET_KEY").present;
  const webhookSecretPresent = describe("STRIPE_WEBHOOK_SECRET").present;
  const missingTierPrices = TIER_PRICE_KEYS.filter((key) => !describe(key).present);
  return {
    stripeKeyPresent,
    webhookSecretPresent,
    missingTierPrices,
    ready: stripeKeyPresent && missingTierPrices.length === 0,
  };
}

/** Test or live, from the key's prefix alone. The key itself is never returned. */
function stripeModeFrom(keyValue) {
  if (!keyValue) return "not set";
  if (keyValue.startsWith("sk_test_")) return "test";
  if (keyValue.startsWith("sk_live_")) return "live";
  return "unknown";
}

// The Stripe mode each payment was made in. Payments recorded before the mode was stored are "unrecorded".
const ENVIRONMENT_SQL = `COALESCE("metadata"->>'livemode', 'unrecorded')`;
const DISPUTE_LOST_SQL = `COALESCE(("metadata"->>'disputeLostCents')::bigint, 0)`;
const DISPUTE_OPEN_SQL = `COALESCE(("metadata"->>'disputeOpenCents')::bigint, 0)`;

function emptyBucket() {
  return { transactions: 0, grossCents: 0, refundsCents: 0, disputeLostCents: 0, disputeOpenCents: 0, openDisputes: 0, netCents: 0 };
}

/**
 * Gross, refunds, disputes and net for every confirmed payment since `since`, split by the Stripe mode each was made in.
 * Net is gross minus refunds minus money lost to disputes. Open disputes are shown but not deducted: they may be won.
 */
async function totalsSince(select, since) {
  const rows = (
    await select(
      `SELECT ${ENVIRONMENT_SQL} AS environment,
              COUNT(*)::int AS transactions,
              COALESCE(SUM("amountCents"), 0)::bigint AS gross_cents,
              COALESCE(SUM(${REFUND_SQL}), 0)::bigint AS refund_cents,
              COALESCE(SUM(${DISPUTE_LOST_SQL}), 0)::bigint AS lost_cents,
              COALESCE(SUM(${DISPUTE_OPEN_SQL}), 0)::bigint AS open_cents,
              COUNT(*) FILTER (WHERE ${DISPUTE_OPEN_SQL} > 0)::int AS open_disputes
         FROM "PaymentTransaction"
        WHERE status::text IN ('SUCCEEDED', 'REFUNDED') AND "createdAt" >= $1
        GROUP BY 1`,
      [since],
    )
  ).rows;

  const buckets = { live: emptyBucket(), test: emptyBucket(), unrecorded: emptyBucket() };
  for (const row of rows) {
    const bucket = buckets[row.environment === "true" ? "live" : row.environment === "false" ? "test" : "unrecorded"];
    bucket.transactions += row.transactions;
    bucket.grossCents += Number(row.gross_cents);
    bucket.refundsCents += Number(row.refund_cents);
    bucket.disputeLostCents += Number(row.lost_cents);
    bucket.disputeOpenCents += Number(row.open_cents);
    bucket.openDisputes += row.open_disputes;
  }
  for (const bucket of Object.values(buckets)) bucket.netCents = bucket.grossCents - bucket.refundsCents - bucket.disputeLostCents;
  return buckets;
}

/** The webhook's own record of what it applied. Shows "not available" until the event table is in the live database. */
async function webhookActivity() {
  try {
    const rows = await withReadOnly(async (select) =>
      (
        await select(
          `SELECT COUNT(*) FILTER (WHERE status = 'APPLIED' AND "receivedAt" >= now() - interval '1 day')::int AS applied_24h,
                  COUNT(*) FILTER (WHERE status = 'APPLYING')::int AS applying,
                  MAX("receivedAt") AS last_received
             FROM "StripeWebhookEvent"`,
        )
      ).rows,
    );
    const row = rows[0];
    return {
      available: true,
      appliedLast24h: row.applied_24h,
      applying: row.applying,
      lastReceivedAt: row.last_received ? new Date(row.last_received).toISOString() : null,
    };
  } catch {
    return { available: false, note: "Webhook event records are not in the live database yet, so recent Stripe deliveries cannot be shown." };
  }
}

function windowStarts(now) {
  const startOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  return {
    today: new Date(startOfDay),
    week: new Date(startOfDay - daysSinceMonday * DAY_MS),
    month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    allTime: new Date(0),
    thirtyDays: new Date(now.getTime() - 30 * DAY_MS),
  };
}

async function readFinance(now) {
  const starts = windowStarts(now);
  const env = loadEnvFiles();

  const data = await withReadOnly(async (select) => {
    // Headline totals are live payments only. Test and unrecorded payments are kept in their own buckets.
    const environments = {};
    for (const [name, since] of Object.entries({ today: starts.today, week: starts.week, month: starts.month, thirtyDays: starts.thirtyDays, allTime: starts.allTime })) {
      environments[name] = await totalsSince(select, since);
    }
    const totals = Object.fromEntries(Object.entries(environments).map(([name, buckets]) => [name, buckets.live]));
    const previousThirty = (
      await select(
        `SELECT COALESCE(SUM("amountCents"), 0)::bigint AS cents
           FROM "PaymentTransaction"
          WHERE status::text IN ('SUCCEEDED', 'REFUNDED') AND "createdAt" >= $1 AND "createdAt" < $2
            AND ("metadata"->>'livemode') = 'true'`,
        [new Date(starts.thirtyDays.getTime() - 30 * DAY_MS), starts.thirtyDays],
      )
    ).rows[0];

    const statusRows = (
      await select(`SELECT status::text AS status, COUNT(*)::int AS n, COALESCE(SUM("amountCents"), 0)::bigint AS cents FROM "PaymentTransaction" GROUP BY status`)
    ).rows;

    const planRows = (
      await select(
        `SELECT COALESCE("tier"::text, 'NONE') AS tier,
                COALESCE(SUM("amountCents") FILTER (WHERE "createdAt" >= $1), 0)::bigint AS gross30,
                COALESCE(SUM(${REFUND_SQL}) FILTER (WHERE "createdAt" >= $1), 0)::bigint AS refunds30,
                COALESCE(SUM("amountCents"), 0)::bigint AS gross_all,
                COALESCE(SUM(${REFUND_SQL}), 0)::bigint AS refunds_all
           FROM "PaymentTransaction"
          WHERE "featureCode"::text = 'CORE_PLUS' AND status::text IN ('SUCCEEDED', 'REFUNDED') AND ("metadata"->>'livemode') = 'true'
          GROUP BY 1`,
        [starts.thirtyDays],
      )
    ).rows;

    const activeTierRows = (
      await select(
        `SELECT "tier"::text AS tier, COUNT(*)::int AS n
           FROM "BillingSubscription"
          WHERE status::text IN ('ACTIVE', 'TRIALING', 'PAST_DUE')
          GROUP BY 1`,
      )
    ).rows;

    const activity = (
      await select(
        `SELECT (SELECT COUNT(*) FILTER (WHERE status::text IN ('SUCCEEDED', 'REFUNDED') AND "metadata"->>'billingReason' = 'subscription_cycle' AND "createdAt" >= $1)
                   FROM "PaymentTransaction")::int AS renewals,
                (SELECT COUNT(*) FILTER (WHERE status::text = 'FAILED' AND "featureCode"::text = 'CORE_PLUS' AND "createdAt" >= $1)
                   FROM "PaymentTransaction")::int AS failed_renewals,
                (SELECT COUNT(*) FROM "BillingSubscription" WHERE status::text = 'CANCELED' AND "updatedAt" >= $1)::int AS stripe_ended,
                (SELECT COUNT(*) FROM "StorePurchase" WHERE status IN ('EXPIRED', 'REVOKED') AND "updatedAt" >= $1)::int AS store_ended,
                (SELECT COUNT(*) FROM "PaymentTransaction" WHERE status::text = 'FAILED' AND "createdAt" >= $1)::int AS failed30`,
        [starts.thirtyDays],
      )
    ).rows[0];

    const membership = (
      await select(
        `SELECT (SELECT COUNT(*) FROM "User" WHERE premium = true)::int AS premium_users,
                (SELECT COUNT(*) FROM "User" WHERE "lifetimeMember" = true)::int AS lifetime_members,
                (SELECT COUNT(*) FROM "BillingSubscription" WHERE status::text IN ('ACTIVE', 'TRIALING', 'PAST_DUE'))::int AS stripe_active,
                (SELECT COUNT(DISTINCT "userId") FROM "BillingSubscription" WHERE status::text IN ('ACTIVE', 'TRIALING', 'PAST_DUE'))::int AS stripe_active_users,
                (SELECT COUNT(DISTINCT "userId") FROM "StorePurchase"
                  WHERE status = 'ACTIVE' AND tier IS NOT NULL AND ("expiresAt" IS NULL OR "expiresAt" > $1))::int AS store_active_users,
                -- Premium with no payment behind it: not lifetime, no live Stripe or store subscription, and no successful payment ever.
                (SELECT COUNT(*) FROM "User" u
                  WHERE u.premium = true AND u."lifetimeMember" = false
                    AND NOT EXISTS (SELECT 1 FROM "BillingSubscription" b WHERE b."userId" = u.id AND b.status::text IN ('ACTIVE', 'TRIALING', 'PAST_DUE'))
                    AND NOT EXISTS (SELECT 1 FROM "StorePurchase" s WHERE s."userId" = u.id AND s.status = 'ACTIVE' AND s.tier IS NOT NULL AND (s."expiresAt" IS NULL OR s."expiresAt" > $1))
                    AND NOT EXISTS (SELECT 1 FROM "PaymentTransaction" p WHERE p."userId" = u.id AND p.status::text IN ('SUCCEEDED', 'REFUNDED')))::int AS premium_without_payment`,
        [now],
      )
    ).rows[0];

    // One row per member: the latest Stripe subscription and the live store purchase, if either exists.
    const memberRows = (
      await select(
        `SELECT u.username,
                u."premiumTier"::text AS tier,
                u."lifetimeMember" AS lifetime,
                bs.status::text AS stripe_status,
                bs."currentPeriodEnd" AS stripe_period_end,
                bs."cancelAtPeriodEnd" AS cancel_at_period_end,
                bs."interval"::text AS stripe_interval,
                sp.provider AS store_provider,
                sp.expires_at AS store_expires_at
           FROM "User" u
           LEFT JOIN LATERAL (
             SELECT status, "currentPeriodEnd", "cancelAtPeriodEnd", "interval"
               FROM "BillingSubscription" b
              WHERE b."userId" = u.id
              ORDER BY b."updatedAt" DESC
              LIMIT 1
           ) bs ON true
           LEFT JOIN LATERAL (
             SELECT provider::text AS provider, "expiresAt" AS expires_at
               FROM "StorePurchase" s
              WHERE s."userId" = u.id AND s.status = 'ACTIVE' AND s.tier IS NOT NULL
                AND (s."expiresAt" IS NULL OR s."expiresAt" > $1)
              ORDER BY s."expiresAt" DESC NULLS FIRST
              LIMIT 1
           ) sp ON true
          WHERE u.premium = true OR u."lifetimeMember" = true OR bs.status IS NOT NULL OR sp.provider IS NOT NULL
          ORDER BY u.username
          LIMIT ${MEMBER_LIMIT}`,
        [now],
      )
    ).rows;

    const recentRows = (
      await select(
        `SELECT p.status::text AS status,
                p."amountCents" AS amount_cents,
                p."featureCode"::text AS feature,
                p.tier::text AS tier,
                p.provider::text AS provider,
                p."createdAt" AS created_at,
                p.metadata->>'amountRefundedCents' AS refunded_cents,
                u.username
           FROM "PaymentTransaction" p
           JOIN "User" u ON u.id = p."userId"
          ORDER BY p."createdAt" DESC
          LIMIT ${RECENT_LIMIT}`,
      )
    ).rows;

    const storeRows = (
      await select(
        `SELECT provider::text AS provider, status::text AS status,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE "purchasedAt" >= $1)::int AS last30
           FROM "StorePurchase"
          GROUP BY provider, status`,
        [starts.thirtyDays],
      )
    ).rows;

    return { totals, environments, previousThirtyCents: Number(previousThirty.cents), statusRows, planRows, activeTierRows, activity, membership, memberRows, recentRows, storeRows };
  });

  const webhook = await webhookActivity();
  const stripeMode = stripeModeFrom(env.valueOf("STRIPE_SECRET_KEY"));

  const statusFor = (name) => {
    const row = data.statusRows.find((entry) => entry.status === name);
    return { count: row ? row.n : 0, cents: row ? Number(row.cents) : 0 };
  };

  const tiers = {};
  for (const tier of TIERS) tiers[tier] = { tier, grossCents30: 0, refundsCents30: 0, grossCentsAll: 0, refundsCentsAll: 0, activeSubscriptions: 0 };
  for (const row of data.planRows) {
    if (!(row.tier in tiers)) continue;
    tiers[row.tier].grossCents30 = Number(row.gross30);
    tiers[row.tier].refundsCents30 = Number(row.refunds30);
    tiers[row.tier].grossCentsAll = Number(row.gross_all);
    tiers[row.tier].refundsCentsAll = Number(row.refunds_all);
  }
  for (const row of data.activeTierRows) if (row.tier in tiers) tiers[row.tier].activeSubscriptions = row.n;

  const lastThirtyCents = data.totals.thirtyDays.grossCents;
  const previousThirtyCents = data.previousThirtyCents;

  return {
    generatedAt: now.toISOString(),
    stripeMode,
    totals: data.totals,
    revenue: {
      last30DaysCents: lastThirtyCents,
      previous30DaysCents: previousThirtyCents,
      growthPct: growthPercent(lastThirtyCents, previousThirtyCents),
      failedPayments30: data.activity.failed30,
      activeSubscriptions: data.membership.stripe_active,
    },
    statuses: {
      succeeded: statusFor("SUCCEEDED"),
      refunded: statusFor("REFUNDED"),
      pending: statusFor("PENDING"),
      failed: statusFor("FAILED"),
    },
    processingFees: {
      available: false,
      note: "The app does not record Stripe processing fees yet, so net revenue here is gross minus refunds, before fees.",
    },
    plans: TIERS.map((tier) => tiers[tier]),
    activity: {
      renewals30: data.activity.renewals,
      failedRenewals30: data.activity.failed_renewals,
      stripeEnded30: data.activity.stripe_ended,
      storeEnded30: data.activity.store_ended,
    },
    // Test and unrecorded payments, kept apart from the live headline above. Never added to revenue.
    environments: {
      thirtyDays: data.environments.thirtyDays,
      allTime: data.environments.allTime,
    },
    disputes: {
      openCount: data.environments.allTime.live.openDisputes,
      openCents: data.environments.allTime.live.disputeOpenCents,
      lostCents: data.environments.allTime.live.disputeLostCents,
      note: "Open disputes are money Stripe may still take back, so they are shown but not deducted. Lost disputes are deducted from net revenue.",
    },
    webhook,
    membership: {
      premiumUsers: data.membership.premium_users,
      lifetimeMembers: data.membership.lifetime_members,
      stripeActive: data.membership.stripe_active,
      stripeActiveUsers: data.membership.stripe_active_users,
      storeActiveUsers: data.membership.store_active_users,
      // Premium that is not paid for by any recorded payment (granted by hand or another way). Not revenue.
      premiumWithoutPayment: data.membership.premium_without_payment,
    },
    members: data.memberRows.map((row) => ({
      username: row.username,
      tier: row.tier,
      lifetime: row.lifetime,
      // A premium flag with no payment behind it is shown as such, not as a paying member.
      source: row.store_provider ? "App store" : row.stripe_status ? "Stripe" : row.lifetime ? "Lifetime" : "Premium, no payment on record",
      stripeStatus: row.stripe_status,
      stripeInterval: row.stripe_interval,
      renewsOrEndsAt: row.stripe_period_end ? new Date(row.stripe_period_end).toISOString() : null,
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
      storeProvider: row.store_provider,
      storeExpiresAt: row.store_expires_at ? new Date(row.store_expires_at).toISOString() : null,
    })),
    recent: data.recentRows.map((row) => ({
      status: row.status,
      amountCents: Number(row.amount_cents),
      refundedCents: row.refunded_cents === null ? null : Number(row.refunded_cents),
      feature: row.feature,
      featureLabel: FEATURE_LABELS[row.feature] ?? row.feature,
      tier: row.tier,
      provider: row.provider,
      createdAt: new Date(row.created_at).toISOString(),
      username: row.username,
    })),
    store: {
      providers: summarizeStore(data.storeRows.map((row) => ({ provider: row.provider, status: row.status, total: row.total, last30: row.last30 }))),
      note: "Store prices are not recorded, so store purchases are counted here, not added to revenue.",
    },
    billing: billingReadiness((key) => env.describe(key)),
  };
}

let cache = null;

/** The finance numbers, read on demand and kept for 30 seconds so reloads do not query the database each time. */
async function buildFinance(now = new Date()) {
  if (cache && now.getTime() - cache.at < CACHE_MS) return cache.value;
  const value = await readFinance(now);
  cache = { at: now.getTime(), value };
  return value;
}

module.exports = { buildFinance, growthPercent, summarizeStore, billingReadiness, stripeModeFrom, windowStarts, FEATURE_LABELS };
