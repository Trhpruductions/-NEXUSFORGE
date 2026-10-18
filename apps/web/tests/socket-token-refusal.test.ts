import { test } from "node:test";
import assert from "node:assert/strict";
import { isTokenRefusal } from "../src/lib/socket";

test("an expired or invalid token refusal triggers a fresh token and a reconnect", () => {
  assert.equal(isTokenRefusal("Invalid token"), true);
  assert.equal(isTokenRefusal("Unauthorized"), true);
});

test("other connection problems are left to socket.io's own retries or their own handling", () => {
  assert.equal(isTokenRefusal("Account suspended"), false);
  assert.equal(isTokenRefusal("App tokens can't connect here"), false);
  assert.equal(isTokenRefusal("websocket error"), false);
  assert.equal(isTokenRefusal("timeout"), false);
});
