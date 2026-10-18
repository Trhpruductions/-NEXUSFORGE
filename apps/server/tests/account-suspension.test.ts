import test from "node:test";
import assert from "node:assert/strict";
import { describeSuspension, isSuspensionActive, suspendedResponse, suspensionEnd } from "../src/lib/account-suspension-rules.js";

const now = new Date("2026-10-12T12:00:00Z");

test("a suspension is active until it ends or is lifted", () => {
  assert.equal(isSuspensionActive({ until: null, liftedAt: null }, now), true, "until lifted");
  assert.equal(isSuspensionActive({ until: new Date("2026-10-13T00:00:00Z"), liftedAt: null }, now), true);
  assert.equal(isSuspensionActive({ until: new Date("2026-10-12T11:59:59Z"), liftedAt: null }, now), false, "ended");
  assert.equal(isSuspensionActive({ until: null, liftedAt: new Date("2026-10-12T11:00:00Z") }, now), false, "lifted");
});

test("suspension length", () => {
  assert.equal(suspensionEnd(null, now), null);
  assert.equal(suspensionEnd(7, now)?.toISOString(), "2026-10-19T12:00:00.000Z");
});

test("the suspended person is told why and until when", () => {
  const entry = { id: "s1", reason: "Spamming invites", until: new Date("2026-10-19T12:00:00Z"), createdAt: now };
  assert.deepEqual(describeSuspension(entry), { reason: "Spamming invites", until: "2026-10-19T12:00:00.000Z", since: now.toISOString() });
  const body = suspendedResponse(entry);
  assert.match(body.error, /suspended until/);
  assert.equal(suspendedResponse({ ...entry, until: null }).error, "This account is suspended.");
});

