import test from "node:test";
import assert from "node:assert/strict";
import {
  canApply,
  canManageLegal,
  canPublishLegal,
  defaultConsentText,
  findPlaceholders,
  missingSignupAcceptances,
  nextStatus,
  pendingConsents,
  type CurrentRequired,
} from "../src/lib/legal-rules.js";
import { termsSeedContent } from "../src/lib/legal-content.js";

const terms = (overrides: Partial<CurrentRequired> = {}): CurrentRequired => ({
  policyId: "p-terms",
  slug: "terms",
  title: "Terms of Service",
  versionId: "terms-v2",
  version: 2,
  requiresConsent: false,
  consentText: defaultConsentText("Terms of Service", 2),
  ...overrides,
});

test("only drafts can be edited; published and archived history is frozen", () => {
  assert.equal(canApply("edit", "DRAFT"), true);
  for (const status of ["IN_REVIEW", "PUBLISHED", "ARCHIVED"]) assert.equal(canApply("edit", status), false, status);
});

test("publishing requires a review step first", () => {
  assert.equal(canApply("publish", "DRAFT"), false);
  assert.equal(canApply("publish", "IN_REVIEW"), true);
  assert.equal(canApply("publish", "PUBLISHED"), false);
  assert.equal(canApply("publish", "ARCHIVED"), false);
  assert.equal(nextStatus("submit"), "IN_REVIEW");
  assert.equal(nextStatus("return"), "DRAFT");
  assert.equal(nextStatus("publish"), "PUBLISHED");
});

test("restore works from published or archived versions and never changes their status", () => {
  assert.equal(canApply("restore", "ARCHIVED"), true);
  assert.equal(canApply("restore", "PUBLISHED"), true);
  assert.equal(canApply("restore", "DRAFT"), false);
  assert.equal(nextStatus("restore"), null);
});

test("placeholders are found, markdown links are not", () => {
  const found = findPlaceholders("Operated by [Legal Operator Name]. See [our site](https://example.com). Email [Official Support Email].");
  assert.deepEqual(found.sort(), ["[Legal Operator Name]", "[Official Support Email]"]);
  assert.deepEqual(findPlaceholders("Nothing to fill in here."), []);
});

test("the seeded Terms can't be published until the placeholders are filled", () => {
  const found = findPlaceholders(termsSeedContent);
  for (const expected of ["[Launch Date]", "[Legal Operator Name]", "[Official Support Email]", "[Official Website URL]"]) {
    assert.ok(found.includes(expected), expected);
  }
  assert.ok(!termsSeedContent.includes("Retreats"), "uses the app's own name");
});

test("a user who never accepted must accept the current version", () => {
  assert.deepEqual(pendingConsents([terms()], []).map((p) => p.versionId), ["terms-v2"]);
});

test("a minor update doesn't interrupt someone who accepted an earlier version", () => {
  assert.deepEqual(pendingConsents([terms({ requiresConsent: false })], [{ policyVersionId: "terms-v1", policySlug: "terms" }]), []);
});

test("a material update needs renewed consent, recorded separately", () => {
  const pending = pendingConsents([terms({ requiresConsent: true })], [{ policyVersionId: "terms-v1", policySlug: "terms" }]);
  assert.deepEqual(pending.map((p) => p.versionId), ["terms-v2"]);
  // Once v2 itself is accepted, nothing is pending (v1's record stays as history).
  assert.deepEqual(pendingConsents([terms({ requiresConsent: true })], [{ policyVersionId: "terms-v1", policySlug: "terms" }, { policyVersionId: "terms-v2", policySlug: "terms" }]), []);
});

test("sign-up must accept every required policy by exact version", () => {
  const required = [{ versionId: "terms-v2", slug: "terms" }, { versionId: "privacy-v1", slug: "privacy" }];
  assert.deepEqual(missingSignupAcceptances(required, []), ["terms", "privacy"]);
  assert.deepEqual(missingSignupAcceptances(required, ["terms-v1", "privacy-v1"]), ["terms"], "an outdated version doesn't count");
  assert.deepEqual(missingSignupAcceptances(required, ["terms-v2", "privacy-v1"]), []);
  assert.deepEqual(missingSignupAcceptances([], []), [], "nothing published means nothing to accept");
});

test("legal admin access is decided by role, not by the page", () => {
  assert.equal(canManageLegal({ isAdmin: false, appRole: "USER" }), false);
  assert.equal(canManageLegal({ isAdmin: false, appRole: "MODERATOR" }), false);
  assert.equal(canManageLegal({ isAdmin: false, appRole: "ADMIN" }), true);
  assert.equal(canPublishLegal({ isAdmin: false, appRole: "ADMIN" }), false, "admins draft, owners/executives publish");
  assert.equal(canPublishLegal({ isAdmin: false, appRole: "OWNER" }), true);
  assert.equal(canPublishLegal({ isAdmin: false, appRole: "EXEC" }), true);
});
