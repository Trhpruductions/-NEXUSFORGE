"use strict";

const { scrubText } = require("./secrets");

function withTimeout(promise, ms, label) {
  let timer = null;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} did not finish within ${Math.round(ms / 1000)} s`)), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

/**
 * Runs one collector on a fixed interval. A run that is still going when the next tick arrives is skipped,
 * so polls never overlap. Each run has a hard timeout, so a hung probe cannot block the source forever.
 */
class Poller {
  constructor(name, { intervalMs, timeoutMs }, run, handlers = {}) {
    this.name = name;
    this.intervalMs = intervalMs;
    this.timeoutMs = timeoutMs;
    this.run = run;
    this.onResult = handlers.onResult || (() => {});
    this.onError = handlers.onError || (() => {});
    this.running = false;
    this.timer = null;
    this.stats = {
      name,
      intervalMs,
      runs: 0,
      skipped: 0,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastOkAt: null,
      lastDurationMs: null,
      lastError: null,
    };
  }

  async tick() {
    if (this.running) {
      this.stats.skipped += 1;
      return;
    }
    const started = Date.now();
    this.stats.lastStartedAt = new Date(started).toISOString();
    // The slot is held until the collector itself settles, not until the timeout fires. A run that timed out
    // keeps its slot, so the next poll is skipped instead of overlapping it.
    this.running = true;
    const work = Promise.resolve().then(() => this.run());
    work.then(
      () => {
        this.running = false;
      },
      () => {
        this.running = false;
      },
    );
    try {
      const value = await withTimeout(work, this.timeoutMs, this.name);
      this.stats.lastError = null;
      this.stats.lastOkAt = new Date().toISOString();
      this.onResult(value);
    } catch (err) {
      let message = scrubText(err && err.message ? err.message : String(err));
      if (this.running) message += ". The earlier run is still going; new polls wait until it returns.";
      const previous = this.stats.lastError;
      this.stats.lastError = message;
      try {
        this.onError(message, previous);
      } catch {
        // The error hook must never stop the poller.
      }
    } finally {
      this.stats.runs += 1;
      this.stats.lastDurationMs = Date.now() - started;
      this.stats.lastFinishedAt = new Date().toISOString();
    }
  }

  start() {
    this.tick();
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    return this;
  }

  stop() {
    clearInterval(this.timer);
  }
}

module.exports = { Poller, withTimeout };
