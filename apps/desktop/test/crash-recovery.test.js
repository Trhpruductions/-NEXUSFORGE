"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRendererRecovery, DEFAULTS } = require("../lib/crash-recovery");

test("a crashed page is reloaded, waiting longer after each crash", () => {
  const recovery = createRendererRecovery();
  const start = 1_000_000;
  assert.deepEqual(recovery.decide("crashed", start), { action: "reload", delayMs: 1000, attempt: 1 });
  assert.deepEqual(recovery.decide("oom", start + 5000), { action: "reload", delayMs: 2000, attempt: 2 });
  assert.deepEqual(recovery.decide("killed", start + 10000), { action: "reload", delayMs: 4000, attempt: 3 });
});

test("after repeated crashes it stops reloading (no endless loop)", () => {
  const recovery = createRendererRecovery();
  const start = 1_000_000;
  for (let index = 0; index < DEFAULTS.maxReloads; index += 1) {
    assert.equal(recovery.decide("crashed", start + index).action, "reload");
  }
  assert.deepEqual(recovery.decide("crashed", start + 10), { action: "give-up", attempts: DEFAULTS.maxReloads });
  assert.equal(recovery.decide("crashed", start + 20).action, "give-up", "still no reload while the failures are recent");
});

test("old crashes are forgotten, so an occasional crash is always reloaded", () => {
  const recovery = createRendererRecovery();
  let now = 0;
  for (let index = 0; index < 10; index += 1) {
    assert.equal(recovery.decide("crashed", now).action, "reload", `crash ${index}`);
    now += DEFAULTS.windowMs;
  }
});

test("a normal exit is not a failure", () => {
  const recovery = createRendererRecovery();
  assert.deepEqual(recovery.decide("clean-exit", 0), { action: "ignore" });
  assert.equal(recovery.decide("crashed", 1).attempt, 1, "the clean exit was not counted");
});

test("the delay is capped, and settings can be changed", () => {
  const recovery = createRendererRecovery({ maxReloads: 10, baseDelayMs: 1000, maxDelayMs: 5000 });
  const delays = [];
  for (let index = 0; index < 6; index += 1) delays.push(recovery.decide("crashed", index).delayMs);
  assert.deepEqual(delays, [1000, 2000, 4000, 5000, 5000, 5000]);
  recovery.reset();
  assert.equal(recovery.decide("crashed", 100).attempt, 1);
  assert.equal(recovery.settings.unresponsiveGraceMs, DEFAULTS.unresponsiveGraceMs);
});
