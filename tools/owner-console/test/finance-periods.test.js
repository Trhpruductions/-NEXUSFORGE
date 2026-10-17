"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { stripeModeFrom, windowStarts } = require("../lib/finance");

test("the Stripe mode comes from the key prefix, and the key is never returned", () => {
  assert.equal(stripeModeFrom("sk_test_abc123"), "test");
  assert.equal(stripeModeFrom("sk_live_abc123"), "live");
  assert.equal(stripeModeFrom(""), "not set");
  assert.equal(stripeModeFrom(undefined), "not set");
  assert.equal(stripeModeFrom("rk_something"), "unknown");
  for (const value of ["sk_test_abc123", "sk_live_abc123", "rk_something"]) {
    assert.ok(!stripeModeFrom(value).includes(value));
  }
});

test("periods start at UTC boundaries: today, Monday of this week, the first of the month", () => {
  // Wednesday 14 October 2026, 10:00 UTC.
  const starts = windowStarts(new Date("2026-10-14T10:00:00Z"));
  assert.equal(starts.today.toISOString(), "2026-10-14T00:00:00.000Z");
  assert.equal(starts.week.toISOString(), "2026-10-12T00:00:00.000Z", "the week starts on Monday");
  assert.equal(starts.month.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(starts.thirtyDays.toISOString(), "2026-09-14T10:00:00.000Z");
  assert.equal(starts.allTime.getTime(), 0);
});

test("on a Monday, the week starts that day, and on a Sunday it starts the Monday before", () => {
  assert.equal(windowStarts(new Date("2026-10-12T08:00:00Z")).week.toISOString(), "2026-10-12T00:00:00.000Z");
  assert.equal(windowStarts(new Date("2026-10-18T23:30:00Z")).week.toISOString(), "2026-10-12T00:00:00.000Z");
});
