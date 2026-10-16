import "./helpers/email-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { EMAIL_KINDS, TEMPLATE_CATEGORY, type EmailKind } from "../src/lib/email-policy.js";
import { renderCodeEmail, renderEmail, renderSample, sampleData, templateCatalog, type EmailContext } from "../src/lib/email-templates.js";
import { TEST_CONTEXT } from "./helpers/email-fakes.js";

const UNSUB = "https://api.example.org/api/email/unsubscribe?token=signed-token-value";
const FULL_CONTEXT: EmailContext = {
  appUrl: "https://nexus.example.org",
  supportEmail: "support@nexus.example.org",
  securityEmail: "security@nexus.example.org",
  updatesEmail: "updates@nexus.example.org",
  logoUrl: "https://nexus.example.org/brand/nexusforge-main-logo.png",
};

/** Renders a kind with the placeholder data, adding the unsubscribe link only where the kind is optional. */
function render(kind: EmailKind, ctx: EmailContext = TEST_CONTEXT) {
  const options = TEMPLATE_CATEGORY[kind] === "OPTIONAL" ? { unsubscribeUrl: UNSUB } : {};
  return renderEmail(kind, sampleData(ctx)[kind] as never, ctx, options);
}

test("every kind renders a subject, a plain-text part and an HTML part", () => {
  for (const kind of EMAIL_KINDS) {
    const rendered = render(kind);
    assert.ok(rendered.subject.length > 0, `${kind} has a subject`);
    assert.ok(rendered.text.trim().length > 0, `${kind} has text`);
    assert.match(rendered.html, /^<!doctype html>/, `${kind} has an HTML document`);
    assert.ok(rendered.subject.length <= 150, `${kind} subject is capped`);
  }
});

test("the catalog lists every kind with its category and opt-in key", () => {
  const catalog = templateCatalog();
  assert.equal(catalog.length, EMAIL_KINDS.length);
  const byKind = Object.fromEntries(catalog.map((entry) => [entry.kind, entry]));
  assert.equal(byKind.welcome.category, "ESSENTIAL");
  assert.equal(byKind["product-announcement"].category, "OPTIONAL");
  assert.equal(byKind["product-announcement"].optInKey, "announcements");
  assert.equal(byKind["release-notes"].optInKey, "releaseNotes");
  assert.equal(byKind["password-reset"].optInKey, null);
});

test("unsubscribe links appear only in OPTIONAL mail, in both the text and the HTML", () => {
  const optional = render("product-announcement");
  assert.match(optional.html, /unsubscribe/i);
  assert.match(optional.text, /Unsubscribe from these emails/);
  assert.ok(optional.text.includes(UNSUB), "the signed link is in the text");
  assert.ok(optional.html.includes(UNSUB), "the signed link is in the HTML");

  for (const kind of EMAIL_KINDS.filter((entry) => TEMPLATE_CATEGORY[entry] === "ESSENTIAL")) {
    const rendered = render(kind);
    assert.doesNotMatch(rendered.text, /unsubscribe/i, `${kind} (essential) has no unsubscribe text`);
    assert.doesNotMatch(rendered.html, /unsubscribe/i, `${kind} (essential) has no unsubscribe link`);
  }
});

test("optional mail without its unsubscribe link is refused", () => {
  assert.throws(() => renderEmail("release-notes", { version: "1.0.15", highlights: ["x"] }, TEST_CONTEXT, {}), /unsubscribe link/);
});

test("user-supplied text is escaped in the HTML version", () => {
  const rendered = renderEmail(
    "service-notice",
    { username: "<img src=x onerror=alert(1)>", title: "<script>alert(1)</script> notice", body: "Hello <b>friend</b> & \"quotes\"" },
    TEST_CONTEXT,
  );
  assert.ok(!rendered.html.includes("<img src=x"), "username is not live HTML");
  assert.ok(rendered.html.includes("&lt;img src=x onerror=alert(1)&gt;"), "username shown as text");
  assert.ok(!rendered.html.includes("<script>alert(1)</script>"), "title is not live HTML");
  assert.ok(rendered.html.includes("&lt;b&gt;friend&lt;/b&gt;"), "body is escaped");
  assert.ok(rendered.html.includes("&amp;"), "ampersands escaped");
  assert.ok(rendered.text.includes("Hello <b>friend</b>"), "the text version keeps the words as written");
});

test("a subject is one line: line breaks in a title are removed", () => {
  const rendered = renderEmail("product-announcement", { title: "Big news\r\nBcc: victim@example.org", body: "Hi", link: undefined }, TEST_CONTEXT, { unsubscribeUrl: UNSUB });
  assert.ok(!/[\r\n]/.test(rendered.subject), "no line breaks in the subject");
});

test("an optional link that is not http(s) is dropped, not rendered", () => {
  const rendered = renderEmail("product-announcement", { title: "New", body: "Read it", link: "javascript:alert(1)" }, TEST_CONTEXT, { unsubscribeUrl: UNSUB });
  assert.ok(!rendered.html.includes("javascript:"), "no javascript link in HTML");
  assert.ok(!rendered.text.includes("javascript:"), "no javascript link in text");
});

test("a required action link must be http(s), or rendering fails", () => {
  assert.throws(() => renderEmail("password-reset", { link: "javascript:void(0)", expiresIn: "30 minutes" }, TEST_CONTEXT), /http or https/);
});

test("the password reset template carries a single primary link and its expiry", () => {
  const rendered = renderEmail("password-reset", { username: "Sam", link: "https://nexus.example.org/reset-password?token=abc123", expiresIn: "30 minutes" }, TEST_CONTEXT);
  assert.match(rendered.text, /Choose a new password: https:\/\/nexus\.example\.org\/reset-password\?token=abc123/);
  assert.match(rendered.text, /expires in 30 minutes/);
  assert.match(rendered.html, /<a href="https:\/\/nexus\.example\.org\/reset-password\?token=abc123"/);
  assert.match(rendered.html, /expires in 30 minutes/);
});

test("verification codes show the code in the text and in its own box in the HTML", () => {
  const { kind, rendered } = renderCodeEmail("LOGIN", "482913", TEST_CONTEXT);
  assert.equal(kind, "verification-code");
  assert.match(rendered.text, /Your code: 482913/);
  assert.match(rendered.html, /letter-spacing:8px[^>]*>482913</);
  assert.match(rendered.text, /expires in 10 minutes/);
});

test("a code for changing the email is sent as the email-change template", () => {
  const { kind, rendered } = renderCodeEmail("CHANGE_EMAIL", "111222", TEST_CONTEXT);
  assert.equal(kind, "email-change-requested");
  assert.match(rendered.subject, /new email address/);
  assert.match(rendered.text, /Your code: 111222/);
});

test("the footer shows only the contacts that are configured", () => {
  const bare = renderEmail("service-notice", { title: "Notice", body: "Body" }, TEST_CONTEXT);
  assert.doesNotMatch(bare.text, /support@|security@|updates@/);
  assert.doesNotMatch(bare.html, /support@|security@|updates@/);

  const full = renderEmail("password-changed", { username: "Sam", when: "today" }, FULL_CONTEXT);
  assert.match(full.text, /Contact support: support@nexus\.example\.org/);
  assert.match(full.text, /Report account security problems: security@nexus\.example\.org/);
  assert.doesNotMatch(full.text, /updates@/, "updates address is not shown on essential mail");

  const optional = renderEmail("release-notes", { version: "1.0.15", highlights: ["a"] }, FULL_CONTEXT, { unsubscribeUrl: UNSUB });
  assert.match(optional.text, /Questions about these updates: updates@nexus\.example\.org/);
});

test("the footer links to privacy, terms and support, built from the app's web address", () => {
  const rendered = renderEmail("welcome", { username: "Sam" }, TEST_CONTEXT);
  assert.match(rendered.text, /https:\/\/nexus\.example\.org\/privacy/);
  assert.match(rendered.text, /https:\/\/nexus\.example\.org\/terms/);
  assert.match(rendered.text, /https:\/\/nexus\.example\.org\/support/);
  assert.match(rendered.html, /href="https:\/\/nexus\.example\.org\/privacy"/);
});

test("without a logo file the header is the text wordmark; with a logo it is an image", () => {
  const text = renderEmail("welcome", { username: "Sam" }, { ...TEST_CONTEXT, logoUrl: null });
  assert.match(text.html, /NEXUS FORGE/);
  assert.doesNotMatch(text.html, /<img /);

  const withLogo = renderEmail("welcome", { username: "Sam" }, FULL_CONTEXT);
  assert.match(withLogo.html, /<img src="https:\/\/nexus\.example\.org\/brand\/nexusforge-main-logo\.png"/);
});

test("the release notes list is escaped and capped", () => {
  const highlights = Array.from({ length: 30 }, (_, index) => `<i>${index}</i>`);
  const rendered = renderEmail("release-notes", { version: "2.0.0", highlights }, TEST_CONTEXT, { unsubscribeUrl: UNSUB });
  assert.ok(!rendered.html.includes("<i>0</i>"), "items are escaped");
  assert.ok(rendered.html.includes("&lt;i&gt;0&lt;/i&gt;"));
  assert.ok(!rendered.text.includes("- <i>20</i>"), "list is capped at 20 items");
});

test("the sample used by the admin preview contains placeholder data only", () => {
  const sample = sampleData(TEST_CONTEXT);
  assert.equal(sample["verification-code"].code, "123456");
  for (const kind of EMAIL_KINDS) {
    const preview = renderSample(kind, TEST_CONTEXT);
    assert.ok(preview.subject && preview.html, `${kind} previews`);
  }
});
