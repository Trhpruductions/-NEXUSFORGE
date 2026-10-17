"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  parseAmountCents,
  validateExpense,
  presetRange,
  summarizeExpenses,
  buildProfit,
  ledgerQuery,
  likePattern,
  trendUnit,
} = require("../lib/expenses");

const NOON_OCT_16 = new Date("2026-10-16T12:00:00Z");

test("amounts are read as exact cents and refused when they are not plain positive money", () => {
  assert.deepEqual(parseAmountCents("12.34"), { cents: 1234 });
  assert.deepEqual(parseAmountCents("12"), { cents: 1200 });
  assert.deepEqual(parseAmountCents("0.5"), { cents: 50 });
  assert.deepEqual(parseAmountCents("1000000"), { cents: 100000000 });
  for (const bad of ["", "-1", "1.234", "abc", "0", "0.00", "1000001", "12,34", 12.34]) {
    assert.ok(parseAmountCents(bad).error, `expected ${JSON.stringify(bad)} to be refused`);
  }
});

test("a new expense needs an amount, a real date, a category and a description, and defaults to USD", () => {
  const ok = validateExpense({ amount: "9.99", date: "2026-10-15", category: "HOSTING", description: "  Server rent  " }, { today: "2026-10-16" });
  assert.deepEqual(ok.value, {
    amountCents: 999,
    currency: "USD",
    expenseDate: "2026-10-15",
    category: "HOSTING",
    description: "Server rent",
    reference: "",
  });

  const bad = validateExpense({ amount: "9.99", date: "2026-02-30", category: "NOPE", description: "   " }, { today: "2026-10-16" });
  assert.equal(bad.errors.length, 3);
  assert.match(bad.errors.join(" "), /not a real calendar day/);
  assert.match(bad.errors.join(" "), /Choose a category/);
  assert.match(bad.errors.join(" "), /Description is required/);
});

test("future dates, dates before 2000 and bad currency codes are refused", () => {
  const base = { amount: "1", category: "OTHER", description: "x" };
  assert.match(validateExpense({ ...base, date: "2026-10-18", currency: "USD" }, { today: "2026-10-16" }).errors[0], /future/);
  assert.equal(validateExpense({ ...base, date: "2026-10-17", currency: "USD" }, { today: "2026-10-16" }).value.expenseDate, "2026-10-17");
  assert.match(validateExpense({ ...base, date: "1999-12-31", currency: "USD" }, { today: "2026-10-16" }).errors[0], /before 2000/);
  assert.match(validateExpense({ ...base, date: "2026-10-16", currency: "dollars" }, { today: "2026-10-16" }).errors[0], /three-letter code/);
});

test("an update checks only the fields it sends, and an empty update is refused", () => {
  assert.deepEqual(validateExpense({ description: "New text" }, { partial: true }).value, { description: "New text" });
  assert.deepEqual(validateExpense({}, { partial: true }).errors, ["Nothing to change."]);
});

test("the descriptions and references are length-limited", () => {
  const long = "x".repeat(201);
  const result = validateExpense({ amount: "1", date: "2026-10-16", category: "OTHER", description: long, reference: long }, { today: "2026-10-16" });
  assert.equal(result.errors.length, 2);
});

test("periods are inclusive UTC days, with the end counted through the start of the next day", () => {
  assert.deepEqual(presetRange("month", NOON_OCT_16), {
    preset: "month",
    from: "2026-10-01",
    to: "2026-10-16",
    sinceIso: "2026-10-01T00:00:00.000Z",
    untilIso: "2026-10-17T00:00:00.000Z",
  });
  assert.equal(presetRange("quarter", NOON_OCT_16).from, "2026-10-01");
  assert.equal(presetRange("quarter", new Date("2026-02-10T00:00:00Z")).from, "2026-01-01");
  assert.equal(presetRange("year", NOON_OCT_16).from, "2026-01-01");
  assert.equal(presetRange("today", NOON_OCT_16).from, "2026-10-16");
  assert.equal(presetRange("last30", NOON_OCT_16).from, "2026-09-17");
  assert.equal(presetRange("all", NOON_OCT_16).from, "2000-01-01");
});

test("a week starts on Monday, including when today is a Sunday", () => {
  assert.equal(presetRange("week", new Date("2026-10-16T12:00:00Z")).from, "2026-10-12");
  assert.equal(presetRange("week", new Date("2026-10-18T12:00:00Z")).from, "2026-10-12");
});

test("a custom range is checked: order, real dates, and at most ten years", () => {
  assert.equal(presetRange("custom", NOON_OCT_16, { from: "2026-10-01", to: "2026-10-05" }).to, "2026-10-05");
  assert.throws(() => presetRange("custom", NOON_OCT_16, { from: "2026-10-05", to: "2026-10-01" }), /must not be after/);
  assert.throws(() => presetRange("custom", NOON_OCT_16, { from: "2015-01-01", to: "2026-10-01" }), /at most ten years/);
  assert.throws(() => presetRange("custom", NOON_OCT_16, { from: "2026-10-01", to: "2026-13-01" }), /To:/);
  assert.throws(() => presetRange("forever", NOON_OCT_16), /Unknown period/);
});

test("only USD expenses go into the totals; other currencies are counted and left out", () => {
  const summary = summarizeExpenses([
    { category: "HOSTING", currency: "USD", count: 2, cents: 5000 },
    { category: "MARKETING", currency: "USD", count: 1, cents: 1200 },
    { category: "HOSTING", currency: "EUR", count: 1, cents: 9999 },
    { category: "PROCESSING_FEES", currency: "USD", count: 1, cents: 300 },
    { category: "REFUNDS_CHARGEBACKS", currency: "USD", count: 1, cents: 1500 },
  ]);
  assert.equal(summary.operatingCents, 6200);
  assert.equal(summary.feeCents, 300);
  assert.equal(summary.feeCount, 1);
  assert.equal(summary.disputeCostCents, 1500);
  assert.equal(summary.otherCurrencyCount, 1);
  assert.equal(summary.usdCents, 5000 + 1200 + 300 + 1500);
  assert.deepEqual(summary.byCurrency.EUR, { count: 1, cents: 9999 });
});

test("profit is net collected revenue less the recorded costs, and fees are never estimated", () => {
  const expenses = summarizeExpenses([{ category: "HOSTING", currency: "USD", count: 1, cents: 2000 }]);
  const profit = buildProfit({ grossCents: 10000, refundsCents: 1000, disputeLostCents: 500, openDisputeCents: 0, expenses, storePurchasesInPeriod: 0 });
  assert.equal(profit.netCollectedCents, 8500);
  assert.equal(profit.processingFeesCents, null);
  assert.equal(profit.operatingExpensesCents, 2000);
  assert.equal(profit.operatingProfitCents, 6500);
  assert.equal(profit.label, "Recorded profit based on available data");
  assert.match(profit.gaps.join(" "), /profit is before fees/);
});

test("entered processing fees are deducted, and the gaps say what is still missing", () => {
  const expenses = summarizeExpenses([
    { category: "PROCESSING_FEES", currency: "USD", count: 1, cents: 300 },
    { category: "REFUNDS_CHARGEBACKS", currency: "USD", count: 1, cents: 1500 },
    { category: "OTHER", currency: "GBP", count: 1, cents: 700 },
  ]);
  const profit = buildProfit({ grossCents: 10000, refundsCents: 0, disputeLostCents: 0, openDisputeCents: 250, expenses, storePurchasesInPeriod: 4 });
  assert.equal(profit.processingFeesCents, 300);
  assert.equal(profit.disputeCostsCents, 1500);
  assert.equal(profit.operatingProfitCents, 10000 - 300 - 0 - 1500);
  const text = profit.gaps.join(" ");
  assert.match(text, /1 expense\(s\) in other currencies/);
  assert.match(text, /Open disputes are not deducted/);
  assert.match(text, /4 store purchase\(s\) are not counted/);
});

test("a refund or lost dispute is never deducted twice: refund amounts are already in revenue, so only costs come off profit", () => {
  const profit = buildProfit({ grossCents: 5000, refundsCents: 5000, disputeLostCents: 0, openDisputeCents: 0, expenses: summarizeExpenses([]), storePurchasesInPeriod: 0 });
  assert.equal(profit.netCollectedCents, 0);
  assert.equal(profit.operatingProfitCents, 0);
});

test("ledger paging and search input are clamped and never trusted", () => {
  assert.deepEqual(ledgerQuery({}), { limit: 25, offset: 0, status: null, search: "" });
  assert.deepEqual(ledgerQuery({ limit: "999", offset: "-5", status: "PAID", q: `  ${"a".repeat(100)}  ` }), {
    limit: 100,
    offset: 0,
    status: null,
    search: "a".repeat(64),
  });
  assert.equal(ledgerQuery({ status: "REFUNDED" }).status, "REFUNDED");
});

test("search text matches literally: LIKE wildcards are escaped", () => {
  assert.equal(likePattern("50%_"), "%50\\%\\_%");
  assert.equal(likePattern("a\\b"), "%a\\\\b%");
});

test("trend steps are limited to the known list", () => {
  assert.equal(trendUnit("week"), "week");
  assert.throws(() => trendUnit("hour"), /day, week, month, quarter or year/);
});
