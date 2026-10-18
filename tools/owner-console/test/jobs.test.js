"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { JobRunner, attachJobAudit, splitter, MAX_JOBS, MAX_CAPTURE_CHARS, MAX_PARTIAL } = require("../lib/jobs");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nodeJob = (runner, ms, extra = {}) =>
  runner.enqueue({
    kind: "test",
    label: `sleep ${ms}`,
    target: "t",
    display: "sleep",
    run: (ctx) => ctx.exec({ file: process.execPath, args: ["-e", `setTimeout(()=>{},${ms})`], display: "sleep", timeoutMs: 60000 }).then((r) => ({ passed: r.code === 0, code: r.code })),
    ...extra,
  });
const waitFor = async (predicate, ms = 8000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (predicate()) return true;
    await sleep(25);
  }
  return false;
};
const fakeStore = () => {
  const rows = [];
  return { rows, logOps: (row) => rows.push(row) };
};

test("a default job that runs past its limit is stopped", async () => {
  const runner = new JobRunner({ dryRun: false });
  const done = new Promise((resolve) => runner.once("finished", resolve));
  runner.enqueue({
    kind: "test",
    label: "slow default",
    target: "x",
    display: "sleep",
    run: (ctx) => ctx.exec({ file: process.execPath, args: ["-e", "setTimeout(()=>{},5000)"], display: "sleep", timeoutMs: 400 }).then((r) => ({ passed: r.code === 0, code: r.code })),
  });
  const job = await done;
  assert.equal(job.state, "failed");
  assert.ok(job.tail.some((line) => /Stopped after/.test(line)), "the stop is written to the job log");
});

test("a job with keepRunningOnTimeout past its limit is reported and not killed", async () => {
  const runner = new JobRunner({ dryRun: false });
  const done = new Promise((resolve) => runner.once("finished", resolve));
  runner.enqueue({
    kind: "test",
    label: "keep running",
    target: "x",
    display: "sleep",
    run: (ctx) => ctx.exec({ file: process.execPath, args: ["-e", "setTimeout(()=>{},800)"], display: "sleep", timeoutMs: 200, keepRunningOnTimeout: true }).then((r) => ({ passed: r.code === 0, code: r.code })),
  });
  const job = await done;
  assert.equal(job.state, "passed");
  assert.equal(job.exitCode, 0);
});

test("a pm2-lane job is not held up by a long default-lane job", async () => {
  const runner = new JobRunner({ dryRun: false });
  const finished = {};
  runner.on("finished", (job) => (finished[job.label] = job.state));
  nodeJob(runner, 1500, { label: "default long" });
  nodeJob(runner, 100, { label: "pm2 quick", lane: "pm2" });
  assert.ok(await waitFor(() => finished["pm2 quick"] === "passed", 4000));
  assert.equal(finished["default long"], undefined, "the long default job is still running");
  assert.ok(await waitFor(() => finished["default long"] === "passed", 4000));
});

test("a restart past its deadline is marked stuck, is not stopped, and finishes late", async () => {
  const runner = new JobRunner({ dryRun: false });
  const stuckEvents = [];
  runner.on("stuck", (job) => stuckEvents.push(job));
  const finished = [];
  runner.on("finished", (job) => finished.push(job));
  nodeJob(runner, 900, { label: "Restart x", lane: "pm2", stuckAfterMs: 200 });
  assert.ok(await waitFor(() => stuckEvents.length === 1, 3000), "stuck was flagged");
  assert.equal(stuckEvents[0].state, "stuck");
  assert.equal(runner.hasActive("test", "t"), true, "a stuck job still counts as active");
  assert.ok(await waitFor(() => finished.length === 1, 4000), "the job finished late");
  assert.equal(finished[0].state, "passed", "the late result is the final result");
  assert.ok(finished[0].tail.some((line) => /Finished after being stuck/.test(line)), "the late finish is written to the job log");
});

test("the audit log records a stuck restart when it is flagged, and again when it ends", async () => {
  const runner = new JobRunner({ dryRun: false });
  const store = fakeStore();
  attachJobAudit(runner, store);
  nodeJob(runner, 700, { label: "Restart y", lane: "pm2", kind: "restart", stuckAfterMs: 150 });
  assert.ok(await waitFor(() => store.rows.some((row) => row.result === "stuck"), 3000), "a stuck row was written");
  assert.ok(await waitFor(() => store.rows.some((row) => row.result === "passed"), 4000), "a final row was written");
  const stuckRow = store.rows.find((row) => row.result === "stuck");
  assert.equal(stuckRow.action, "ops.restart.stuck");
  assert.match(stuckRow.detail, /Not stopped/);
});

test("a queued job says what it is waiting behind, and the note clears when it starts", async () => {
  const runner = new JobRunner({ dryRun: false });
  nodeJob(runner, 1200, { label: "first", lane: "pm2", stuckAfterMs: 150 });
  const second = nodeJob(runner, 100, { label: "second", lane: "pm2" });
  assert.equal(second.state, "queued");
  const byId = () => runner.jobs.find((j) => j.id === second.id);
  assert.ok(await waitFor(() => /stuck since/.test(byId().queueNote || ""), 3000), "the note names the stuck job");
  assert.ok(await waitFor(() => byId().state === "passed", 5000), "the queued job runs once the stuck one finishes");
  assert.equal(byId().queueNote, null, "the note clears when the job starts");
});

test("a duplicate of an active restart is detected", async () => {
  const runner = new JobRunner({ dryRun: false });
  nodeJob(runner, 300, { kind: "restart", label: "Restart z", target: "vexora-gateway", lane: "pm2" });
  assert.equal(runner.hasActive("restart", "vexora-gateway"), true);
  assert.equal(runner.hasActive("restart", "vexora-tunnel"), false);
});

test("finished jobs are trimmed even when a stuck job sits at the front", async () => {
  const runner = new JobRunner({ dryRun: false });
  nodeJob(runner, 3000, { label: "front stuck", lane: "pm2", stuckAfterMs: 50 });
  assert.ok(await waitFor(() => runner.jobs[0].state === "stuck", 2000));
  for (let i = 0; i < MAX_JOBS + 5; i += 1) runner.enqueue({ kind: "quick", label: `quick ${i}`, target: null, display: "", run: async () => ({ passed: true, code: 0 }) });
  assert.ok(await waitFor(() => runner.jobs.filter((j) => j.kind === "quick" && j.state === "passed").length >= 5, 4000));
  assert.ok(runner.jobs.length <= MAX_JOBS + 1, `trimmed to ${runner.jobs.length}`);
  assert.equal(runner.jobs[0].state, "stuck", "the stuck job is never dropped");
});

test("a listener that throws cannot stop the queue", async () => {
  const runner = new JobRunner({ dryRun: false });
  runner.on("finished", () => {
    throw new Error("listener bug");
  });
  const done = [];
  runner.on("change", () => {});
  nodeJob(runner, 50, { label: "first" });
  runner.enqueue({ kind: "quick", label: "second", target: null, display: "", run: async () => ({ passed: true, code: 0 }) });
  assert.ok(await waitFor(() => runner.jobs.filter((j) => j.state === "passed").length === 2, 4000), "both jobs still ran");
  void done;
});

test("captured output is capped and says so", async () => {
  const runner = new JobRunner({ dryRun: false });
  const big = MAX_CAPTURE_CHARS + 200000;
  const result = await new Promise((resolve) => {
    const job = { id: "x", lines: [], lineSeq: 0, kind: "t", label: "big", state: "running" };
    runner.exec(job, {
      file: process.execPath,
      args: ["-e", `process.stdout.write("a".repeat(${big}))`],
      capture: true,
      timeoutMs: 60000,
    }).then(resolve);
  });
  assert.equal(result.truncated, true);
  assert.ok(result.stdout.length <= MAX_CAPTURE_CHARS);
});

test("a line that never ends is cut instead of growing without limit", () => {
  const lines = [];
  const s = splitter((line) => lines.push(line));
  s.push(Buffer.from("x".repeat(MAX_PARTIAL + 500)));
  assert.ok(lines.length >= 1);
  assert.ok(lines[0].length <= MAX_PARTIAL + " [line cut]".length);
  s.end();
});
