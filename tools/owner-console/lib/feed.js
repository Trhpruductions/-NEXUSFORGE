"use strict";

// The live "what is happening" feed. Each diff compares the previous poll with the new one and only
// records changes, so a steady state produces no lines.

const { FEED_MAX } = require("./config");
const { scrubText } = require("./secrets");

class Feed {
  constructor(max) {
    this.max = max;
    this.items = [];
    this.seq = 0;
  }

  add(kind, level, text) {
    this.seq += 1;
    this.items.push({
      id: this.seq,
      at: new Date().toISOString(),
      kind,
      level,
      text: scrubText(String(text)).slice(0, 320),
    });
    if (this.items.length > this.max) this.items.splice(0, this.items.length - this.max);
  }
}

function createFeed() {
  return new Feed(FEED_MAX);
}

function diffHealth(prev, next, feed) {
  if (!prev) return;
  const before = new Map(prev.items.map((item) => [item.key, item]));
  for (const item of next.items) {
    const old = before.get(item.key);
    if (!old) continue;
    const was = old.state || (old.ok ? "up" : "down");
    const now = item.state || (item.ok ? "up" : "down");
    // A rate-limit is the app asking us to slow down, not a service going down.
    if (was === now || was === "rate_limited" || now === "rate_limited") continue;
    feed.add("service", now === "up" ? "ok" : "error", `${item.label} is ${now === "up" ? "up" : "down"}${item.error ? ` (${item.error})` : ""}`);
  }
}

function diffPm2(prevApps, nextApps, feed) {
  if (!prevApps) return;
  const before = new Map(prevApps.map((app) => [app.name, app]));
  for (const app of nextApps) {
    if (!app.nexus) continue;
    const old = before.get(app.name);
    if (!old) {
      feed.add("pm2", "info", `${app.name} appeared in pm2 (${app.status})`);
      continue;
    }
    if (old.status !== app.status) {
      feed.add("pm2", app.status === "online" ? "ok" : "error", `${app.name} went from ${old.status} to ${app.status}`);
    }
    if (app.restarts > old.restarts) {
      feed.add("pm2", "warn", `${app.name} restarted (${app.restarts - old.restarts} time(s), ${app.restarts} total)`);
    }
  }
}

const EMAIL_BAD = new Set(["BOUNCED", "FAILED", "COMPLAINED"]);

function diffDb(prev, next, feed) {
  if (!prev) return;

  if (next.users.newSince > 0) {
    feed.add("signup", "info", `${next.users.newSince} new sign-up(s), ${next.users.total} users in total`);
  }
  if (next.messages.newSince > 0) {
    feed.add("message", "info", `${next.messages.newSince} new message(s) since the last check`);
  }
  for (const group of next.errors.newList) {
    const where = [group.source, group.path].filter(Boolean).join(" ");
    feed.add("error", "error", `New error (${where}): ${group.message}`);
  }
  if (next.errors.newGroups === 0 && prev.errors.groups1h !== next.errors.groups1h && next.errors.groups1h > prev.errors.groups1h) {
    feed.add("error", "warn", `Errors in the last hour: ${prev.errors.groups1h} to ${next.errors.groups1h} groups`);
  }

  const beforeEmail = new Map(prev.email24h.map((row) => [row.status, row.n]));
  const afterEmail = new Map(next.email24h.map((row) => [row.status, row.n]));
  for (const status of new Set([...beforeEmail.keys(), ...afterEmail.keys()])) {
    const a = beforeEmail.get(status) || 0;
    const b = afterEmail.get(status) || 0;
    if (a === b) continue;
    const level = EMAIL_BAD.has(status) ? "error" : status === "DELIVERED" ? "ok" : "info";
    feed.add("email", level, `Email ${status.toLowerCase()}: ${a} to ${b} (last 24 h)`);
  }

  if (prev.tickets.open !== next.tickets.open) {
    feed.add("support", "info", `Open support tickets: ${prev.tickets.open} to ${next.tickets.open}`);
  }
  const reportsBefore = prev.reports.messageOpen + prev.reports.problemOpen;
  const reportsAfter = next.reports.messageOpen + next.reports.problemOpen;
  if (reportsBefore !== reportsAfter) {
    feed.add("report", reportsAfter > reportsBefore ? "warn" : "info", `Reports waiting: ${reportsBefore} to ${reportsAfter}`);
  }
  const jackBefore = prev.jackpot ? `${prev.jackpot.number}:${prev.jackpot.status}` : null;
  const jackAfter = next.jackpot ? `${next.jackpot.number}:${next.jackpot.status}` : null;
  if (jackAfter && jackBefore !== jackAfter) {
    feed.add("jackpot", "info", `Jackpot round ${next.jackpot.number} is ${next.jackpot.status.toLowerCase()}`);
  }
}

function diffLogs(prev, next, feed) {
  if (!prev) return;
  for (const item of next.newStderr) {
    feed.add("log", "warn", `${item.label} wrote ${item.count} new stderr line(s): ${item.sample}`);
  }
}

module.exports = { createFeed, diffHealth, diffPm2, diffDb, diffLogs };
