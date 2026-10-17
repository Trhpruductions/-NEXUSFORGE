"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { sourceKind, describeSources, resolveChoice } = require("../lib/screen-picker-rules");

const screenA = { id: "screen:1:0", display_id: "111", name: "Screen 1" };
const screenB = { id: "screen:2:0", display_id: "222", name: "Screen 2" };
const game = { id: "window:9001:0", name: "  My Game  " };
const helper = { id: "window:9002:0", name: "   " };

test("a source's kind comes from its id", () => {
  assert.equal(sourceKind("screen:1:0"), "screen");
  assert.equal(sourceKind("window:5:0"), "window");
  assert.equal(sourceKind("tab:1"), null);
  assert.equal(sourceKind(undefined), null);
});

test("screens come first, the main screen first, then titled windows; untitled windows are left out", () => {
  const list = describeSources([game, screenA, helper, screenB], "222");
  assert.deepEqual(list.map((item) => item.id), ["screen:2:0", "screen:1:0", "window:9001:0"]);
  assert.deepEqual(list.map((item) => item.name), ["Screen 1 (main)", "Screen 2", "My Game"]);
  assert.equal(list[0].primary, true);
});

test("a single screen is called Entire screen", () => {
  const list = describeSources([screenA], "111");
  assert.equal(list[0].name, "Entire screen");
});

test("nothing to offer gives an empty list, not an error", () => {
  assert.deepEqual(describeSources([], "1"), []);
  assert.deepEqual(describeSources(null, "1"), []);
});

test("only an offered id is accepted as the choice", () => {
  const offered = ["screen:1:0", "window:9001:0"];
  assert.equal(resolveChoice(offered, "window:9001:0"), "window:9001:0");
  assert.equal(resolveChoice(offered, "window:4242:0"), null, "a source that was not offered is refused");
  assert.equal(resolveChoice(offered, ""), null);
  assert.equal(resolveChoice(offered, 42), null);
  assert.equal(resolveChoice(offered, "x".repeat(500)), null);
});
