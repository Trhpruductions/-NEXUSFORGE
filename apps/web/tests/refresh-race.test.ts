import { test } from "node:test";
import assert from "node:assert/strict";
import { lostRefreshRace } from "../src/lib/api";

test("a refresh refused only because another tab rotated the cookie is retried", () => {
  assert.equal(lostRefreshRace(401, { error: "Invalid refresh token", code: "REFRESH_TOKEN_ROTATED" }), true);
});

test("every other refusal is a real answer about the session", () => {
  assert.equal(lostRefreshRace(401, { error: "Invalid refresh token" }), false);
  assert.equal(lostRefreshRace(401, { code: "SESSION_REVOKED" }), false);
  assert.equal(lostRefreshRace(403, { code: "REFRESH_TOKEN_ROTATED" }), false);
  assert.equal(lostRefreshRace(undefined, undefined), false);
  assert.equal(lostRefreshRace(401, null), false);
});
