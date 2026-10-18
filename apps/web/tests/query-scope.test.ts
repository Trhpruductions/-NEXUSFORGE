import { test } from "node:test";
import assert from "node:assert/strict";
import { queryScopeOf, shouldClearQueryCache, useAuthStore } from "../src/store/auth-store";
import type { User } from "../src/lib/api";

const alice = { id: "user-alice", username: "alice" } as User;
const bob = { id: "user-bob", username: "bob" } as User;
const signedOut = { accessToken: null, user: null };

test("query keys follow the signed-in account, not the token", () => {
  assert.equal(queryScopeOf(signedOut), null);
  assert.equal(queryScopeOf({ accessToken: "token-1", user: alice }), "user-alice");
  // A refresh hands out a new token: the scope (and so every query key) stays the same.
  assert.equal(queryScopeOf({ accessToken: "token-2", user: alice }), "user-alice");
  assert.equal(queryScopeOf({ accessToken: "token-3", user: bob }), "user-bob");
  // Between getting a token and loading the account.
  assert.equal(queryScopeOf({ accessToken: "token-1", user: null }), "signed-in");
});

test("the cache is cleared on sign-out, on expiry, and when another account signs in", () => {
  assert.equal(shouldClearQueryCache({ accessToken: "t1", user: alice }, signedOut), true);
  assert.equal(shouldClearQueryCache({ accessToken: "t1", user: alice }, { accessToken: null, user: alice }), true);
  assert.equal(shouldClearQueryCache({ accessToken: "t1", user: alice }, { accessToken: "t2", user: bob }), true);
});

test("the cache is kept for a token refresh, the account loading, and signing in from signed out", () => {
  assert.equal(shouldClearQueryCache({ accessToken: "t1", user: alice }, { accessToken: "t2", user: alice }), false);
  assert.equal(shouldClearQueryCache({ accessToken: "t1", user: null }, { accessToken: "t1", user: alice }), false);
  assert.equal(shouldClearQueryCache(signedOut, { accessToken: "t1", user: alice }), false);
  assert.equal(shouldClearQueryCache(signedOut, signedOut), false);
});

test("the store's own transitions: refresh keeps the scope, sign-out clears it", () => {
  const { setSession, expireSession } = useAuthStore.getState();
  setSession({ accessToken: "token-1", csrfToken: "csrf", user: alice });
  const first = queryScopeOf(useAuthStore.getState());
  setSession({ accessToken: "token-2", user: alice });
  assert.equal(queryScopeOf(useAuthStore.getState()), first);
  const before = useAuthStore.getState();
  expireSession();
  assert.equal(queryScopeOf(useAuthStore.getState()), null);
  assert.equal(shouldClearQueryCache(before, useAuthStore.getState()), true);
});
