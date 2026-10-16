import test from "node:test";
import assert from "node:assert/strict";
import { billingEnforcedFor } from "../src/middleware/entitlements.js";

// Paid features must not open for free on a production server, even when the billing key is missing.

test("with a billing key, paid features are enforced in any environment", () => {
  assert.equal(billingEnforcedFor({ stripeSecretKey: "sk_test_placeholder", nodeEnv: "development" }), true);
  assert.equal(billingEnforcedFor({ stripeSecretKey: "sk_live_placeholder", nodeEnv: "production" }), true);
});

test("in production, paid features are enforced even when the billing key is missing (fails closed)", () => {
  assert.equal(billingEnforcedFor({ stripeSecretKey: undefined, nodeEnv: "production" }), true);
  assert.equal(billingEnforcedFor({ stripeSecretKey: "", nodeEnv: "production" }), true);
});

test("in development or test with no billing key, paid features stay open for local use", () => {
  assert.equal(billingEnforcedFor({ stripeSecretKey: undefined, nodeEnv: "development" }), false);
  assert.equal(billingEnforcedFor({ stripeSecretKey: "", nodeEnv: "test" }), false);
});
