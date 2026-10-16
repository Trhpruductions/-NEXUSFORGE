"use strict";

// Tests the pm2 status reader without a real pm2 client: the process starter is replaced by a test double.
// The module is loaded fresh for each test, so its breaker and in-flight state never carry over.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const MODULE = path.join(__dirname, "..", "lib", "collectors", "pm2.js");

function freshCollector() {
  delete require.cache[MODULE];
  return require(MODULE);
}

const LIST = JSON.stringify([
  {
    name: "vexora-watchdog",
    pm_id: 15,
    pid: 4321,
    pm2_env: { status: "online", restart_time: 2, unstable_restarts: 0, pm_uptime: Date.now() - 60000, pm_out_log_path: "C:\\logs\\out.log", env: { SECRET_VALUE: "must-not-leak" } },
    monit: { cpu: 1, memory: 1000 },
  },
]);

test("a normal read maps the fields it needs and never keeps the environment", async () => {
  const pm2 = freshCollector();
  pm2.setTestHooks({ start: async () => LIST, waitMs: 500 });
  const result = await pm2.collectPm2();
  assert.equal(result.apps.length, 1);
  const app = result.apps[0];
  assert.equal(app.name, "vexora-watchdog");
  assert.equal(app.status, "online");
  assert.equal(app.restarts, 2);
  assert.equal(app.nexus, true);
  assert.equal(JSON.stringify(result).includes("must-not-leak"), false, "environment values are never kept");
});

test("a hung read times out, is not killed, and does not block the next read", async () => {
  const pm2 = freshCollector();
  let release;
  pm2.setTestHooks({ start: () => new Promise((resolve) => (release = resolve)), waitMs: 100 });
  await assert.rejects(pm2.collectPm2(), /has not answered after/);
  assert.equal(pm2.inFlight.size, 1, "the hung client is still tracked");
  // One slot is still free, so a second read may start.
  const second = pm2.collectPm2();
  await assert.rejects(second, /has not answered after/);
  assert.equal(pm2.inFlight.size, 2);
  // With both slots held, no new client is started at all. (Two timeouts also open the breaker, so it is reset here
  // to reach the slot check on its own.)
  pm2.setTestHooks({ resetBreaker: true });
  await assert.rejects(pm2.collectPm2(), /still answering 2 earlier read/);
  release(LIST);
});

test("when the hung clients finally return, reads resume", async () => {
  const pm2 = freshCollector();
  const resolvers = [];
  pm2.setTestHooks({ start: () => new Promise((resolve) => resolvers.push(resolve)), waitMs: 80 });
  await assert.rejects(pm2.collectPm2(), /has not answered/);
  await assert.rejects(pm2.collectPm2(), /has not answered/);
  assert.equal(pm2.inFlight.size, 2);
  resolvers.forEach((resolve) => resolve(LIST));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(pm2.inFlight.size, 0, "returned clients leave the in-flight set");
  pm2.setTestHooks({ start: async () => LIST, waitMs: 500, resetBreaker: true });
  const result = await pm2.collectPm2();
  assert.equal(result.apps.length, 1, "monitoring resumes");
});

test("two failed reads pause reads for a while, and the pause says when they resume", async () => {
  const pm2 = freshCollector();
  pm2.setTestHooks({ start: async () => {
    throw new Error("client failed");
  }, waitMs: 500 });
  await assert.rejects(pm2.collectPm2(), /client failed/);
  await assert.rejects(pm2.collectPm2(), /client failed/);
  await assert.rejects(pm2.collectPm2(), /paused after repeated failures; the next try is at/);
});
