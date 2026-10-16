"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { Poller } = require("../lib/poller");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("a run that times out keeps its slot, so the next poll is skipped instead of overlapping it", async () => {
  let release;
  let runs = 0;
  const poller = new Poller("slow", { intervalMs: 60000, timeoutMs: 80 }, () => {
    runs += 1;
    return new Promise((resolve) => (release = resolve));
  });
  const errors = [];
  poller.onError = (message) => errors.push(message);

  await poller.tick();
  assert.equal(runs, 1);
  assert.match(errors[0], /did not finish within/);
  assert.equal(poller.running, true, "the timed-out run still holds its slot");

  await poller.tick();
  assert.equal(runs, 1, "no second run starts while the first is still going");
  assert.equal(poller.stats.skipped, 1);
  assert.match(poller.stats.lastError, /still going/);

  release("done");
  await sleep(10);
  assert.equal(poller.running, false, "the slot is released once the collector settles");

  await poller.tick();
  assert.equal(runs, 2, "the next poll runs after the earlier run has settled");
});

test("a run that finishes in time reports its value and frees the slot", async () => {
  const values = [];
  const poller = new Poller("quick", { intervalMs: 60000, timeoutMs: 1000 }, async () => 42);
  poller.onResult = (value) => values.push(value);
  await poller.tick();
  assert.deepEqual(values, [42]);
  assert.equal(poller.running, false);
  assert.equal(poller.stats.lastError, null);
});

test("a failing run is reported without leaving the poller stuck", async () => {
  const errors = [];
  const poller = new Poller("broken", { intervalMs: 60000, timeoutMs: 1000 }, async () => {
    throw new Error("probe failed");
  });
  poller.onError = (message) => errors.push(message);
  await poller.tick();
  assert.equal(errors[0], "probe failed");
  assert.equal(poller.running, false);
});
