import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-at-least-32-characters";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-at-least-32-characters";
const { brandedEmailHtml, senderAddress } = await import("../src/lib/email-template.js");

test("emails are branded, escaped and have clickable links", () => {
  const html = brandedEmailHtml("Reset <your> password", "Hi <b>Sam</b>,\n\nOpen https://vexora.example/reset?token=abc&x=1 to continue.");
  assert.match(html, /VEXORA/);
  assert.ok(html.includes("Reset &lt;your&gt; password"), "subject escaped");
  assert.ok(html.includes("Hi &lt;b&gt;Sam&lt;/b&gt;"), "body escaped, no HTML injection");
  assert.match(html, /<a href="https:\/\/vexora\.example\/reset\?token=abc&amp;x=1"/);
});

test("the sender name is always the app's", () => {
  const from = senderAddress();
  assert.equal(from.name, "Vexora Gaming");
  assert.ok(from.address.includes("@"));
});
