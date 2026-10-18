"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { growthPercent, summarizeStore, billingReadiness, FEATURE_LABELS } = require("../lib/finance");

test("growth matches the website: a percent change, or 100 when there was nothing before", () => {
  assert.equal(growthPercent(150, 100), 50);
  assert.equal(growthPercent(50, 100), -50);
  assert.equal(growthPercent(40, 0), 100);
  assert.equal(growthPercent(0, 0), 0);
  assert.equal(growthPercent(1, 3), -66.67);
});

test("store purchases are grouped by store, with active, expired and revoked counts", () => {
  const rows = [
    { provider: "GOOGLE", status: "ACTIVE", total: 2, last30: 1 },
    { provider: "APPLE", status: "ACTIVE", total: 3, last30: 2 },
    { provider: "APPLE", status: "EXPIRED", total: 1, last30: 0 },
    { provider: "APPLE", status: "REVOKED", total: 1, last30: 1 },
  ];
  assert.deepEqual(summarizeStore(rows), [
    { provider: "APPLE", active: 3, expired: 1, revoked: 1, purchasesLast30Days: 3 },
    { provider: "GOOGLE", active: 2, expired: 0, revoked: 0, purchasesLast30Days: 1 },
  ]);
});

test("store summary is empty when no store has sold anything", () => {
  assert.deepEqual(summarizeStore([]), []);
});

test("payments are ready only when the Stripe key and every Core+ price are set", () => {
  const all = new Set([
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    ...["CORE", "PLUS", "ELITE", "INFINITE"].flatMap((tier) => [`STRIPE_PRICE_${tier}_MONTHLY`, `STRIPE_PRICE_${tier}_YEARLY`]),
  ]);
  const describe = (set) => (key) => ({ present: set.has(key), length: set.has(key) ? 3 : 0, sources: [] });

  const ready = billingReadiness(describe(all));
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.missingTierPrices, []);

  const partial = new Set([...all].filter((key) => key !== "STRIPE_PRICE_ELITE_YEARLY"));
  const incomplete = billingReadiness(describe(partial));
  assert.equal(incomplete.ready, false);
  assert.deepEqual(incomplete.missingTierPrices, ["STRIPE_PRICE_ELITE_YEARLY"]);

  const noKey = billingReadiness(describe(new Set()));
  assert.equal(noKey.stripeKeyPresent, false);
  assert.equal(noKey.ready, false);
});

test("readiness reports presence only, never a key value", () => {
  const describe = () => ({ present: true, length: 30, sources: [] });
  const result = billingReadiness(describe);
  assert.equal(JSON.stringify(result).includes("sk_"), false);
  assert.ok(Object.values(result).every((value) => typeof value !== "string" || value.length < 30));
});

test("feature labels match the names the website uses", () => {
  assert.equal(FEATURE_LABELS.FORGE_BOOST_PACK, "Forge Boost Packs");
  assert.equal(FEATURE_LABELS.ADVANCED_MODERATION_AI, "Activity pressure");
});
