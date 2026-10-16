"use strict";

// Background job runner. Jobs run one at a time within a lane; others wait in a queue (state "queued").
// Each output line is emitted the moment the child process writes it, with a sequence number, and is scrubbed.
// Each job keeps its last 2,000 lines in memory so a browser that opens late can replay them.
// A job that passes its stuckAfterMs deadline becomes "stuck": it is flagged and audited, but it is never stopped.
// Nothing here writes to the app.

const { EventEmitter } = require("node:events");
const { spawn } = require("node:child_process");
const { scrubText } = require("./secrets");

const LOG_LINES = 2000;
const MAX_JOBS = 60;
const MAX_LINE = 600;
const MAX_PARTIAL = 16384;
const MAX_CAPTURE_CHARS = 2000000;
const TAIL_LINES = 12;
const RECENT_WITH_TAIL = 5;

function nowIso() {
  return new Date().toISOString();
}

function minutes(ms) {
  return Math.round(ms / 60000);
}

function minutesBetween(startIso, endIso) {
  return Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000);
}

function isActive(job) {
  return job.state === "queued" || job.state === "running" || job.state === "stuck";
}

function isFinished(job) {
  return job.state === "passed" || job.state === "failed";
}

// The job list carries only a summary without its SQL. The SQL is fetched on demand.
function slimSummary(summary, full) {
  if (summary === undefined || summary === null) return null;
  if (typeof summary !== "object" || full) return summary;
  const { sql, ...rest } = summary;
  return sql !== undefined ? { ...rest, hasSql: true } : rest;
}

function publicJob(job, { full = false, tail = true } = {}) {
  const base = {
    id: job.id,
    kind: job.kind,
    lane: job.lane,
    label: job.label,
    target: job.target,
    display: job.display,
    state: job.state,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    stuckAt: job.stuckAt,
    queueNote: job.queueNote,
    exitCode: job.exitCode,
    dryRun: job.dryRun,
    summary: slimSummary(job.summary, full),
    error: job.error,
    lineCount: job.lineSeq,
    tail: tail ? job.lines.slice(-TAIL_LINES).map((line) => line.text) : [],
  };
  if (full) base.lines = job.lines.slice();
  return base;
}

function splitter(onLine) {
  let partial = "";
  return {
    push(chunk) {
      partial += chunk.toString("utf8");
      const parts = partial.split(/\r?\n/);
      partial = parts.pop();
      for (const line of parts) onLine(line);
      // A child that never writes a newline must not grow this buffer without limit.
      if (partial.length > MAX_PARTIAL) {
        onLine(`${partial.slice(0, MAX_PARTIAL)} [line cut]`);
        partial = "";
      }
    },
    end() {
      if (partial.length > 0) onLine(partial);
      partial = "";
    },
  };
}

class JobRunner extends EventEmitter {
  constructor({ dryRun = false } = {}) {
    super();
    this.dryRun = dryRun;
    this.jobs = [];
    // Each lane runs one job at a time. pm2 writes use their own lane, so a stuck restart cannot hold up builds or checks.
    this.lanes = new Map();
    this.seq = 0;
  }

  lane(name) {
    if (!this.lanes.has(name)) this.lanes.set(name, { queue: [], running: null });
    return this.lanes.get(name);
  }

  /**
   * spec: { kind, label, target, display, lane, stuckAfterMs, run(ctx) }. run returns { passed, code, summary }.
   * lane defaults to "default". stuckAfterMs, when set, flags the job as stuck after that long. Nothing is stopped.
   */
  enqueue(spec) {
    this.seq += 1;
    const laneName = spec.lane || "default";
    const job = {
      id: `job-${this.seq}`,
      kind: spec.kind,
      lane: laneName,
      label: spec.label,
      target: spec.target || null,
      display: spec.display || "",
      state: "queued",
      queuedAt: nowIso(),
      startedAt: null,
      endedAt: null,
      stuckAt: null,
      stuckAfterMs: Number(spec.stuckAfterMs) > 0 ? Number(spec.stuckAfterMs) : null,
      queueNote: null,
      exitCode: null,
      dryRun: this.dryRun,
      summary: null,
      error: null,
      lines: [],
      lineSeq: 0,
    };
    this.jobs.push(job);
    this.trim();
    this.lane(laneName).queue.push({ job, run: spec.run });
    this.refreshQueueNotes(laneName);
    this.changed(job);
    this.pump(laneName);
    return publicJob(job);
  }

  /** Drops the oldest finished jobs. Active jobs are never dropped, and a stuck job at the front does not block trimming. */
  trim() {
    let excess = this.jobs.length - MAX_JOBS;
    for (let i = 0; i < this.jobs.length && excess > 0; ) {
      if (isFinished(this.jobs[i])) {
        this.jobs.splice(i, 1);
        excess -= 1;
      } else {
        i += 1;
      }
    }
  }

  /** True while a job of this kind and target is queued, running, or stuck. Used to refuse duplicates. */
  hasActive(kind, target) {
    return this.jobs.some((job) => job.kind === kind && job.target === target && isActive(job));
  }

  list() {
    const recent = new Set(this.jobs.slice(-RECENT_WITH_TAIL).map((job) => job.id));
    return this.jobs.slice().reverse().map((job) => publicJob(job, { tail: isActive(job) || recent.has(job.id) }));
  }

  get(id) {
    const job = this.jobs.find((candidate) => candidate.id === id);
    return job ? publicJob(job, { full: true }) : null;
  }

  // Listener errors are reported to stderr and never stop the queue.
  emitSafe(name, payload) {
    try {
      this.emit(name, payload);
    } catch (err) {
      process.stderr.write(`owner-console: a ${name} listener failed: ${scrubText(String((err && err.message) || err))}\n`);
    }
  }

  changed(job) {
    this.emitSafe("change", job.id);
  }

  /** One line: stored with its sequence number and emitted at once, so the stream is live, not batched. */
  appendLine(job, text, stream = "out") {
    job.lineSeq += 1;
    const entry = {
      seq: job.lineSeq,
      stream,
      text: scrubText(String(text)).slice(0, MAX_LINE),
      at: nowIso(),
    };
    job.lines.push(entry);
    if (job.lines.length > LOG_LINES) job.lines.shift();
    this.emitSafe("line", { jobId: job.id, ...entry });
    this.changed(job);
  }

  contextFor(job) {
    return {
      dryRun: this.dryRun,
      log: (text) => this.appendLine(job, text, "info"),
      exec: (options) => this.exec(job, options),
      setSummary: (summary) => {
        job.summary = summary;
        this.changed(job);
      },
    };
  }

  /** Flags a running job as stuck. It is not stopped. Its lane waits behind it, and the queued jobs say why. */
  markStuck(job, message) {
    if (job.state !== "running") return;
    job.state = "stuck";
    job.stuckAt = nowIso();
    this.appendLine(job, message, "err");
    this.refreshQueueNotes(job.lane);
    this.emitSafe("stuck", publicJob(job));
    this.changed(job);
  }

  /** Each queued job says what it is waiting behind, so a queue that does not move is explained, not silent. */
  refreshQueueNotes(laneName) {
    const lane = this.lane(laneName);
    for (const { job } of lane.queue) {
      if (!lane.running) {
        job.queueNote = null;
      } else if (lane.running.state === "stuck") {
        job.queueNote = `Waiting. "${lane.running.label}" has been stuck since ${lane.running.stuckAt}. It has not been stopped. This job runs after it finishes.`;
      } else {
        job.queueNote = `Waiting. "${lane.running.label}" is running. Jobs in the ${laneName} lane run one at a time.`;
      }
    }
  }

  /**
   * Runs one command. Either { file, args } (no shell) or { cmdLine } (through cmd.exe, for npm and npx).
   * stdout and stderr are emitted line by line as the child writes them. In dry-run mode nothing is started.
   * With keepRunningOnTimeout, a call that runs past timeoutMs is reported and left to finish, never killed.
   * pm2 calls use this: a client killed mid-call is what the daemon logged as "write EOF" before it resurrected.
   * Captured stdout is capped at MAX_CAPTURE_CHARS; result.truncated says when the cap was reached.
   */
  exec(job, { file, args = [], cmdLine, cwd, env, display, capture = false, timeoutMs = 30 * 60 * 1000, keepRunningOnTimeout = false }) {
    const shown = display || cmdLine || [file, ...args].join(" ");
    this.appendLine(job, `$ ${shown}`, "cmd");
    if (this.dryRun) {
      this.appendLine(job, "DRY RUN: this command was printed but not run.", "info");
      return Promise.resolve({ code: 0, stdout: "", dryRun: true, truncated: false });
    }
    return new Promise((resolve) => {
      let child;
      try {
        child = cmdLine
          ? spawn("cmd.exe", ["/d", "/s", "/c", cmdLine], { cwd, env, windowsHide: true, windowsVerbatimArguments: true })
          : spawn(file, args, { cwd, env, windowsHide: true });
      } catch (err) {
        this.appendLine(job, `Could not start: ${scrubText(err.code || err.message)}`, "err");
        resolve({ code: -1, stdout: "", truncated: false });
        return;
      }
      let stdout = "";
      let truncated = false;
      let finished = false;
      const out = splitter((line) => this.appendLine(job, line, "out"));
      const err = splitter((line) => this.appendLine(job, line, "err"));
      child.stdout.on("data", (chunk) => {
        if (capture) {
          stdout += chunk.toString("utf8");
          if (stdout.length > MAX_CAPTURE_CHARS) {
            stdout = stdout.slice(0, MAX_CAPTURE_CHARS);
            truncated = true;
          }
        }
        out.push(chunk);
      });
      child.stderr.on("data", (chunk) => err.push(chunk));
      const timer = setTimeout(() => {
        if (keepRunningOnTimeout) {
          this.appendLine(job, `Still running after ${minutes(timeoutMs)} minutes. It is not stopped; waiting for it to finish.`, "err");
          return;
        }
        this.appendLine(job, `Stopped after ${minutes(timeoutMs)} minutes.`, "err");
        killTree(child);
      }, timeoutMs);
      const done = (code) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        out.end();
        err.end();
        resolve({ code, stdout, truncated });
      };
      child.on("error", (e) => {
        this.appendLine(job, `Process error: ${scrubText(e.code || e.message)}`, "err");
        done(-1);
      });
      child.on("close", (code) => done(typeof code === "number" ? code : -1));
    });
  }

  pump(laneName = "default") {
    const lane = this.lane(laneName);
    if (lane.running || lane.queue.length === 0) return;
    const { job, run } = lane.queue.shift();
    lane.running = job;
    job.state = "running";
    job.queueNote = null;
    job.startedAt = nowIso();
    this.changed(job);
    this.refreshQueueNotes(laneName);

    let stuckTimer = null;
    if (job.stuckAfterMs) {
      stuckTimer = setTimeout(() => {
        this.markStuck(
          job,
          `No result after ${minutes(job.stuckAfterMs)} minutes. It is still waiting and has NOT been stopped. Other jobs in the ${laneName} lane wait until it finishes.`,
        );
      }, job.stuckAfterMs);
    }

    const ctx = this.contextFor(job);
    Promise.resolve()
      .then(() => run(ctx))
      .then((result) => {
        const passed = Boolean(result && result.passed);
        job.state = passed ? "passed" : "failed";
        job.exitCode = result && typeof result.code === "number" ? result.code : null;
        if (result && result.summary !== undefined) job.summary = result.summary;
      })
      .catch((error) => {
        job.state = "failed";
        job.error = scrubText(error && error.message ? error.message : String(error));
        this.appendLine(job, `Job error: ${job.error}`, "err");
      })
      .finally(() => {
        // The lane is released first, so a failure while reporting can never leave it blocked.
        clearTimeout(stuckTimer);
        lane.running = null;
        try {
          job.endedAt = nowIso();
          if (job.stuckAt) {
            this.appendLine(job, `Finished after being stuck for ${minutesBetween(job.stuckAt, job.endedAt)} minutes. Final state: ${job.state}.`, "info");
          }
          this.changed(job);
          this.emitSafe("finished", publicJob(job));
        } finally {
          this.trim();
          this.refreshQueueNotes(laneName);
          this.pump(laneName);
        }
      });
  }
}

/** Writes job events to the ticket store's audit log. A stuck job is audited when it is flagged, not only when it ends. */
function attachJobAudit(runner, store) {
  runner.on("stuck", (job) => {
    if (!store) return;
    store.logOps({
      action: `ops.${job.kind}.stuck`,
      target: job.target,
      result: "stuck",
      detail: `${job.label}. Started ${job.startedAt}; flagged stuck at ${job.stuckAt}. Not stopped. Queued jobs in the ${job.lane} lane wait until it finishes.`,
    });
  });
  runner.on("finished", (job) => {
    if (!store) return;
    const result = job.dryRun ? "dry run" : job.state;
    const summary = job.summary && job.summary.text ? job.summary.text : job.summary && typeof job.summary.errors === "number" ? `${job.summary.errors} TypeScript error(s)` : "";
    const late = job.stuckAt ? ` Was stuck from ${job.stuckAt}.` : "";
    store.logOps({
      action: `ops.${job.kind}`,
      target: job.target,
      result,
      detail: `${job.label}. exit ${job.exitCode === null ? "none" : job.exitCode}. started ${job.startedAt}, ended ${job.endedAt}${summary ? `. ${summary}` : ""}${late}`,
    });
  });
}

function killTree(child) {
  if (!child || !child.pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }).unref();
  } else {
    child.kill("SIGTERM");
  }
}

module.exports = { JobRunner, publicJob, attachJobAudit, splitter, LOG_LINES, MAX_JOBS, MAX_CAPTURE_CHARS, MAX_PARTIAL };
