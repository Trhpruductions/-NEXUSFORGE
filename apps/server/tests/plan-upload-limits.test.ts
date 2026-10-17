import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

// The env schema is read when config/env.ts loads, so set throwaway secrets for this run first.
process.env.JWT_ACCESS_SECRET ??= randomBytes(32).toString("hex");
process.env.JWT_REFRESH_SECRET ??= randomBytes(32).toString("hex");
process.env.DATABASE_URL ??= "postgresql://localhost/unused";

const { env } = await import("../src/config/env.js");
const { limitsFor, PLANS } = await import("../src/lib/plans.js");

const MB = 1024 * 1024;
const free = { premium: false, premiumTier: null };
const core = { premium: true, premiumTier: "CORE" };
const plus = { premium: true, premiumTier: "PLUS" };

/** Runs `body` with billing on or off, then puts the environment back. */
function withBilling(on: boolean, body: () => void) {
  const before = env.STRIPE_SECRET_KEY;
  env.STRIPE_SECRET_KEY = on ? "sk_test_placeholder_for_limits_only" : undefined;
  try {
    body();
  } finally {
    env.STRIPE_SECRET_KEY = before;
  }
}

test("the free plan allows 50 MB uploads, and enforces it once billing is on", () => {
  assert.equal(PLANS.NONE.uploadBytes, 50 * MB);
  withBilling(true, () => {
    const limits = limitsFor(free);
    assert.equal(limits.uploadBytes, 50 * MB);
    assert.equal(limits.enforced, true);
  });
});

test("with billing off, a free user still gets at least the 50 MB free allowance", () => {
  withBilling(false, () => {
    const limits = limitsFor(free);
    assert.ok(limits.uploadBytes >= 50 * MB, `got ${limits.uploadBytes / MB} MB`);
    assert.equal(limits.enforced, false);
  });
});

test("with billing on, paid tiers get their own upload limits", () => {
  withBilling(true, () => {
    assert.equal(limitsFor(core).uploadBytes, 100 * MB);
    assert.equal(limitsFor(plus).uploadBytes, 250 * MB);
  });
});

test("with billing off, premium users keep the pre-plans allowance (the open-beta decision)", () => {
  // Decision (see docs/remediation/master-inventory-2026-10-17.md): during open beta nobody loses an upload size they
  // already had. The premium allowance is PREMIUM_UPLOAD_MAX_BYTES (150 MB by default), above the Core tier. Once
  // billing is on, each premium user gets their tier's limit instead.
  withBilling(false, () => {
    const limits = limitsFor(core);
    assert.ok(limits.uploadBytes >= 100 * MB);
    assert.equal(limits.enforced, false);
  });
});
