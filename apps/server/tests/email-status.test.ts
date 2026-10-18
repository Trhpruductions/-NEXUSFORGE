import "./helpers/email-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  classifySendError,
  isUndeliverableAddress,
  maskRecipient,
  MAX_SEND_RETRIES,
  planEmailTransition,
  recipientHash,
  redactErrorText,
  retryDelayMs,
  type EmailStatus,
} from "../src/lib/email-status.js";

const ALL: EmailStatus[] = ["QUEUED", "ACCEPTED", "DELIVERED", "BOUNCED", "COMPLAINED", "FAILED", "UNKNOWN"];

test("the pipeline may record QUEUED, ACCEPTED, FAILED and UNKNOWN, and nothing else", () => {
  assert.equal(planEmailTransition("QUEUED", "ACCEPTED", "pipeline").ok, true);
  assert.equal(planEmailTransition("QUEUED", "FAILED", "pipeline").ok, true);
  assert.equal(planEmailTransition("ACCEPTED", "UNKNOWN", "pipeline").ok, true);
  for (const target of ["DELIVERED", "BOUNCED", "COMPLAINED"] as const) {
    for (const from of ALL) {
      const plan = planEmailTransition(from, target, "pipeline");
      assert.equal(plan.ok, false, `pipeline must not set ${target} (from ${from})`);
    }
  }
});

test("only a webhook may set DELIVERED, BOUNCED or COMPLAINED", () => {
  assert.deepEqual(planEmailTransition("ACCEPTED", "DELIVERED", "webhook"), { ok: true, changed: true });
  assert.deepEqual(planEmailTransition("DELIVERED", "COMPLAINED", "webhook"), { ok: true, changed: true });
  assert.equal(planEmailTransition("ACCEPTED", "BOUNCED", "webhook").ok, true);
  assert.equal(planEmailTransition("ACCEPTED", "DELIVERED", "pipeline").ok, false);
});

test("the webhook may not set pipeline-only statuses", () => {
  assert.equal(planEmailTransition("QUEUED", "ACCEPTED", "webhook").ok, false);
  assert.equal(planEmailTransition("ACCEPTED", "QUEUED", "webhook").ok, false);
  assert.equal(planEmailTransition("ACCEPTED", "UNKNOWN", "webhook").ok, false);
});

test("a delivered message cannot become bounced, and a bounce cannot become delivered", () => {
  assert.equal(planEmailTransition("DELIVERED", "BOUNCED", "webhook").ok, false);
  assert.equal(planEmailTransition("BOUNCED", "DELIVERED", "webhook").ok, false);
});

test("terminal statuses never move", () => {
  for (const terminal of ["BOUNCED", "COMPLAINED", "FAILED"] as const) {
    for (const to of ALL) {
      if (to === terminal) continue;
      const actor = to === "QUEUED" || to === "ACCEPTED" || to === "UNKNOWN" ? "pipeline" : "webhook";
      assert.equal(planEmailTransition(terminal, to, actor).ok, false, `${terminal} -> ${to} must be refused`);
    }
  }
});

test("a repeated status is a no-op, so repeated events are harmless", () => {
  assert.deepEqual(planEmailTransition("DELIVERED", "DELIVERED", "webhook"), { ok: true, changed: false });
  assert.deepEqual(planEmailTransition("FAILED", "FAILED", "webhook"), { ok: true, changed: false });
});

test("a message that was never accepted cannot jump straight to a provider success", () => {
  assert.equal(planEmailTransition("FAILED", "DELIVERED", "webhook").ok, false);
  assert.equal(planEmailTransition("QUEUED", "DELIVERED", "webhook").ok, true, "a delivery report implies SMTP accepted it");
});

test("UNKNOWN can be resolved by a later provider event", () => {
  assert.equal(planEmailTransition("UNKNOWN", "DELIVERED", "webhook").ok, true);
  assert.equal(planEmailTransition("UNKNOWN", "BOUNCED", "webhook").ok, true);
});

test("redaction removes links, addresses, tokens and codes, and caps the length", () => {
  const raw = "Rejected https://nexus.example.org/reset-password?token=AbCdEfGhIjKlMnOpQrStUvWx for sam@example.net code 482913 secret=hunter2";
  const redacted = redactErrorText(raw) ?? "";
  assert.ok(!/https?:\/\//.test(redacted), "no URL");
  assert.ok(!redacted.includes("AbCdEfGh"), "no token");
  assert.ok(!redacted.includes("sam@example.net"), "no address");
  assert.ok(!redacted.includes("482913"), "no code");
  assert.ok(!redacted.includes("hunter2"), "no secret value");
  assert.match(redacted, /\[link\]/);
  assert.match(redacted, /\[address\]/);

  const long = redactErrorText("plain words repeat ".repeat(40));
  assert.equal(long?.length, 200);
  assert.equal(redactErrorText("   "), null);
  assert.equal(redactErrorText(undefined), null);
  assert.equal(redactErrorText(new Error("550 no such user")), "550 no such user");
});

test("recipients are shown masked and hashed, never as the full address", () => {
  const masked = maskRecipient("Samantha.Hart@Example.org");
  assert.ok(masked.startsWith("sa"), "first two letters kept");
  assert.ok(masked.endsWith("@example.org"), "domain kept, lower-cased");
  assert.ok(!masked.includes("samantha"), "local part hidden");
  assert.equal(maskRecipient("not-an-address"), "[invalid]");

  const hash = recipientHash("  Sam@Nexus.example.org ");
  assert.equal(hash, createHash("sha256").update("sam@nexus.example.org").digest("hex"));
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("reserved test domains are never sent", () => {
  assert.equal(isUndeliverableAddress("a@something.test"), true);
  assert.equal(isUndeliverableAddress("a@example.com"), true);
  assert.equal(isUndeliverableAddress("a@nfgcord.com"), false);
});

test("4xx SMTP replies and connection problems are transient, 5xx and bad logins are not", () => {
  assert.equal(classifySendError({ responseCode: 421 }), "transient");
  assert.equal(classifySendError({ responseCode: 451 }), "transient");
  assert.equal(classifySendError({ code: "ECONNRESET" }), "transient");
  assert.equal(classifySendError({ code: "ETIMEDOUT" }), "transient");
  assert.equal(classifySendError(new Error("socket hang up")), "transient");
  assert.equal(classifySendError(new Error("Connection timeout")), "transient");

  assert.equal(classifySendError({ responseCode: 550 }), "permanent");
  assert.equal(classifySendError({ responseCode: 535 }), "permanent");
  assert.equal(classifySendError({ code: "EAUTH" }), "permanent");
  assert.equal(classifySendError({ code: "EENVELOPE" }), "permanent");
  assert.equal(classifySendError(new Error("something unexpected")), "permanent");
});

test("at most two retries, with backoff", () => {
  assert.equal(MAX_SEND_RETRIES, 2);
  assert.equal(retryDelayMs(0), 1_000);
  assert.equal(retryDelayMs(1), 3_000);
  assert.equal(retryDelayMs(9), 3_000);
});
