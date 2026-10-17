"use strict";

// The owner's Finance period report, payment ledger and membership counts. Read only: every query is a SELECT through the
// read-only role. Expense totals come from the console's own expense ledger, which the caller passes in, so nothing here
// writes anywhere. Times are UTC. Each timestamp is formatted in SQL, so no time-zone shift can creep in on this PC.

const { withReadOnly } = require("./appdb");
const { loadEnvFiles } = require("./envfiles");
const finance = require("./finance");
const { summarizeExpenses, buildProfit, ledgerQuery, likePattern, trendUnit } = require("./expenses");

const DAY_MS = 24 * 60 * 60 * 1000;
const { REFUND_SQL, DISPUTE_LOST_SQL } = finance;

/** The trend step that keeps a range to roughly 12 to 60 points. */
function trendUnitFor(range) {
  const days = (Date.parse(range.untilIso) - Date.parse(range.sinceIso)) / DAY_MS;
  if (days <= 62) return "day";
  if (days <= 400) return "week";
  if (days <= 1100) return "month";
  if (days <= 3300) return "quarter";
  return "year";
}

function environmentLabel(livemode) {
  if (livemode === "true") return "live";
  if (livemode === "false") return "test";
  return "unrecorded";
}

function num(value) {
  return Number(value || 0);
}

/**
 * The period report: live totals (with test and unrecorded kept apart), the trend, recurring payments, membership counts,
 * and profit for the period. `expenses` is the ExpenseLedger, or null when none is open.
 */
async function buildPeriodReport({ now = new Date(), range, expenses = null }) {
  const env = loadEnvFiles();
  const since = new Date(range.sinceIso);
  const until = new Date(range.untilIso);
  const unit = trendUnit(trendUnitFor(range));

  const data = await withReadOnly(async (select) => {
    const totals = await finance.totalsSince(select, since, until);

    const trendRows = (
      await select(
        `SELECT to_char(date_trunc($3::text, "createdAt"), 'YYYY-MM-DD') AS bucket,
                COUNT(*)::int AS transactions,
                COALESCE(SUM("amountCents"), 0)::bigint AS gross_cents,
                COALESCE(SUM(${REFUND_SQL}), 0)::bigint AS refund_cents,
                COALESCE(SUM(${DISPUTE_LOST_SQL}), 0)::bigint AS lost_cents
           FROM "PaymentTransaction"
          WHERE status::text IN ('SUCCEEDED', 'REFUNDED') AND ("metadata"->>'livemode') = 'true'
            AND "createdAt" >= $1 AND "createdAt" < $2
          GROUP BY 1
          ORDER BY 1`,
        [since, until, unit],
      )
    ).rows;

    const recurring = (
      await select(
        `SELECT COUNT(*)::int AS n, COALESCE(SUM("amountCents"), 0)::bigint AS cents
           FROM "PaymentTransaction"
          WHERE status::text IN ('SUCCEEDED', 'REFUNDED') AND ("metadata"->>'livemode') = 'true'
            AND "metadata"->>'billingReason' = 'subscription_cycle'
            AND "createdAt" >= $1 AND "createdAt" < $2`,
        [since, until],
      )
    ).rows[0];

    const failed = (
      await select(
        `SELECT COUNT(*)::int AS n
           FROM "PaymentTransaction"
          WHERE status::text = 'FAILED' AND ("metadata"->>'livemode') = 'true' AND "createdAt" >= $1 AND "createdAt" < $2`,
        [since, until],
      )
    ).rows[0];

    const counts = (
      await select(
        `SELECT (SELECT COUNT(*) FROM "User")::int AS total_users,
                (SELECT COUNT(*) FROM "User" WHERE "lastSeenAt" >= $3)::int AS seen_5m,
                (SELECT COUNT(*) FROM "User" WHERE "lastSeenAt" >= $4)::int AS seen_30d,
                (SELECT COUNT(*) FROM "User" WHERE premium = false AND "lifetimeMember" = false)::int AS free_users,
                (SELECT COUNT(*) FROM "BillingSubscription" WHERE status::text = 'ACTIVE')::int AS stripe_active,
                (SELECT COUNT(*) FROM "BillingSubscription" WHERE status::text = 'TRIALING')::int AS stripe_trialing,
                (SELECT COUNT(*) FROM "BillingSubscription" WHERE status::text = 'PAST_DUE')::int AS stripe_past_due,
                (SELECT COUNT(*) FROM "BillingSubscription" WHERE status::text = 'CANCELED')::int AS stripe_canceled,
                (SELECT COUNT(*) FROM "BillingSubscription" WHERE "createdAt" >= $1 AND "createdAt" < $2)::int AS stripe_new,
                (SELECT COUNT(*) FROM "BillingSubscription" WHERE status::text = 'CANCELED' AND "updatedAt" >= $1 AND "updatedAt" < $2)::int AS stripe_ended,
                (SELECT COUNT(*) FROM "StorePurchase" WHERE "purchasedAt" >= $1 AND "purchasedAt" < $2)::int AS store_bought,
                (SELECT COUNT(*) FROM "StorePurchase" WHERE status IN ('EXPIRED', 'REVOKED') AND "updatedAt" >= $1 AND "updatedAt" < $2)::int AS store_ended`,
        [since, until, new Date(now.getTime() - 5 * 60 * 1000), new Date(now.getTime() - 30 * DAY_MS)],
      )
    ).rows[0];

    const membership = await finance.membershipCounts(select, now);

    return { totals, trendRows, recurring, failed, counts, membership };
  });

  const expenseSummary = expenses ? expenses.summary({ from: range.from, to: range.to }) : summarizeExpenses([]);
  const live = data.totals.live;
  const profit = buildProfit({
    grossCents: live.grossCents,
    refundsCents: live.refundsCents,
    disputeLostCents: live.disputeLostCents,
    openDisputeCents: live.disputeOpenCents,
    expenses: expenseSummary,
    storePurchasesInPeriod: num(data.counts.store_bought),
  });

  return {
    generatedAt: now.toISOString(),
    range: { preset: range.preset, from: range.from, to: range.to },
    stripeMode: finance.stripeModeFrom(env.valueOf("STRIPE_SECRET_KEY")),
    // Live is the headline. Test and unrecorded stay in their own buckets and are never added to revenue or profit.
    money: {
      live: { ...live },
      test: { ...data.totals.test },
      unrecorded: { ...data.totals.unrecorded },
    },
    trend: {
      unit,
      points: data.trendRows.map((row) => ({
        bucket: row.bucket,
        transactions: num(row.transactions),
        grossCents: num(row.gross_cents),
        refundsCents: num(row.refund_cents),
        disputeLostCents: num(row.lost_cents),
        netCents: num(row.gross_cents) - num(row.refund_cents) - num(row.lost_cents),
      })),
    },
    recurring: {
      renewalCount: num(data.recurring.n),
      renewalGrossCents: num(data.recurring.cents),
      failedLivePayments: num(data.failed.n),
      note: "Recurring revenue is the live renewal payments in this period. MRR and ARR are not shown: the app does not record a price for each subscription.",
    },
    membership: {
      totalUsers: num(data.counts.total_users),
      // Last seen in the last 5 minutes. A rough "online now" figure, not a live presence signal.
      seenLast5Minutes: num(data.counts.seen_5m),
      activeLast30Days: num(data.counts.seen_30d),
      freeUsers: num(data.counts.free_users),
      premiumUsers: num(data.membership.premium_users),
      lifetimeMembers: num(data.membership.lifetime_members),
      stripe: {
        active: num(data.counts.stripe_active),
        trialing: num(data.counts.stripe_trialing),
        pastDue: num(data.counts.stripe_past_due),
        canceled: num(data.counts.stripe_canceled),
      },
      storeActiveUsers: num(data.membership.store_active_users),
      premiumWithoutPayment: num(data.membership.premium_without_payment),
      newPaidSubscriptions: num(data.counts.stripe_new) + num(data.counts.store_bought),
      endedInPeriod: num(data.counts.stripe_ended) + num(data.counts.store_ended),
      note: "Upgrades are not counted: the app keeps only each member's current tier, not its history. An active membership is not the same as an active paid subscription; premium with no payment is shown separately.",
    },
    profit,
    expenses: {
      count: expenseSummary.count,
      usdCents: expenseSummary.usdCents,
      byCategory: expenseSummary.byCategory,
      byCurrency: expenseSummary.byCurrency,
      otherCurrencyCount: expenseSummary.otherCurrencyCount,
    },
  };
}

/**
 * Payments in a period, newest first, with search by member name and filter by status. Read only.
 * The search text is matched literally (wildcards escaped) and the page size is capped.
 */
async function readLedger({ range, query = {} }) {
  const q = ledgerQuery(query);
  const since = new Date(range.sinceIso);
  const until = new Date(range.untilIso);
  const params = [since, until, q.status, q.search ? likePattern(q.search) : null];
  const where = `p."createdAt" >= $1 AND p."createdAt" < $2
      AND ($3::text IS NULL OR p.status::text = $3::text)
      AND ($4::text IS NULL OR u.username ILIKE $4::text)`;
  // Every column is qualified with its table. The ledger joins the user table, which also has a status column.
  const refundedSql = `COALESCE((p.metadata->>'amountRefundedCents')::bigint, CASE WHEN p.status::text = 'REFUNDED' THEN p."amountCents" ELSE 0 END)`;

  const data = await withReadOnly(async (select) => {
    const rows = (
      await select(
        `SELECT p.id, p.status::text AS status, p."amountCents" AS amount_cents, p.currency,
                p."featureCode"::text AS feature, p.tier::text AS tier, p.provider::text AS provider,
                (p.metadata->>'livemode') AS livemode, ${refundedSql} AS refund_cents,
                to_char(p."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at, u.username
           FROM "PaymentTransaction" p
           JOIN "User" u ON u.id = p."userId"
          WHERE ${where}
          ORDER BY p."createdAt" DESC, p.id DESC
          LIMIT $5 OFFSET $6`,
        [...params, q.limit, q.offset],
      )
    ).rows;
    const total = (
      await select(
        `SELECT COUNT(*)::int AS n FROM "PaymentTransaction" p JOIN "User" u ON u.id = p."userId" WHERE ${where}`,
        params,
      )
    ).rows[0];
    return { rows, total: num(total.n) };
  });

  return {
    range: { preset: range.preset, from: range.from, to: range.to },
    query: { limit: q.limit, offset: q.offset, status: q.status, search: q.search },
    total: data.total,
    rows: data.rows.map((row) => ({
      id: row.id,
      status: row.status,
      amountCents: num(row.amount_cents),
      refundedCents: num(row.refund_cents),
      currency: row.currency,
      environment: environmentLabel(row.livemode),
      feature: row.feature,
      tier: row.tier,
      provider: row.provider,
      createdAt: `${row.created_at}Z`,
      username: row.username,
    })),
  };
}

module.exports = { buildPeriodReport, readLedger, trendUnitFor, environmentLabel };
