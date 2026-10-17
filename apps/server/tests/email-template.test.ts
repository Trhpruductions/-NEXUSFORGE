import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-at-least-32-characters";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-at-least-32-characters";
const { brandedEmailHtml, codeEmailHtml, senderAddress } = await import("../src/lib/email-template.js");

test("emails are branded, escaped and have clickable links", () => {
  const html = brandedEmailHtml("Reset <your> password", "Hi <b>Sam</b>,\n\nOpen https://vexora.example/reset?token=abc&x=1 to continue.");
  assert.match(html, /NEXUS FORGE/);
  assert.ok(html.includes("Reset &lt;your&gt; password"), "subject escaped");
  assert.ok(html.includes("Hi &lt;b&gt;Sam&lt;/b&gt;"), "body escaped, no HTML injection");
  assert.match(html, /<a href="https:\/\/vexora\.example\/reset\?token=abc&amp;x=1"/);
});

test("a code email shows the code in its own box, with escaped text", () => {
  const html = codeEmailHtml({ subject: "Your sign-in code", intro: "Enter <this> code.", code: "482913", footnote: "Expires in 10 minutes." });
  assert.match(html, /NEXUS FORGE/);
  assert.match(html, /letter-spacing:8px[^>]*>482913</, "the code is shown large and spaced");
  assert.ok(html.includes("Enter &lt;this&gt; code."), "intro escaped");
  assert.ok(html.includes("Expires in 10 minutes."), "footnote present");
});

test("the sender name is always the app's", () => {
  const from = senderAddress();
  assert.equal(from.name, "Nexus Forge Gaming");
  assert.ok(from.address.includes("@"));
});
