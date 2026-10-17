import "./helpers/email-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createEmailPipeline } from "../src/lib/email-pipeline.js";
import { resolveEmailMode } from "../src/lib/email-policy.js";
import { createMemoryStore, makePipelineDeps, scriptedTransport } from "./helpers/email-fakes.js";
import { testSend } from "../src/lib/email-transports.js";

const ADDRESS = "sam.jones@nexus.example.org";

test("optional mail is skipped for an account that has not opted in, and nothing is sent", async () => {
  const transport = scriptedTransport([{ ok: true }]);
  const { deps } = makePipelineDeps({ transport: transport.send, isOptedIn: async () => false });
  const result = await createEmailPipeline(deps).sendTemplate("product-announcement", ADDRESS, { title: "New", body: "News" }, { userId: "user-1" });
  assert.equal(result.skipped, "not-subscribed");
  assert.equal(result.delivered, false);
  assert.equal(transport.calls(), 0);
});

test("optional mail with no account attached is never sent", async () => {
  const transport = scriptedTransport([{ ok: true }]);
  const { deps } = makePipelineDeps({ transport: transport.send, isOptedIn: async () => true });
  const result = await createEmailPipeline(deps).sendTemplate("release-notes", ADDRESS, { version: "1.0.15", highlights: ["x"] });
  assert.equal(result.skipped, "not-subscribed");
  assert.equal(transport.calls(), 0);
});

test("optional mail for an account that opted in carries the one-click unsubscribe headers", async () => {
  const transport = scriptedTransport([{ ok: true }]);
  const { deps } = makePipelineDeps({ transport: transport.send, isOptedIn: async (_user, key) => key === "releaseNotes" });
  const result = await createEmailPipeline(deps).sendTemplate("release-notes", ADDRESS, { version: "1.0.15", highlights: ["Faster"] }, { userId: "user-1" });
  assert.equal(result.delivered, true);
  const headers = transport.sent[0].headers ?? {};
  assert.match(headers["List-Unsubscribe"] ?? "", /^<https:\/\/.+unsubscribe.+>$/);
  assert.equal(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(transport.sent[0].text, /Unsubscribe from these emails/);
});

test("essential mail carries no unsubscribe header, and is sent without any opt-in", async () => {
  const transport = scriptedTransport([{ ok: true }]);
  const { deps } = makePipelineDeps({ transport: transport.send, isOptedIn: async () => false });
  const result = await createEmailPipeline(deps).sendTemplate("welcome", ADDRESS, { username: "Sam" }, { userId: "user-1" });
  assert.equal(result.delivered, true);
  assert.equal(transport.sent[0].headers, undefined);
});

test("optional mail is not deduplicated: a deliberate second send goes out", async () => {
  const transport = scriptedTransport([{ ok: true }]);
  const memory = createMemoryStore();
  const { deps } = makePipelineDeps({ transport: transport.send, memory, isOptedIn: async () => true });
  const pipeline = createEmailPipeline(deps);
  await pipeline.sendTemplate("product-announcement", ADDRESS, { title: "A", body: "B" }, { userId: "user-1" });
  await pipeline.sendTemplate("product-announcement", ADDRESS, { title: "A", body: "B" }, { userId: "user-1" });
  assert.equal(transport.calls(), 2);
});

test("the mode rules: test mode wins over SMTP; a missing SMTP host means test outside production and failure inside it", () => {
  assert.equal(resolveEmailMode({ testMode: true, smtpHost: "smtp.example.org", production: true }), "test");
  assert.equal(resolveEmailMode({ testMode: false, smtpHost: "smtp.example.org", production: true }), "smtp");
  assert.equal(resolveEmailMode({ testMode: false, smtpHost: undefined, production: false }), "test");
  assert.equal(resolveEmailMode({ testMode: false, smtpHost: undefined, production: true }), "unconfigured");
});

test("the test transport builds the message in-process and returns an id, without opening a connection", async () => {
  const info = await testSend({
    from: { name: "Nexus Forge Gaming", address: "no-reply@nexus.example.org" },
    to: ADDRESS,
    subject: "Test",
    text: "Hello there",
    html: "<p>Hello there</p>",
  });
  assert.equal(typeof info.messageId, "string");
  assert.ok(info.messageId!.length > 0);
});
