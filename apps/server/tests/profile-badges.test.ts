import { test } from "node:test";
import assert from "node:assert/strict";
import { profileBadgeKeys } from "../src/lib/profile-badges.js";

test("every account shows Beta User and Member", () => {
  assert.deepEqual(profileBadgeKeys({ emailVerified: false, medalKeys: [] }), ["beta-user", "member"]);
});

test("a verified email shows Verified Member instead of Member", () => {
  assert.deepEqual(profileBadgeKeys({ emailVerified: true, medalKeys: [] }), ["beta-user", "verified-member"]);
});

test("badges an admin gave come first, without repeats", () => {
  assert.deepEqual(profileBadgeKeys({ emailVerified: false, medalKeys: ["badge-investor", "badge-beta-user", "badge-member"] }), [
    "investor",
    "beta-user",
    "member",
  ]);
  assert.deepEqual(profileBadgeKeys({ emailVerified: true, medalKeys: ["badge-member", "badge-owner"] }), ["owner", "beta-user", "verified-member"]);
});

test("a given Verified Member badge counts even without a verified email", () => {
  assert.deepEqual(profileBadgeKeys({ emailVerified: false, medalKeys: ["badge-verified-member"] }), ["verified-member", "beta-user"]);
});

test("other medals and unknown badge keys are ignored", () => {
  assert.deepEqual(profileBadgeKeys({ emailVerified: false, medalKeys: ["founding-member", "badge-made-up", "badge-"] }), ["beta-user", "member"]);
});
