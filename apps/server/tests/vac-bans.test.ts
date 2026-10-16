import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before } from "node:test";
import { prisma } from "../src/lib/prisma.js";
import { hashPassword } from "../src/lib/password.js";
import { cachedSuspension, currentSuspension, liftSuspension, resetSuspensionCacheForTests } from "../src/lib/account-suspension.js";
import { confirmVacBan, considerAutomaticBan, issueVacBan, listVacBans, submitVacAppeal } from "../src/lib/vac-bans.js";

// Runs against the isolated test database only (the test runner sets DATABASE_URL to nexusforge_test).
// Every user created here is removed at the end.

const RUN = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const createdUserIds: string[] = [];

async function makeUser(label: string, options: { appRole?: string; password?: string } = {}) {
  const id = randomUUID();
  createdUserIds.push(id);
  await prisma.user.create({
    data: {
      id,
      username: `vac_${label}_${RUN}`.slice(0, 32),
      email: `vac_${label}_${RUN}@example.com`,
      password: await hashPassword(options.password ?? "Test-pass-vac-2026"),
      birthdate: new Date("1990-01-01"),
      ...(options.appRole ? { appRole: options.appRole as never } : {}),
    },
  });
  return id;
}

/** An upheld report: a platform staff member resolved it as RESOLVED against the author. */
async function upheldReport(args: { authorId: string; reason: string; handledById: string; handledAt?: Date; status?: string }) {
  const reporterId = createdUserIds[0];
  await prisma.messageReport.create({
    data: {
      reporterId,
      kind: "CHANNEL",
      messageId: randomUUID(),
      authorId: args.authorId,
      authorUsername: "reported",
      contentSnapshot: "test content",
      reason: args.reason,
      status: args.status ?? "RESOLVED",
      handledById: args.handledById,
      handledAt: args.handledAt ?? new Date(),
    },
  });
}

before(async () => {
  resetSuspensionCacheForTests();
});

after(async () => {
  await prisma.messageReport.deleteMany({ where: { OR: [{ authorId: { in: createdUserIds } }, { reporterId: { in: createdUserIds } }] } });
  await prisma.accountSuspension.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

test("a staff VAC ban is enforced like a suspension: it is in force, cached, and lists for staff", async () => {
  const mod = await makeUser("mod_a", { appRole: "MODERATOR" });
  const member = await makeUser("member_a");
  const entry = await issueVacBan({ actorId: mod, userId: member, category: "SCAM", days: 7, reason: "Scam links", evidence: "Two posts.", automatic: false });
  assert.ok(entry);
  const current = await currentSuspension(member);
  assert.equal(current?.kind, "VAC");
  assert.equal(current?.category, "SCAM");
  assert.equal(cachedSuspension(member)?.kind, "VAC");

  const rows = await listVacBans();
  const row = rows.find((ban) => ban.userId === member);
  assert.ok(row, "the ban is in the staff list");
  assert.equal(row.source, "STAFF");
  assert.equal(row.needsReview, false);
  assert.equal(row.evidence, "Two posts.");

  assert.equal(await liftSuspension({ actorId: mod, userId: member, note: "test cleanup" }), true);
  assert.equal(await currentSuspension(member), null);
});

test("two upheld reports do not ban; the third does, for one day, and waits for staff review", async () => {
  const mod = await makeUser("mod_b", { appRole: "MODERATOR" });
  const member = await makeUser("member_b");
  await upheldReport({ authorId: member, reason: "SCAM", handledById: mod });
  await upheldReport({ authorId: member, reason: "SCAM", handledById: mod });
  assert.equal(await considerAutomaticBan({ userId: member, triggeredById: mod }), null);

  await upheldReport({ authorId: member, reason: "SPAM", handledById: mod });
  const ban = await considerAutomaticBan({ userId: member, triggeredById: mod });
  assert.ok(ban);
  const row = await prisma.accountSuspension.findFirst({ where: { userId: member, kind: "VAC" } });
  assert.equal(row?.source, "AUTO");
  assert.equal(row?.needsReview, true);
  assert.equal(row?.category, "SCAM", "the most common category wins");
  assert.ok(row?.until, "automatic bans are timed");
  const days = (row!.until!.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  assert.ok(days > 0.9 && days <= 1.01, `first automatic ban is one day, got ${days}`);
  assert.match(row?.evidence ?? "", /3 reports upheld by staff/);
});

test("reports resolved by forge moderators (not platform staff) and dismissed reports do not count", async () => {
  const mod = await makeUser("mod_c", { appRole: "MODERATOR" });
  const plainUser = await makeUser("plain_c");
  const member = await makeUser("member_c");
  for (let i = 0; i < 3; i++) await upheldReport({ authorId: member, reason: "SCAM", handledById: plainUser });
  assert.equal(await considerAutomaticBan({ userId: member, triggeredById: plainUser }), null);
  for (let i = 0; i < 3; i++) await upheldReport({ authorId: member, reason: "SCAM", handledById: mod, status: "DISMISSED" });
  assert.equal(await considerAutomaticBan({ userId: member, triggeredById: mod }), null);
  assert.equal(await currentSuspension(member), null);
});

test("staff accounts are never banned automatically", async () => {
  const mod = await makeUser("mod_d", { appRole: "MODERATOR" });
  const staffMember = await makeUser("staff_d", { appRole: "MODERATOR" });
  for (let i = 0; i < 3; i++) await upheldReport({ authorId: staffMember, reason: "HATE", handledById: mod });
  assert.equal(await considerAutomaticBan({ userId: staffMember, triggeredById: mod }), null);
});

test("escalation counts only reports handled after the last ban, so the second automatic ban is seven days", async () => {
  const mod = await makeUser("mod_e", { appRole: "MODERATOR" });
  const member = await makeUser("member_e");
  for (let i = 0; i < 3; i++) await upheldReport({ authorId: member, reason: "SPAM", handledById: mod, handledAt: new Date(Date.now() - 2 * 60 * 60 * 1000) });
  assert.ok(await considerAutomaticBan({ userId: member, triggeredById: mod }), "first ban");
  // Staff lift it. Old reports stay on record, but they no longer count toward the next ban.
  await liftSuspension({ actorId: mod, userId: member, note: "reviewed" });
  // Reports handled before the ban (already punished) do not count, and new reports do.
  for (let i = 0; i < 2; i++) await upheldReport({ authorId: member, reason: "SPAM", handledById: mod });
  assert.equal(await considerAutomaticBan({ userId: member, triggeredById: mod }), null, "two new reports are not enough");
  await upheldReport({ authorId: member, reason: "SPAM", handledById: mod });
  const second = await considerAutomaticBan({ userId: member, triggeredById: mod });
  assert.ok(second, "three new reports ban again");
  const rows = await prisma.accountSuspension.findMany({ where: { userId: member, kind: "VAC" }, orderBy: { createdAt: "asc" } });
  assert.equal(rows.length, 2);
  const days = (rows[1].until!.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  assert.ok(days > 6.9 && days <= 7.01, `second automatic ban is seven days, got ${days}`);
});

test("a banned person can appeal once, with the right password; wrong passwords and repeats record nothing", async () => {
  const mod = await makeUser("mod_f", { appRole: "MODERATOR" });
  const member = await makeUser("member_f", { password: "Right-pass-appeal-2026" });
  await issueVacBan({ actorId: mod, userId: member, category: "OTHER", days: 3, reason: "Test ban", evidence: null, automatic: false });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: member }, select: { email: true } });
  const note = "I did not do this. Please review the reports.";

  assert.deepEqual(await submitVacAppeal({ email: user.email, password: "wrong-password", note }), { sent: false });
  assert.equal((await currentSuspension(member))?.appealedAt, null);

  assert.deepEqual(await submitVacAppeal({ email: user.email, password: "Right-pass-appeal-2026", note }), { sent: true });
  assert.ok((await currentSuspension(member))?.appealedAt, "the appeal is recorded");

  assert.deepEqual(await submitVacAppeal({ email: user.email, password: "Right-pass-appeal-2026", note }), { sent: false }, "one appeal per ban");
  assert.deepEqual(await submitVacAppeal({ email: "nobody-vac@example.com", password: "x", note }), { sent: false }, "unknown account");
});

test("staff confirm an automatic ban, and the confirmation clears the review flag", async () => {
  const mod = await makeUser("mod_g", { appRole: "MODERATOR" });
  const member = await makeUser("member_g");
  for (let i = 0; i < 3; i++) await upheldReport({ authorId: member, reason: "SCAM", handledById: mod });
  await considerAutomaticBan({ userId: member, triggeredById: mod });
  const row = await prisma.accountSuspension.findFirstOrThrow({ where: { userId: member, kind: "VAC" } });
  assert.equal(await confirmVacBan(row.id), true);
  const updated = await prisma.accountSuspension.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal(updated.needsReview, false);
  assert.equal(await confirmVacBan(randomUUID()), false, "an unknown ban can't be confirmed");
});
