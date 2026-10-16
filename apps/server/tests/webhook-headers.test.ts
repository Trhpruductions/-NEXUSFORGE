import test from "node:test";
import assert from "node:assert/strict";
import { webhookHeaders } from "../src/lib/webhooks.js";

// A header name with a space is refused before the request is sent, so every webhook delivery would silently fail.

test("webhook delivery headers are valid HTTP header names", () => {
  const headers = webhookHeaders("order.created", "sub_1", "2026-10-15T00:00:00.000Z");
  // Headers throws on an invalid name, the same check fetch makes before it sends.
  const sent = new Headers(headers);
  assert.equal(sent.get("x-nexusforge-webhook-event"), "order.created");
  assert.equal(sent.get("x-nexusforge-webhook-subscription-id"), "sub_1");
  assert.equal(sent.get("x-nexusforge-webhook-delivered-at"), "2026-10-15T00:00:00.000Z");
});

test("the old header name with a space is rejected, which is why it broke deliveries", () => {
  assert.throws(() => new Headers({ "X-Nexus Forge-Webhook-Event": "x" }), TypeError);
});

test("header names carry no spaces", () => {
  for (const name of Object.keys(webhookHeaders("a", "b"))) {
    assert.doesNotMatch(name, /\s/);
  }
});
