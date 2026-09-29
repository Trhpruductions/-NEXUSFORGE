import test from "node:test";
import assert from "node:assert/strict";
import {
  achievementReference,
  cosmeticPurchaseReference,
  dailyClaimReference,
  rigDecommissionReference,
  rigPurchaseReference,
  welcomeBonusReference,
} from "../src/lib/economy-references.js";

const alice = "11111111-1111-1111-1111-111111111111";
const bob = "22222222-2222-2222-2222-222222222222";

/**
 * Every builder, paired with two calls that differ only by the account. These must never
 * collide: referenceId is globally unique, so a shared key silently locks the payout to
 * whoever claims it first.
 */
const builders: Array<{ name: string; forUser: (userId: string) => string }> = [
  { name: "dailyClaimReference", forUser: (userId) => dailyClaimReference(userId, 20_400) },
  { name: "welcomeBonusReference", forUser: (userId) => welcomeBonusReference(userId) },
  { name: "achievementReference", forUser: (userId) => achievementReference(userId, "champion") },
  { name: "cosmeticPurchaseReference", forUser: (userId) => cosmeticPurchaseReference(userId, "item-abc") },
  { name: "rigPurchaseReference", forUser: (userId) => rigPurchaseReference(userId, "purchase-1") },
  { name: "rigDecommissionReference", forUser: (userId) => rigDecommissionReference(userId, "rig-1") },
];

test("no reference is shared between two accounts", () => {
  for (const { name, forUser } of builders) {
    assert.notEqual(forUser(alice), forUser(bob), `${name} produced the same reference for two accounts`);
  }
});

test("every reference carries the account it belongs to", () => {
  for (const { name, forUser } of builders) {
    assert.ok(forUser(alice).includes(alice), `${name} left the account out of the reference`);
  }
});

test("the same claim by the same account is stable", () => {
  assert.equal(dailyClaimReference(alice, 20_400), dailyClaimReference(alice, 20_400));
  assert.equal(achievementReference(alice, "champion"), achievementReference(alice, "champion"));
  assert.equal(cosmeticPurchaseReference(alice, "item-abc"), cosmeticPurchaseReference(alice, "item-abc"));
});

test("different days, achievements and items stay distinct for one account", () => {
  assert.notEqual(dailyClaimReference(alice, 20_400), dailyClaimReference(alice, 20_401));
  assert.notEqual(achievementReference(alice, "champion"), achievementReference(alice, "first-blood"));
  assert.notEqual(cosmeticPurchaseReference(alice, "item-abc"), cosmeticPurchaseReference(alice, "item-xyz"));
  assert.notEqual(rigPurchaseReference(alice, "purchase-1"), rigPurchaseReference(alice, "purchase-2"));
});

test("payout kinds do not collide with each other", () => {
  const all = builders.map(({ forUser }) => forUser(alice));
  assert.equal(new Set(all).size, all.length, "two payout kinds produced the same reference");
});
