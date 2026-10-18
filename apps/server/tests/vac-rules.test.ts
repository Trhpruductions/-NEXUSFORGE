import test from "node:test";
import assert from "node:assert/strict";
import {
  describeSuspension,
  dominantVacCategory,
  suspendedMessage,
  suspendedResponse,
  vacAutomaticDays,
  vacCategoryForReportReason,
  VAC_AUTO_LADDER_DAYS,
  VAC_AUTO_UPHELD_REPORTS,
} from "../src/lib/account-suspension-rules.js";

const created = new Date("2026-10-01T00:00:00.000Z");
const vacUntil = new Date("2026-10-08T00:00:00.000Z");

test("automatic VAC bans climb 1, 7, then 30 days, and never go permanent", () => {
  assert.deepEqual([...VAC_AUTO_LADDER_DAYS], [1, 7, 30]);
  assert.equal(vacAutomaticDays(0), 1);
  assert.equal(vacAutomaticDays(1), 7);
  assert.equal(vacAutomaticDays(2), 30);
  assert.equal(vacAutomaticDays(9), 30);
  assert.equal(vacAutomaticDays(-3), 1);
});

test("the automatic threshold is three upheld reports", () => {
  assert.equal(VAC_AUTO_UPHELD_REPORTS, 3);
});

test("report reasons map to VAC categories, and unknown reasons fall back to OTHER", () => {
  assert.equal(vacCategoryForReportReason("SCAM"), "SCAM");
  assert.equal(vacCategoryForReportReason("SPAM"), "SPAM");
  for (const reason of ["HARASSMENT", "HATE", "SEXUAL", "VIOLENCE", "SELF_HARM"]) {
    assert.equal(vacCategoryForReportReason(reason), "HARASSMENT", reason);
  }
  assert.equal(vacCategoryForReportReason("OTHER"), "OTHER");
  assert.equal(vacCategoryForReportReason("SOMETHING_NEW"), "OTHER");
});

test("the dominant category is the most common, and ties go to the earlier category in the list", () => {
  assert.equal(dominantVacCategory([]), "OTHER");
  assert.equal(dominantVacCategory(["SPAM", "SPAM", "SCAM"]), "SPAM");
  assert.equal(dominantVacCategory(["SCAM", "SPAM"]), "SCAM");
  assert.equal(dominantVacCategory(["SPAM", "SCAM"]), "SCAM");
});

test("a VAC ban tells the person it is a ban, when it ends, and that they can appeal", () => {
  const message = suspendedMessage({ id: "1", reason: "x", until: vacUntil, createdAt: created, kind: "VAC", category: "SCAM" });
  assert.match(message, /banned from Nexus Forge Gaming/);
  assert.match(message, /You can appeal this ban/);
  assert.match(message, /Oct, 2026|Oct 2026|08 Oct 2026/);
});

test("a permanent VAC ban says staff review it, not a date", () => {
  const message = suspendedMessage({ id: "1", reason: "x", until: null, createdAt: created, kind: "VAC", category: "EXPLOIT" });
  assert.match(message, /until Nexus Forge staff review it/);
});

test("staff suspensions keep their original wording", () => {
  assert.equal(suspendedMessage({ id: "1", reason: "x", until: null, createdAt: created }), "This account is suspended.");
  assert.equal(
    suspendedMessage({ id: "1", reason: "x", until: vacUntil, createdAt: created, kind: "STAFF" }),
    `This account is suspended until ${vacUntil.toUTCString()}.`,
  );
});

test("staff suspensions keep the original three fields, and VAC bans add kind, category and appeal state", () => {
  const staff = describeSuspension({ id: "1", reason: "r", until: null, createdAt: created, category: "SCAM" });
  assert.deepEqual(Object.keys(staff).sort(), ["reason", "since", "until"]);

  const vac = describeSuspension({ id: "2", reason: "r", until: vacUntil, createdAt: created, kind: "VAC", category: "SPAM", appealedAt: created });
  assert.equal(vac.kind, "VAC");
  assert.equal(vac.category, "SPAM");
  assert.equal(vac.appealed, true);
  assert.equal(vac.until, vacUntil.toISOString());
});

test("the suspended response carries the message and the public shape", () => {
  const body = suspendedResponse({ id: "3", reason: "r", until: null, createdAt: created, kind: "VAC", category: "OTHER" });
  assert.equal(typeof body.error, "string");
  assert.equal(body.suspended.kind, "VAC");
});
