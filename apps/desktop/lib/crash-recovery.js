"use strict";

// When the main window's page crashes or hangs: reload it, waiting longer after each failure, and stop reloading
// when it keeps failing. No Electron here, so the rules can be tested directly.
// Before this, a crashed page stayed blank until the user restarted the app.

const DEFAULTS = Object.freeze({
  /** Reloads allowed within windowMs. One more failure shows the error page instead (no endless reload loop). */
  maxReloads: 3,
  windowMs: 5 * 60 * 1000,
  baseDelayMs: 1000,
  maxDelayMs: 30 * 1000,
  /** How long a page may stay unresponsive before it is restarted (it often recovers by itself). */
  unresponsiveGraceMs: 15 * 1000,
});

/** Exits that are not failures: the renderer closed normally (the window closed, or the app is quitting). */
const NOT_A_FAILURE = new Set(["clean-exit"]);

/**
 * decide(reason, now) -> { action: "ignore" } | { action: "reload", delayMs, attempt } | { action: "give-up", attempts }
 * Failures older than windowMs are forgotten, so a page that crashes once a day is always reloaded.
 */
function createRendererRecovery(options = {}) {
  const settings = { ...DEFAULTS, ...options };
  let recent = [];
  return {
    settings,
    decide(reason, now = Date.now()) {
      if (NOT_A_FAILURE.has(reason)) return { action: "ignore" };
      recent = recent.filter((time) => now - time < settings.windowMs);
      if (recent.length >= settings.maxReloads) return { action: "give-up", attempts: recent.length };
      recent.push(now);
      const delayMs = Math.min(settings.maxDelayMs, settings.baseDelayMs * 2 ** (recent.length - 1));
      return { action: "reload", delayMs, attempt: recent.length };
    },
    reset() {
      recent = [];
    },
  };
}

module.exports = { DEFAULTS, createRendererRecovery };
