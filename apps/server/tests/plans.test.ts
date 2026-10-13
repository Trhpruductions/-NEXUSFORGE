import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-at-least-32-characters";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-at-least-32-characters";
const { PLANS, TIER_ORDER, cheapestTierWith, limitsFor, upgradeRequired } = await import("../src/lib/plans.js");

test("each paid tier unlocks at least as much as the one below it", () => {
  for (let i = 1; i < TIER_ORDER.length; i += 1) {
    const lower = PLANS[TIER_ORDER[i - 1]];
    const higher = PLANS[TIER_ORDER[i]];
    assert.ok(higher.uploadBytes >= lower.uploadBytes, `${TIER_ORDER[i]} uploads`);
    assert.ok(higher.maxServers >= lower.maxServers, `${TIER_ORDER[i]} servers`);
    assert.ok(higher.messageLength >= lower.messageLength, `${TIER_ORDER[i]} messages`);
  }
  // Free includes what Discord charges for.
  assert.equal(PLANS.NONE.profileBanner, true);
  assert.equal(PLANS.NONE.animatedAvatar, true);
  assert.equal(PLANS.NONE.messageLength, 4000);
  assert.ok(PLANS.NONE.uploadBytes >= 50 * 1024 * 1024);
  assert.ok(PLANS.NONE.maxServers >= 200);
});

test("upgrade prompts name the cheapest tier that would work", () => {
  assert.equal(cheapestTierWith((plan) => plan.uploadBytes >= 80 * 1024 * 1024), "CORE");
  assert.equal(cheapestTierWith((plan) => plan.uploadBytes >= 400 * 1024 * 1024), "ELITE");
  assert.equal(cheapestTierWith((plan) => plan.ultraVideo), "PLUS");
  const body = upgradeRequired("x", "UPLOAD_SIZE", "ELITE");
  assert.equal(body.code, "UPGRADE_REQUIRED");
  assert.equal(body.requiredTierLabel, "Elite");
});

test("without billing connected nobody is limited beyond what the app allowed before", () => {
  // These tests run without STRIPE_SECRET_KEY.
  const free = limitsFor({ premium: false, premiumTier: "NONE" });
  assert.equal(free.enforced, false);
  assert.equal(free.messageLength, 4000);
  assert.equal(free.profileBanner, true);
  assert.ok(free.maxServers >= 1000);
});
