import test from "node:test";
import assert from "node:assert/strict";
import { pageLimit } from "../src/lib/pagination.js";

test("a missing, empty or repeated limit gives the default", () => {
  assert.equal(pageLimit(undefined, 40, 100), 40);
  assert.equal(pageLimit("", 40, 100), 40);
  assert.equal(pageLimit("  ", 40, 100), 40);
  assert.equal(pageLimit(["10", "20"], 40, 100), 40);
});

test("a limit that isn't a number gives the default instead of reaching the database", () => {
  assert.equal(pageLimit("abc", 40, 100), 40);
  assert.equal(pageLimit("NaN", 40, 100), 40);
  assert.equal(pageLimit("Infinity", 40, 100), 40);
});

test("a limit is a whole number between 1 and the maximum", () => {
  assert.equal(pageLimit("25", 40, 100), 25);
  assert.equal(pageLimit("2.7", 40, 100), 2);
  assert.equal(pageLimit("0", 40, 100), 1);
  assert.equal(pageLimit("-5", 40, 100), 1);
  assert.equal(pageLimit("5000", 40, 100), 100);
  assert.equal(pageLimit("0.5", 20, 50), 1);
});
