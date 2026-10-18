import "./helpers/email-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createEmailPipeline } from "../src/lib/email-pipeline.js";
import { createMemoryStore, makePipelineDeps, scriptedTransport } from "./helpers/email-fakes.js";

const RAW_ADDRESS = "sam.jones@nexus.example.org";
const TOKEN = "Zx9Qw3Er7Ty2Ui8Op4As6Df1Gh5Jk0Lm";
const CODE = "482913";
const LINK = `https://nexus.example.org/reset-password?token=${TOKEN}`;

/** The only fields a stored record may contain. A body, token, code or link has no column to live in. */
const ALLOWED_FIELDS = [
  "id",
  "kind",
  "category",
  "transport",
  "userId",
  "recipientHash",
  "recipientMasked",
  "subject",
  "status",
  "providerMessageId",
  "attempts",
  "lastError",
  "createdAtMs",
].sort();

test("a stored record has exactly the allowed fields, and no body", async () => {
  const memory = createMemoryStore();
  const { deps } = makePipelineDeps({ memory, transport: scriptedTransport([{ ok: true }]).send });
  await createEmailPipeline(deps).sendTemplate("password-reset", RAW_ADDRESS, { username: "Sam", link: LINK, expiresIn: "30 minutes" }, { userId: "user-1" });

  const [row] = [...memory.rows.values()];
  assert.deepEqual(Object.keys(row).sort(), ALLOWED_FIELDS);
  assert.equal(JSON.stringify(row).includes(TOKEN), false, "the reset token is not stored anywhere on the record");
  assert.equal(JSON.stringify(row).includes("https://"), false, "no link is stored");
});

test("the recipient is stored as a hash and a masked form, never the full address", async () => {
  const memory = createMemoryStore();
  const { deps } = makePipelineDeps({ memory, transport: scriptedTransport([{ ok: true }]).send });
  await createEmailPipeline(deps).sendMessage({
    kind: "service-notice",
    category: "ESSENTIAL",
    to: RAW_ADDRESS,
    subject: "Notice",
    text: "t",
    html: "<p>t</p>",
    userId: "user-1",
  });
  const [row] = [...memory.rows.values()];
  assert.equal(JSON.stringify(row).includes("sam.jones"), false, "local part never stored");
  assert.equal(row.recipientMasked.endsWith("@nexus.example.org"), true);
  assert.match(row.recipientHash, /^[0-9a-f]{64}$/);
});

test("a provider error that echoes a link, a token, a code and an address is redacted before it is stored", async () => {
  const memory = createMemoryStore();
  const echoed = new Error(`550 rejected ${LINK} for ${RAW_ADDRESS} code ${CODE} password=hunter2`);
  const { deps } = makePipelineDeps({ memory, transport: scriptedTransport([{ ok: false, error: echoed }]).send });
  const result = await createEmailPipeline(deps).sendTemplate("password-reset", RAW_ADDRESS, { username: "Sam", link: LINK, expiresIn: "30 minutes" }, { userId: "user-1" });

  const [row] = [...memory.rows.values()];
  assert.ok(row.lastError, "an error is recorded");
  for (const secret of [TOKEN, CODE, RAW_ADDRESS, "hunter2", "https://"]) {
    assert.equal(row.lastError!.includes(secret), false, `lastError must not contain ${secret}`);
    assert.equal(result.error?.includes(secret), false, `the caller error must not contain ${secret}`);
  }
  assert.ok(row.lastError!.length <= 200, "capped at 200 characters");
});

test("the subject stored is the subject only: it never carries a code or link", async () => {
  const memory = createMemoryStore();
  const { deps } = makePipelineDeps({ memory, transport: scriptedTransport([{ ok: true }]).send });
  await createEmailPipeline(deps).sendTemplate("verification-code", RAW_ADDRESS, { purpose: "LOGIN", code: CODE }, { userId: "user-1" });
  const [row] = [...memory.rows.values()];
  assert.equal(row.subject.includes(CODE), false);
  assert.equal(row.subject, "Your sign-in code");
});
