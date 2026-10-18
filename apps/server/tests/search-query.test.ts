import test from "node:test";
import assert from "node:assert/strict";
import { hasAnyFilter, parseSearchQuery } from "../src/lib/search-query.js";

test("plain words stay as text", () => {
  const filters = parseSearchQuery("raid night plans");
  assert.equal(filters.text, "raid night plans");
  assert.deepEqual(filters.from, []);
});

test("filters are pulled out and the rest is the text", () => {
  const filters = parseSearchQuery('from:nova_owl in:#general has:link mentions:@rook scrims "boss fight"');
  assert.deepEqual(filters.from, ["nova_owl"]);
  assert.deepEqual(filters.in, ["general"]);
  assert.deepEqual(filters.has, ["link"]);
  assert.deepEqual(filters.mentions, ["rook"]);
  assert.equal(filters.text, "scrims boss fight");
});

test("quoted values allow spaces", () => {
  assert.deepEqual(parseSearchQuery('in:"raid plans" loot').in, ["raid plans"]);
});

test("dates: before, after, and during covers one whole day", () => {
  const range = parseSearchQuery("during:2026-09-15");
  assert.ok(range.after && range.before);
  assert.ok(range.after < new Date("2026-09-15T00:00:00Z") && range.before.toISOString() === "2026-09-16T00:00:00.000Z");
  assert.equal(parseSearchQuery("before:2026-13-45").before, null, "invalid dates are ignored");
  assert.equal(parseSearchQuery("after:2026-09-01").after?.toISOString(), "2026-09-01T00:00:00.000Z");
});

test("unknown keys and unknown has: values aren't silently dropped as filters", () => {
  const filters = parseSearchQuery("color:red has:banana");
  assert.equal(filters.text, "color:red");
  assert.deepEqual(filters.has, []);
});

test("a query of only unusable filters has nothing to search", () => {
  assert.equal(hasAnyFilter(parseSearchQuery("has:banana")), false);
  assert.equal(hasAnyFilter(parseSearchQuery("pinned:true")), true);
});
