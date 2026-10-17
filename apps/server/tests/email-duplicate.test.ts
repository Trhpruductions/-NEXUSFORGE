import "./helpers/email-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { DUPLICATE_WINDOW_MS } from "../src/lib/email-policy.js";
import { createEmailPipeline, type SendMessageInput } from "../src/lib/email-pipeline.js";
import { createMemoryStore, makePipelineDeps, netError, scriptedTransport } from "./helpers/email-fakes.js";

const RESET: SendMessageInput = {
  kind: "password-reset",
  category: "ESSENTIAL",
  to: "sam.jones@nexus.example.org",
  subject: "Reset your Nexus Forge Gaming password",
  text: "Choose a new password: https://nexus.example.org/reset-password?token=t1",
  html: "<p>x</p>",
  userId: "user-1",
};

test("an identical essential email to the same account within 60 seconds is suppressed", async () => {
  const transport = scriptedTransport([{ ok: true }]);
  const { deps } = makePipelineDeps({ transport: transport.send });
  const pipeline = createEmailPipeline(deps);

  const first = await pipeline.sendMessage(RESET);
  const second = await pipeline.sendMessage(RESET);
  assert.equal(first.delivered, true);
  assert.equal(second.suppressed, true);
  assert.equal(second.delivered, false);
  assert.equal(transport.calls(), 1, "only one email left the pipeline");
});

test("once the window has passed, the same kind may be sent again", async () => {
  const transport = scriptedTransport([{ ok: true }]);
  const memory = createMemoryStore();
  const { deps } = makePipelineDeps({ transport: transport.send, memory });
  const pipeline = createEmailPipeline(deps);

  await pipeline.sendMessage(RESET);
  memory.advance(DUPLICATE_WINDOW_MS + 1_000);
  const later = await pipeline.sendMessage(RESET);
  assert.equal(later.delivered, true);
  assert.equal(transport.calls(), 2);
});

test("different kinds to the same account are not duplicates of each other", async () => {
  const transport = scriptedTransport([{ ok: true }]);
  const { deps } = makePipelineDeps({ transport: transport.send });
  const pipeline = createEmailPipeline(deps);
  await pipeline.sendMessage(RESET);
  const other = await pipeline.sendMessage({ ...RESET, kind: "password-changed", subject: "Your Nexus Forge Gaming password was changed" });
  assert.equal(other.delivered, true);
  assert.equal(transport.calls(), 2);
});

test("a failed send does not block the retry, because only sent mail counts", async () => {
  const transport = scriptedTransport([{ ok: false, error: netError("EAUTH", "Invalid login") }, { ok: true }]);
  const { deps } = makePipelineDeps({ transport: transport.send });
  const pipeline = createEmailPipeline(deps);
  const failed = await pipeline.sendMessage(RESET);
  const retried = await pipeline.sendMessage(RESET);
  assert.equal(failed.delivered, false);
  assert.equal(retried.delivered, true);
});

test("two identical sends racing each other: only one goes out", async () => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const { deps } = makePipelineDeps({
    transport: async () => {
      calls += 1;
      await gate;
      return { messageId: "<race@x>" };
    },
  });
  const pipeline = createEmailPipeline(deps);
  const first = pipeline.sendMessage(RESET);
  const second = pipeline.sendMessage(RESET);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.ok(a.delivered !== b.delivered, "exactly one of the two sends went out");
  assert.equal(b.suppressed === true || a.suppressed === true, true);
});

test("essential mail with no account attached is never deduplicated", async () => {
  const transport = scriptedTransport([{ ok: true }]);
  const { deps } = makePipelineDeps({ transport: transport.send });
  const pipeline = createEmailPipeline(deps);
  const anonymous = { ...RESET, userId: null };
  await pipeline.sendMessage(anonymous);
  await pipeline.sendMessage(anonymous);
  assert.equal(transport.calls(), 2);
});

test("the wait before a repeat is reported in whole seconds", async () => {
  const transport = scriptedTransport([{ ok: true }]);
  const memory = createMemoryStore();
  const { deps } = makePipelineDeps({ transport: transport.send, memory });
  const pipeline = createEmailPipeline(deps);
  await pipeline.sendMessage(RESET);
  memory.advance(20_000);
  const wait = await pipeline.duplicateWaitSeconds("user-1", "password-reset", RESET.subject);
  assert.equal(wait, 40);
  assert.equal(await pipeline.duplicateWaitSeconds("user-2", "password-reset", RESET.subject), 0);
});
