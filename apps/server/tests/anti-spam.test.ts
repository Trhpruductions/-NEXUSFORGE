import test from "node:test";
import assert from "node:assert/strict";
import {
  DUPLICATE_WINDOW_MS,
  MESSAGE_COOLDOWN_MS,
  hashContent,
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
