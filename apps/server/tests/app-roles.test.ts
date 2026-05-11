import test from "node:test";
import assert from "node:assert/strict";
import {
  canAssignRole,
  canModifyTarget,
  hasAdminAccess,
  resolveEffectiveRole,
} from "../src/lib/app-roles.js";

test("resolveEffectiveRole falls back to ADMIN when legacy admin flag is true", () => {
  assert.equal(resolveEffectiveRole(null, true), "ADMIN");
  assert.equal(resolveEffectiveRole(undefined, true), "ADMIN");
});

test("resolveEffectiveRole keeps explicit role even when legacy flag is false", () => {
  assert.equal(resolveEffectiveRole("EXEC", false), "EXEC");
});

test("hasAdminAccess allows privileged roles and legacy admin", () => {
  assert.equal(hasAdminAccess("ADMIN", false), true);
  assert.equal(hasAdminAccess("EXEC", false), true);
  assert.equal(hasAdminAccess("OWNER", false), true);
  assert.equal(hasAdminAccess("USER", true), true);
});

test("hasAdminAccess rejects non-privileged role without legacy admin", () => {
  assert.equal(hasAdminAccess("MODERATOR", false), false);
  assert.equal(hasAdminAccess("USER", false), false);
});

test("canAssignRole blocks escalation above actor role", () => {
  assert.equal(canAssignRole("ADMIN", "EXEC"), false);
  assert.equal(canAssignRole("MODERATOR", "ADMIN"), false);
});

test("canAssignRole enforces owner-only high role assignment", () => {
  assert.equal(canAssignRole("EXEC", "OWNER"), false);
  assert.equal(canAssignRole("ADMIN", "EXEC"), false);
  assert.equal(canAssignRole("OWNER", "EXEC"), true);
  assert.equal(canAssignRole("OWNER", "OWNER"), true);
});

test("canModifyTarget allows self changes but blocks peer or higher role edits", () => {
  assert.equal(canModifyTarget("u1", "u1", "ADMIN", "ADMIN"), true);
  assert.equal(canModifyTarget("u1", "u2", "ADMIN", "ADMIN"), false);
  assert.equal(canModifyTarget("u1", "u2", "ADMIN", "MODERATOR"), true);
  assert.equal(canModifyTarget("u1", "u2", "EXEC", "OWNER"), false);
});
