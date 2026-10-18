import "./helpers/email-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { issueUnsubscribeToken, signUnsubscribeToken, unsubscribeKey, verifyUnsubscribeToken } from "../src/lib/email-tokens.js";
import { isOptedIn, parseEmailOptIns, withOptIn, UNSUBSCRIBE_TTL_MS } from "../src/lib/email-policy.js";

const NOW = Date.parse("2026-10-14T12:00:00Z");
const key = unsubscribeKey({ explicit: "unsubscribe-secret-for-tests-0123456789ab", fallbackSecret: "jwt-secret" });

test("a fresh unsubscribe token verifies to the user and the category it was issued for", () => {
  const token = issueUnsubscribeToken(key, "user-42", "announcements", NOW);
  assert.deepEqual(verifyUnsubscribeToken(key, token, NOW + 1_000), { ok: true, userId: "user-42", category: "announcements" });
});

test("a tampered payload is refused, even when only the claims changed", () => {
  const token = issueUnsubscribeToken(key, "user-42", "announcements", NOW);
  const [, mac] = token.split(".");
  const forgedBody = Buffer.from(JSON.stringify({ u: "someone-else", c: "announcements", e: NOW + UNSUBSCRIBE_TTL_MS })).toString("base64url");
  assert.deepEqual(verifyUnsubscribeToken(key, `${forgedBody}.${mac}`, NOW), { ok: false, reason: "bad-signature" });
});

test("a token signed with another key is refused", () => {
  const other = unsubscribeKey({ explicit: "a-different-secret-that-is-long-enough-xyz", fallbackSecret: "x" });
  const token = issueUnsubscribeToken(other, "user-42", "announcements", NOW);
  assert.deepEqual(verifyUnsubscribeToken(key, token, NOW), { ok: false, reason: "bad-signature" });
});

test("an expired token is refused, including a token that is a year old", () => {
  const token = issueUnsubscribeToken(key, "user-42", "releaseNotes", NOW);
  assert.deepEqual(verifyUnsubscribeToken(key, token, NOW + UNSUBSCRIBE_TTL_MS + 1_000), { ok: false, reason: "expired" });

  const alreadyExpired = signUnsubscribeToken(key, { userId: "user-42", category: "releaseNotes", expiresAtMs: NOW - 1 });
  assert.deepEqual(verifyUnsubscribeToken(key, alreadyExpired, NOW), { ok: false, reason: "expired" });
});

test("malformed tokens are refused without throwing", () => {
  for (const token of ["", "abc", "a.b.c", ".", "x.", ".y", "a".repeat(2000)]) {
    assert.equal(verifyUnsubscribeToken(key, token, NOW).ok, false, `token of length ${token.length} must be refused`);
  }
});

test("a validly signed token for a category that is not optional mail is refused", () => {
  const token = signUnsubscribeToken(key, { userId: "user-42", category: "welcome" as never, expiresAtMs: NOW + 1_000 });
  assert.deepEqual(verifyUnsubscribeToken(key, token, NOW), { ok: false, reason: "unknown-category" });
});

test("the signing key falls back to a derived key when no dedicated secret is set", () => {
  const derived = unsubscribeKey({ fallbackSecret: "jwt-secret-value-for-derivation-only-000" });
  const explicit = unsubscribeKey({ explicit: "unsubscribe-secret-for-tests-0123456789ab", fallbackSecret: "jwt-secret" });
  assert.notDeepEqual(derived, explicit);
  // A dedicated secret that is too short is ignored, rather than trusted.
  const tooShort = unsubscribeKey({ explicit: "short", fallbackSecret: "jwt-secret-value-for-derivation-only-000" });
  assert.deepEqual(tooShort, derived);
});

test("opting out is idempotent and keeps the other preferences", () => {
  const start = { theme: "dark", email: { announcements: true, releaseNotes: true, promotions: false } };
  const once = withOptIn(start, "announcements", false);
  const twice = withOptIn(once, "announcements", false);
  assert.deepEqual(twice, once);
  assert.equal(isOptedIn(twice, "announcements"), false);
  assert.equal(isOptedIn(twice, "releaseNotes"), true, "other flags untouched");
  assert.equal((twice as { theme: string }).theme, "dark", "other sections untouched");
});

test("optional mail is OFF by default and only an explicit true opts in", () => {
  assert.equal(isOptedIn(undefined, "announcements"), false);
  assert.equal(isOptedIn({}, "announcements"), false);
  assert.equal(isOptedIn({ email: { announcements: "yes" } }, "announcements"), false, "a non-boolean is not consent");
  assert.equal(isOptedIn(withOptIn(null, "announcements", true), "announcements"), true);
  assert.deepEqual(parseEmailOptIns(undefined), { announcements: false, releaseNotes: false, promotions: false });
});
