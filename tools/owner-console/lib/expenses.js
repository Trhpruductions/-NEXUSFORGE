"use strict";

// Owner expenses and profit rules. Pure functions only: nothing here reads or writes a database.
//
// Profit rules (the owner's decisions, 2026-10-16):
// - Gross sales are live Stripe payments only. Test-mode and unrecorded payments are never counted.
// - Refunds and lost disputes are deducted from net collected revenue, as Stripe reports them.
// - Processing fees are deducted only when the owner enters them with a reference from a statement. Nothing is estimated.
// - Refund and chargeback costs entered by hand are fees or costs only. The refund amounts themselves are already in revenue.
// - Only USD expenses are added up. Other currencies are kept and counted, but not added to the total, because there is no exchange rate.
// - Store purchases have no recorded price, so they are never added to revenue or profit.

const CATEGORIES = ["HOSTING", "SOFTWARE", "MARKETING", "CONTRACTORS", "PROCESSING_FEES", "REFUNDS_CHARGEBACKS", "OTHER"];

const CATEGORY_LABELS = {
  HOSTING: "Hosting and infrastructure",
  SOFTWARE: "Software and subscriptions",
  MARKETING: "Marketing",
  CONTRACTORS: "Contractors and development",
  PROCESSING_FEES: "Payment processing fees",
  REFUNDS_CHARGEBACKS: "Chargeback and dispute costs",
  OTHER: "Other business expenses",
};

// Operating costs come off profit. Fees and dispute costs have their own lines.
const OPERATING_CATEGORIES = ["HOSTING", "SOFTWARE", "MARKETING", "CONTRACTORS", "OTHER"];

const MAX_AMOUNT_CENTS = 100000000; // $1,000,000 for one entry. Larger amounts must be split.
const EARLIEST_DATE = "2000-01-01";
const MAX_RANGE_DAYS = 3660;
const DAY_MS = 24 * 60 * 60 * 1000;

const PRESETS = ["today", "week", "month", "quarter", "year", "last30", "all", "custom"];

const LEDGER_STATUSES = ["SUCCEEDED", "REFUNDED", "PENDING", "FAILED"];
const TREND_UNITS = ["day", "week", "month", "quarter", "year"];

function utcDateText(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateText, days) {
  return utcDateText(new Date(Date.parse(`${dateText}T00:00:00Z`) + days * DAY_MS));
}

/** Parses "12.34" into 1234 cents. Refuses anything that is not a plain positive amount with at most two decimals. */
function parseAmountCents(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(text)) return { error: "Amount must be a number with up to two decimals, like 12.34." };
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (cents <= 0) return { error: "Amount must be more than zero." };
  if (cents > MAX_AMOUNT_CENTS) return { error: "Amount is above $1,000,000. Enter it as several expenses." };
  return { cents };
}

/** A calendar date in YYYY-MM-DD form that exists, is not before 2000, and is not after today. */
function checkDate(text, today) {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return "Date must look like 2026-10-16.";
  const parsed = Date.parse(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed) || utcDateText(new Date(parsed)) !== text) return "Date is not a real calendar day.";
  if (text < EARLIEST_DATE) return "Date is before 2000-01-01.";
  // One day of slack: the owner's local day can be ahead of the UTC day the server uses.
  if (text > addDays(today, 1)) return "Date is in the future.";
  return null;
}

/**
 * Checks an expense from the browser. A create needs every field; an update (partial) checks only the fields sent.
 * Returns { value } with the cleaned fields, or { errors } with one message per problem.
 */
function validateExpense(input, { today = utcDateText(new Date()), partial = false } = {}) {
  const errors = [];
  const body = input && typeof input === "object" ? input : {};
  const value = {};
  const has = (key) => body[key] !== undefined;

  if (!partial || has("amount")) {
    const amount = parseAmountCents(body.amount);
    if (amount.error) errors.push(amount.error);
    else value.amountCents = amount.cents;
  }
  if (!partial || has("currency")) {
    const currency = typeof body.currency === "string" && body.currency.trim() !== "" ? body.currency.trim().toUpperCase() : "USD";
    if (!/^[A-Z]{3}$/.test(currency)) errors.push("Currency must be a three-letter code, like USD.");
    else value.currency = currency;
  }
  if (!partial || has("date")) {
    const problem = checkDate(body.date, today);
    if (problem) errors.push(problem);
    else value.expenseDate = body.date;
  }
  if (!partial || has("category")) {
    if (!CATEGORIES.includes(body.category)) errors.push("Choose a category from the list.");
    else value.category = body.category;
  }
  if (!partial || has("description")) {
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (description.length === 0) errors.push("Description is required.");
    else if (description.length > 200) errors.push("Description must be 200 characters or fewer.");
    else value.description = description;
  }
  if (!partial || has("reference")) {
    const reference = typeof body.reference === "string" ? body.reference.trim() : "";
    if (reference.length > 200) errors.push("Reference must be 200 characters or fewer.");
    else value.reference = reference;
  }
  if (partial && Object.keys(value).length === 0 && errors.length === 0) errors.push("Nothing to change.");
  return errors.length > 0 ? { errors } : { value };
}

/**
 * The date range for a period. Dates are inclusive days in UTC. `untilIso` is the start of the day after `to`,
 * so payments are counted with "createdAt >= since AND createdAt < until".
 */
function presetRange(preset, now = new Date(), custom = {}) {
  if (!PRESETS.includes(preset)) throw new Error("Unknown period.");
  const today = utcDateText(now);
  let from;
  let to = today;
  if (preset === "today") from = today;
  else if (preset === "week") from = addDays(today, -((now.getUTCDay() + 6) % 7));
  else if (preset === "month") from = `${today.slice(0, 8)}01`;
  else if (preset === "quarter") from = `${today.slice(0, 4)}-${String(Math.floor((now.getUTCMonth()) / 3) * 3 + 1).padStart(2, "0")}-01`;
  else if (preset === "year") from = `${today.slice(0, 4)}-01-01`;
  else if (preset === "last30") from = addDays(today, -29);
  else if (preset === "all") from = EARLIEST_DATE;
  else {
    from = custom.from;
    to = custom.to;
    const fromProblem = checkDate(from, today);
    const toProblem = checkDate(to, today);
    if (fromProblem) throw new Error(`From: ${fromProblem}`);
    if (toProblem) throw new Error(`To: ${toProblem}`);
    if (from > to) throw new Error("From must not be after To.");
    if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS > MAX_RANGE_DAYS) throw new Error("A custom range can cover at most ten years.");
  }
  return { preset, from, to, sinceIso: `${from}T00:00:00.000Z`, untilIso: `${addDays(to, 1)}T00:00:00.000Z` };
}

/** Adds up expense rows (already filtered to live, not voided ones). Only USD goes into totals; other currencies are listed. */
function summarizeExpenses(rows) {
  const byCategory = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  const byCurrency = {};
  let usdCents = 0;
  let count = 0;
  for (const row of rows) {
    count += row.count;
    byCurrency[row.currency] = (byCurrency[row.currency] || { count: 0, cents: 0 });
    byCurrency[row.currency].count += row.count;
    byCurrency[row.currency].cents += row.cents;
    if (row.currency === "USD") {
      byCategory[row.category] = (byCategory[row.category] || 0) + row.cents;
      usdCents += row.cents;
    }
  }
  const operatingCents = OPERATING_CATEGORIES.reduce((sum, category) => sum + byCategory[category], 0);
  const otherCurrencyCount = Object.entries(byCurrency).filter(([currency]) => currency !== "USD").reduce((sum, [, entry]) => sum + entry.count, 0);
  return {
    count,
    usdCents,
    operatingCents,
    feeCents: byCategory.PROCESSING_FEES,
    feeCount: rows.filter((row) => row.currency === "USD" && row.category === "PROCESSING_FEES").reduce((sum, row) => sum + row.count, 0),
    disputeCostCents: byCategory.REFUNDS_CHARGEBACKS,
    byCategory,
    byCurrency,
    otherCurrencyCount,
  };
}

/**
 * Profit for a period. Every figure is either a recorded amount or null (for fees, when none were entered).
 * `gaps` lists what is missing, so the result is never presented as more complete than it is.
 */
function buildProfit({ grossCents, refundsCents, disputeLostCents, openDisputeCents, expenses, storePurchasesInPeriod }) {
  const netCollectedCents = grossCents - refundsCents - disputeLostCents;
  const feesRecorded = expenses.feeCount > 0;
  const feeCents = feesRecorded ? expenses.feeCents : null;
  const operatingProfitCents = netCollectedCents - (feeCents ?? 0) - expenses.operatingCents - expenses.disputeCostCents;

  const gaps = [];
  if (!feesRecorded) gaps.push("Payment processing fees: none entered for this period, so profit is before fees.");
  if (expenses.otherCurrencyCount > 0) gaps.push(`${expenses.otherCurrencyCount} expense(s) in other currencies are not in the totals.`);
  if (openDisputeCents > 0) gaps.push("Open disputes are not deducted. Stripe may return the money.");
  if (storePurchasesInPeriod > 0) gaps.push(`${storePurchasesInPeriod} store purchase(s) are not counted: no prices are recorded.`);
  gaps.push("Only the expenses you have entered are included. Anything not entered is missing.");

  return {
    label: "Recorded profit based on available data",
    grossSalesCents: grossCents,
    refundsCents,
    disputeLostCents,
    netCollectedCents,
    processingFeesCents: feeCents,
    operatingExpensesCents: expenses.operatingCents,
    disputeCostsCents: expenses.disputeCostCents,
    operatingProfitCents,
    gaps,
  };
}

/** Clamps the ledger's paging and search input. Search text is trimmed and length-limited, never used raw in SQL. */
function ledgerQuery(query = {}) {
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25));
  const offset = Math.max(0, Number.parseInt(query.offset, 10) || 0);
  const status = LEDGER_STATUSES.includes(query.status) ? query.status : null;
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 64) : "";
  return { limit, offset, status, search };
}

/** Escapes LIKE wildcards so the owner's search text matches literally. */
function likePattern(text) {
  return `%${text.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

function trendUnit(unit) {
  if (!TREND_UNITS.includes(unit)) throw new Error("Trend must be day, week, month, quarter or year.");
  return unit;
}

module.exports = {
  CATEGORIES,
  CATEGORY_LABELS,
  OPERATING_CATEGORIES,
  PRESETS,
  LEDGER_STATUSES,
  TREND_UNITS,
  MAX_AMOUNT_CENTS,
  parseAmountCents,
  validateExpense,
  presetRange,
  summarizeExpenses,
  buildProfit,
  ledgerQuery,
  likePattern,
  trendUnit,
  utcDateText,
  addDays,
};
