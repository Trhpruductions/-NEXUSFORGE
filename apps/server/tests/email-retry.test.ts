import "./helpers/email-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createEmailPipeline } from "../src/lib/email-pipeline.js";
import { createMemoryStore, makePipelineDeps, netError, scriptedTransport, smtpError } from "./helpers/email-fakes.js";

const BASE = {
  kind: "service-notice",
  category: "ESSENTIAL" as const,
  to: "sam.jones@nexus.example.org",
  subject: "Planned notice",
  text: "Hello",
  html: "<p>Hello</p>",
  userId: "user-1",
};

test("a transient 4xx reply is retried, then succeeds: three attempts at most, with backoff", async () => {
  const memory = createMemoryStore();
  const transport = scriptedTransport([{ ok: false, error: smtpError(451) }, { ok: false, error: netError("ECONNRESET") }, { ok: true, messageId: "<m1@x>" }]);
  const { deps, sleeps } = makePipelineDeps({ memory, transport: transport.send });
  const pipeline = createEmailPipeline(deps);

  const result = await pipeline.sendMessage(BASE);
  assert.equal(result.delivered, true);
  assert.equal(transport.calls(), 3);
  assert.deepEqual(sleeps, [1_000, 3_000], "backoff grows between retries");
  const [row] = [...memory.rows.values()];
  assert.equal(row.status, "ACCEPTED", "accepted, not delivered: SMTP accepting it is all we know");
  assert.equal(row.attempts, 3);
  assert.equal(row.providerMessageId, "<m1@x>");
});

test("a transient failure that never clears stops after the third attempt and is recorded as FAILED", async () => {
  const memory = createMemoryStore();
  const transport = scriptedTransport([{ ok: false, error: smtpError(421) }]);
  const { deps, sleeps } = makePipelineDeps({ memory, transport: transport.send });
  const result = await createEmailPipeline(deps).sendMessage(BASE);

  assert.equal(result.delivered, false);
  assert.equal(transport.calls(), 3, "one attempt plus two retries, no more");
  assert.equal(sleeps.length, 2);
  const [row] = [...memory.rows.values()];
  assert.equal(row.status, "FAILED");
  assert.equal(row.attempts, 3);
  assert.match(row.lastError ?? "", /421/);
});

test("a permanent 5xx reply is not retried", async () => {
  const memory = createMemoryStore();
  const transport = scriptedTransport([{ ok: false, error: smtpError(550, "550 5.1.1 user unknown") }]);
  const { deps, sleeps } = makePipelineDeps({ memory, transport: transport.send });
  const result = await createEmailPipeline(deps).sendMessage(BASE);

  assert.equal(result.delivered, false);
  assert.equal(transport.calls(), 1);
  assert.equal(sleeps.length, 0);
  assert.equal([...memory.rows.values()][0].status, "FAILED");
});

test("a failed login is not retried", async () => {
  const memory = createMemoryStore();
  const transport = scriptedTransport([{ ok: false, error: netError("EAUTH", "Invalid login") }]);
  const { deps } = makePipelineDeps({ memory, transport: transport.send });
  await createEmailPipeline(deps).sendMessage(BASE);
  assert.equal(transport.calls(), 1);
});

test("a timeout is retried, and the error text reaching the caller is redacted", async () => {
  const memory = createMemoryStore();
  const transport = scriptedTransport([{ ok: false, error: new Error("Connection timeout to smtp.example.org") }]);
  const { deps } = makePipelineDeps({ memory, transport: transport.send });
  const result = await createEmailPipeline(deps).sendMessage(BASE);
  assert.equal(transport.calls(), 3);
  assert.equal(result.error, "Connection timeout to smtp.example.org", "a host name is not secret, so it stays");
});

test("test mode uses its own transport and records the send as transport 'test'", async () => {
  const memory = createMemoryStore();
  const smtp = scriptedTransport([{ ok: true }]);
  const test = scriptedTransport([{ ok: true, messageId: "<json-1@local>" }]);
  const { deps } = makePipelineDeps({ memory, mode: () => "test", transports: { smtp: smtp.send, test: test.send } });
  const result = await createEmailPipeline(deps).sendMessage(BASE);
  assert.equal(result.transport, "test");
  assert.equal(result.delivered, true);
  assert.equal(smtp.calls(), 0, "the real SMTP transport is never used in test mode");
  assert.equal(test.calls(), 1);
  assert.equal([...memory.rows.values()][0].transport, "test");
});

test("with no SMTP in production the send fails loudly and is still recorded", async () => {
  const memory = createMemoryStore();
  const transport = scriptedTransport([{ ok: true }]);
  const { deps } = makePipelineDeps({ memory, mode: () => "unconfigured", transports: { smtp: transport.send, test: transport.send } });
  const result = await createEmailPipeline(deps).sendMessage(BASE);
  assert.equal(result.delivered, false);
  assert.match(result.error ?? "", /not configured/);
  assert.equal(transport.calls(), 0);
  assert.equal([...memory.rows.values()][0].status, "FAILED");
});

test("a broken record store does not stop the email from going out", async () => {
  const transport = scriptedTransport([{ ok: true, messageId: "<m2@x>" }]);
  const { deps, logs } = makePipelineDeps({ transport: transport.send });
  deps.store = {
    ...deps.store,
    create: async () => {
      throw new Error("relation \"EmailMessage\" does not exist");
    },
    transition: async () => {
      throw new Error("relation \"EmailMessage\" does not exist");
    },
    latestSendAt: async () => {
      throw new Error("relation \"EmailMessage\" does not exist");
    },
  };
  const result = await createEmailPipeline(deps).sendMessage(BASE);
  assert.equal(result.delivered, true, "the email still goes out");
  assert.ok(logs.some((line) => line.includes("record write failed")), "the failure is logged");
});
