import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import {
  DUPLICATE_WINDOW_MS,
  MESSAGE_COOLDOWN_MS,
  antiSpam,
  hashContent,
  restoreIfRefused,
  spamVerdict,
  sweepCooldowns,
  type CooldownEntry,
} from "../src/middleware/anti-spam.js";

const NOW = 1_700_000_000_000;

function entry(content: string, agoMs: number): CooldownEntry {
  return { contentHash: hashContent(content), timestamp: NOW - agoMs };
}

test("the first message in a channel is always allowed", () => {
  assert.equal(spamVerdict(undefined, NOW, hashContent("hello")).blocked, false);
});

test("messages fired inside the cooldown are refused", () => {
  const verdict = spamVerdict(entry("first", 200), NOW, hashContent("second"));
  assert.equal(verdict.blocked, true);
  assert.equal(verdict.blocked && verdict.reason, "cooldown");
});

test("a different message just past the cooldown is allowed", () => {
  assert.equal(spamVerdict(entry("first", MESSAGE_COOLDOWN_MS + 50), NOW, hashContent("second")).blocked, false);
});

test("repeating the same message immediately is refused as a duplicate", () => {
  const verdict = spamVerdict(entry("gg", MESSAGE_COOLDOWN_MS + 50), NOW, hashContent("gg"));
  assert.equal(verdict.blocked, true);
  assert.equal(verdict.blocked && verdict.reason, "duplicate");
});

test("the same message is allowed again once the duplicate window passes", () => {
  // The whole point: "gg" after a match, then "gg" after the next one.
  assert.equal(spamVerdict(entry("gg", DUPLICATE_WINDOW_MS + 1_000), NOW, hashContent("gg")).blocked, false);
  assert.equal(spamVerdict(entry("gg", 60 * 60_000), NOW, hashContent("gg")).blocked, false);
});

test("duplicate detection ignores case and surrounding space", () => {
  const verdict = spamVerdict(entry("Ready", MESSAGE_COOLDOWN_MS + 50), NOW, hashContent("  ready  "));
  assert.equal(verdict.blocked, true);
  assert.equal(verdict.blocked && verdict.reason, "duplicate");
});

test("a blocked message carries a reason a member can act on", () => {
  const verdict = spamVerdict(entry("spam", 100), NOW, hashContent("spam"));
  assert.equal(verdict.blocked, true);
  assert.ok(verdict.blocked && verdict.message.length > 10, "expected a human readable message");
});

test("idle entries are swept so the map cannot grow without bound", () => {
  const entries = new Map<string, CooldownEntry>([
    ["user-a:channel-1", entry("old", 10 * 60_000)],
    ["user-b:channel-1", entry("recent", 30_000)],
  ]);
  sweepCooldowns(NOW, entries);
  assert.equal(entries.has("user-a:channel-1"), false, "the idle entry should be gone");
  assert.equal(entries.has("user-b:channel-1"), true, "the recent entry should be kept");
});

test("a refused message gives its slot back; a later message in the meantime is kept", () => {
  const sent = entry("hi", 5_000);
  const refused = entry("again", 0);

  const entries = new Map<string, CooldownEntry>([["u:c", refused]]);
  restoreIfRefused(entries, "u:c", refused, sent, 403);
  assert.equal(entries.get("u:c"), sent, "the earlier sent message should count again");

  const first = new Map<string, CooldownEntry>([["u:c", refused]]);
  restoreIfRefused(first, "u:c", refused, undefined, 429);
  assert.equal(first.has("u:c"), false, "nothing was sent before, so nothing should be left");

  const accepted = new Map<string, CooldownEntry>([["u:c", refused]]);
  restoreIfRefused(accepted, "u:c", refused, sent, 201);
  assert.equal(accepted.get("u:c"), refused, "an accepted message stays recorded");

  const newer = entry("newer", 0);
  const replaced = new Map<string, CooldownEntry>([["u:c", newer]]);
  restoreIfRefused(replaced, "u:c", refused, sent, 400);
  assert.equal(replaced.get("u:c"), newer, "a message recorded since must not be overwritten");
});

/** Just enough of Express for the middleware: status/json and the "finish" event. */
function fakeExchange(userId: string, channelId: string, content: string) {
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  });
  const req = { user: { id: userId }, body: { channelId, content } };
  let passed = false;
  antiSpam(req as unknown as Request, res as unknown as Response, () => {
    passed = true;
  });
  return { res, passed, finish: (code: number) => res.status(code).emit("finish") };
}

test("retrying text the route refused (e.g. during a timeout) is not called a duplicate", () => {
  const channel = `refused-${Date.now()}`;
  const first = fakeExchange("member", channel, "hello there");
  assert.equal(first.passed, true);
  first.finish(403);

  const retry = fakeExchange("member", channel, "hello there");
  assert.equal(retry.passed, true, `expected the retry to reach the route, got ${JSON.stringify(retry.res.body)}`);
  retry.finish(201);

  const repeat = fakeExchange("member", channel, "hello there");
  assert.equal(repeat.passed, false, "once actually sent, the same text is a duplicate again");
  assert.equal(repeat.res.statusCode, 429);
});

test("two identical sends in flight at once: only the first reaches the route", () => {
  const channel = `inflight-${Date.now()}`;
  const first = fakeExchange("member", channel, "gg");
  const second = fakeExchange("member", channel, "gg");
  assert.equal(first.passed, true);
  assert.equal(second.passed, false);
  assert.equal(second.res.statusCode, 429);
  second.res.emit("finish");
  first.finish(201);
});
