import "./helpers/email-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { handleProviderWebhook } from "../src/lib/email-webhook.js";
import { createEmailPipeline } from "../src/lib/email-pipeline.js";
import { ReplayGuard, signWebhookBody, verifyWebhookSignature, WEBHOOK_TOLERANCE_MS } from "../src/lib/email-tokens.js";
import { createMemoryStore, makePipelineDeps } from "./helpers/email-fakes.js";

const SECRET = "webhook-secret-for-tests-0123456789abcdef";
const NOW = Date.parse("2026-10-14T12:00:00Z");
const nowSeconds = (ms: number) => String(Math.floor(ms / 1000));

function signedRequest(body: string, timestampMs = NOW, secret = SECRET) {
  const timestamp = nowSeconds(timestampMs);
  const rawBody = Buffer.from(body);
  return { timestamp, signature: signWebhookBody(secret, timestamp, rawBody), rawBody };
}

/** A pipeline whose store already holds one accepted message with a known provider message id. */
async function setup() {
  const memory = createMemoryStore(NOW);
  const id = await memory.store.create({
    kind: "service-notice",
    category: "ESSENTIAL",
    transport: "smtp",
    userId: "user-1",
    recipientHash: "a".repeat(64),
    recipientMasked: "sa••@example.org",
    subject: "Notice",
    status: "ACCEPTED",
    attempts: 1,
    lastError: null,
  });
  await memory.store.transition(id, "ACCEPTED", "ACCEPTED", { providerMessageId: "<provider-1@example.org>" });
  const { deps } = makePipelineDeps({ memory });
  const pipeline = createEmailPipeline(deps);
  return { memory, id, pipeline };
}

const eventBody = (type: string, messageId = "<provider-1@example.org>") =>
  JSON.stringify({ messageId, type, occurredAt: "2026-10-14T11:59:30Z" });

test("a correctly signed, fresh event updates the status", async () => {
  const { memory, id, pipeline } = await setup();
  const result = await handleProviderWebhook({ secret: SECRET, ...signedRequest(eventBody("delivered")), nowMs: NOW, replay: new ReplayGuard(), pipeline });
  assert.equal(result.status, 200);
  assert.equal(result.body.applied, true);
  assert.equal(memory.rows.get(id)?.status, "DELIVERED");
});

test("a wrong signature is refused and changes nothing", async () => {
  const { memory, id, pipeline } = await setup();
  const { timestamp, rawBody } = signedRequest(eventBody("bounced"));
  const result = await handleProviderWebhook({ secret: SECRET, timestamp, signature: "v1=" + "0".repeat(64), rawBody, nowMs: NOW, replay: new ReplayGuard(), pipeline });
  assert.equal(result.status, 401);
  assert.equal(memory.rows.get(id)?.status, "ACCEPTED");
});

test("a valid signature over a different body is refused (tampered payload)", async () => {
  const { memory, id, pipeline } = await setup();
  const signed = signedRequest(eventBody("delivered"));
  const tampered = Buffer.from(eventBody("bounced"));
  const result = await handleProviderWebhook({ secret: SECRET, timestamp: signed.timestamp, signature: signed.signature, rawBody: tampered, nowMs: NOW, replay: new ReplayGuard(), pipeline });
  assert.equal(result.status, 401);
  assert.equal(memory.rows.get(id)?.status, "ACCEPTED");
});

test("a signature made with another secret is refused", async () => {
  const { pipeline } = await setup();
  const signed = signedRequest(eventBody("delivered"), NOW, "some-other-secret-that-is-long-enough-0000");
  const result = await handleProviderWebhook({ secret: SECRET, ...signed, nowMs: NOW, replay: new ReplayGuard(), pipeline });
  assert.equal(result.status, 401);
});

test("a replayed request inside the five-minute window is refused the second time", async () => {
  const { pipeline } = await setup();
  const replay = new ReplayGuard();
  const signed = signedRequest(eventBody("delivered"));
  const first = await handleProviderWebhook({ secret: SECRET, ...signed, nowMs: NOW, replay, pipeline });
  const again = await handleProviderWebhook({ secret: SECRET, ...signed, nowMs: NOW + 30_000, replay, pipeline });
  assert.equal(first.status, 200);
  assert.equal(again.status, 401);
});

test("a request older than five minutes is refused even if its signature is valid", async () => {
  const { pipeline } = await setup();
  const signed = signedRequest(eventBody("delivered"), NOW - WEBHOOK_TOLERANCE_MS - 1_000);
  const result = await handleProviderWebhook({ secret: SECRET, ...signed, nowMs: NOW, replay: new ReplayGuard(), pipeline });
  assert.equal(result.status, 401);
});

test("a timestamp more than five minutes in the future is refused", () => {
  const verdict = verifyWebhookSignature({
    secret: SECRET,
    ...signedRequest(eventBody("delivered"), NOW + WEBHOOK_TOLERANCE_MS + 60_000),
    nowMs: NOW,
    replay: new ReplayGuard(),
  });
  assert.deepEqual(verdict, { ok: false, reason: "stale-timestamp" });
});

test("missing headers and a non-numeric timestamp are refused before any comparison", () => {
  const replay = new ReplayGuard();
  const rawBody = Buffer.from(eventBody("delivered"));
  assert.deepEqual(verifyWebhookSignature({ secret: SECRET, timestamp: undefined, signature: "v1=x", rawBody, nowMs: NOW, replay }), { ok: false, reason: "missing-headers" });
  assert.deepEqual(verifyWebhookSignature({ secret: SECRET, timestamp: "2026-10-14", signature: "v1=x", rawBody, nowMs: NOW, replay }), { ok: false, reason: "bad-timestamp" });
});

test("with no secret, or a secret shorter than 32 characters, the endpoint is disabled (404)", async () => {
  const { pipeline } = await setup();
  const signed = signedRequest(eventBody("delivered"));
  for (const secret of [undefined, "too-short"]) {
    const result = await handleProviderWebhook({ secret, ...signed, nowMs: NOW, replay: new ReplayGuard(), pipeline });
    assert.equal(result.status, 404, `secret ${String(secret)} must disable the endpoint`);
  }
});

test("a verified request with a body that is not JSON, or not a known event, gets a 400", async () => {
  const { pipeline } = await setup();
  const notJson = signedRequest("not json at all");
  assert.equal((await handleProviderWebhook({ secret: SECRET, ...notJson, nowMs: NOW, replay: new ReplayGuard(), pipeline })).status, 400);

  const unknownType = signedRequest(JSON.stringify({ messageId: "<provider-1@example.org>", type: "opened", occurredAt: "2026-10-14T11:59:30Z" }));
  assert.equal((await handleProviderWebhook({ secret: SECRET, ...unknownType, nowMs: NOW, replay: new ReplayGuard(), pipeline })).status, 400);
});

test("an event for an unknown message is acknowledged without changing anything", async () => {
  const { pipeline } = await setup();
  const signed = signedRequest(eventBody("delivered", "<nobody@example.org>"));
  const result = await handleProviderWebhook({ secret: SECRET, ...signed, nowMs: NOW, replay: new ReplayGuard(), pipeline });
  assert.equal(result.status, 200);
  assert.equal(result.body.matched, false);
});

test("a bounce after delivery is refused, and a repeated delivery changes nothing", async () => {
  const { memory, id, pipeline } = await setup();
  const replay = new ReplayGuard();
  const delivered = signedRequest(eventBody("delivered"), NOW);
  await handleProviderWebhook({ secret: SECRET, ...delivered, nowMs: NOW, replay, pipeline });
  const repeatMs = NOW + 1_000;
  const repeated = await handleProviderWebhook({ secret: SECRET, ...signedRequest(eventBody("delivered"), repeatMs), nowMs: repeatMs, replay, pipeline });
  assert.equal(repeated.body.applied, false);
  const bounceMs = NOW + 2_000;
  const bounced = await handleProviderWebhook({ secret: SECRET, ...signedRequest(eventBody("bounced"), bounceMs), nowMs: bounceMs, replay, pipeline });
  assert.equal(bounced.body.applied, false);
  assert.equal(memory.rows.get(id)?.status, "DELIVERED");
});

test("the replay guard forgets a signature once its window has passed", () => {
  const guard = new ReplayGuard();
  assert.equal(guard.remember("sig", NOW + 1_000, NOW), true);
  assert.equal(guard.remember("sig", NOW + 1_000, NOW + 500), false);
  assert.equal(guard.remember("sig", NOW + 9_000, NOW + 2_000), true);
});
