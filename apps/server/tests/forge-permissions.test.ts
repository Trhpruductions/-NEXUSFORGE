import test from "node:test";
import assert from "node:assert/strict";
import {
  canManageRolePosition,
  canModerateMember,
  hasForgePermission,
  isProtectedOwnerRole,
  normalizePermissions,
  ownerRolePosition,
  resolveForgeAccess,
} from "../src/lib/forge-permissions.js";

test("normalizePermissions ignores unknown keys and coerces truthiness", () => {
  const result = normalizePermissions({ manageChannels: 1, banUsers: "yes", bogus: true });
  assert.equal(result.manageChannels, true);
  assert.equal(result.banUsers, true);
  assert.equal(result.kickUsers, false);
  assert.equal("bogus" in result, false);
});

test("normalizePermissions tolerates null and non-object input", () => {
  assert.equal(normalizePermissions(null).moderateChat, false);
  assert.equal(normalizePermissions("nope").moderateChat, false);
});

test("owner resolves to every permission at the owner position", () => {
  const access = resolveForgeAccess(true, []);
  assert.equal(access.isOwner, true);
  assert.equal(access.topPosition, ownerRolePosition);
  assert.equal(hasForgePermission(access, "banUsers"), true);
});

test("member permissions union across roles and track the top position", () => {
  const access = resolveForgeAccess(false, [
    { id: "a", position: 5, permissions: { kickUsers: true } },
    { id: "b", position: 12, permissions: { moderateChat: true } },
  ]);
  assert.equal(access.topPosition, 12);
  assert.equal(access.permissions.kickUsers, true);
  assert.equal(access.permissions.moderateChat, true);
  assert.equal(access.permissions.banUsers, false);
});

test("manageForge implies manageChannels and manageRoles", () => {
  const access = resolveForgeAccess(false, [{ id: "a", position: 3, permissions: { manageForge: true } }]);
  assert.equal(access.permissions.manageChannels, true);
  assert.equal(access.permissions.manageRoles, true);
});

test("member without roles has no permissions and position -1", () => {
  const access = resolveForgeAccess(false, []);
  assert.equal(access.topPosition, -1);
  assert.equal(hasForgePermission(access, "streamAccess"), false);
});

test("canManageRolePosition blocks the owner role and roles at or above the actor", () => {
  const owner = resolveForgeAccess(true, []);
  const admin = resolveForgeAccess(false, [{ id: "a", position: 50, permissions: { manageRoles: true } }]);
  const plain = resolveForgeAccess(false, [{ id: "p", position: 50, permissions: {} }]);

  assert.equal(canManageRolePosition(owner, ownerRolePosition), false);
  assert.equal(canManageRolePosition(owner, 99), true);
  assert.equal(canManageRolePosition(admin, 49), true);
  assert.equal(canManageRolePosition(admin, 50), false);
  assert.equal(canManageRolePosition(admin, 75), false);
  assert.equal(canManageRolePosition(plain, 10), false);
});

test("canModerateMember requires outranking the target and never targets the owner", () => {
  const owner = resolveForgeAccess(true, []);
  const mod = resolveForgeAccess(false, [{ id: "m", position: 40, permissions: { kickUsers: true } }]);
  const peer = resolveForgeAccess(false, [{ id: "m2", position: 40, permissions: {} }]);
  const newbie = resolveForgeAccess(false, []);

  assert.equal(canModerateMember(mod, owner), false);
  assert.equal(canModerateMember(owner, mod), true);
  assert.equal(canModerateMember(mod, newbie), true);
  assert.equal(canModerateMember(mod, peer), false);
  assert.equal(canModerateMember(newbie, mod), false);
});

test("isProtectedOwnerRole matches by position or name", () => {
  assert.equal(isProtectedOwnerRole({ name: "Owner", position: 100 }), true);
  assert.equal(isProtectedOwnerRole({ name: "owner ", position: 1 }), true);
  assert.equal(isProtectedOwnerRole({ name: "Moderator", position: 99 }), false);
});
