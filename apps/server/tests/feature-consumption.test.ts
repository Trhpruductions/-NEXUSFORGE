import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after } from "node:test";
import { prisma } from "../src/lib/prisma.js";
import { consumeFeatureQuantity } from "../src/lib/feature-consumption.js";

// Runs against the isolated test database only (the test runner sets DATABASE_URL to nexusforge_test).
// Every user created here is removed at the end, which also removes their entitlements.

const RUN = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const createdUserIds: string[] = [];

async function makeUser(label: string) {
  const id = randomUUID();
  createdUserIds.push(id);
  await prisma.user.create({
    data: {
      id,
      username: `fc_${label}_${RUN}`.slice(0, 32),
      email: `fc_${label}_${RUN}@example.com`,
      password: "not-a-login-in-this-test",
      birthdate: new Date("1990-01-01"),
    },
  });
  return id;
}

async function grant(userId: string, featureCode: "FORGE_BOOST_PACK" | "CREATOR_CAMPAIGN_SLOT" | "EVENT_TICKET_PASS", fields: { quantity: number; active?: boolean; expiresAt?: Date | null }) {
  await prisma.featureEntitlement.create({
    data: { userId, featureCode, source: "STRIPE", active: fields.active ?? true, quantity: fields.quantity, expiresAt: fields.expiresAt ?? null },
  });
}

async function quantityOf(userId: string, featureCode: "FORGE_BOOST_PACK" | "CREATOR_CAMPAIGN_SLOT" | "EVENT_TICKET_PASS") {
  const row = await prisma.featureEntitlement.findUnique({ where: { userId_featureCode: { userId, featureCode } }, select: { quantity: true } });
  return row?.quantity ?? null;
}

after(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

test("consuming units lowers the stored quantity and reports what is left", async () => {
  const user = await makeUser("basic");
  await grant(user, "FORGE_BOOST_PACK", { quantity: 5 });

  const result = await consumeFeatureQuantity(user, "FORGE_BOOST_PACK", 2);

  assert.deepEqual(result, { consumed: 2, remaining: 3 });
  assert.equal(await quantityOf(user, "FORGE_BOOST_PACK"), 3);
});

test("a request for more units than remain is refused and leaves the balance untouched", async () => {
  const user = await makeUser("insufficient");
  await grant(user, "CREATOR_CAMPAIGN_SLOT", { quantity: 1 });

  const result = await consumeFeatureQuantity(user, "CREATOR_CAMPAIGN_SLOT", 2);

  assert.equal(result, null);
  assert.equal(await quantityOf(user, "CREATOR_CAMPAIGN_SLOT"), 1);
});

test("the last unit can be used once, and the next attempt is refused", async () => {
  const user = await makeUser("exhaust");
  await grant(user, "EVENT_TICKET_PASS", { quantity: 1 });

  const first = await consumeFeatureQuantity(user, "EVENT_TICKET_PASS", 1);
  const second = await consumeFeatureQuantity(user, "EVENT_TICKET_PASS", 1);

  assert.deepEqual(first, { consumed: 1, remaining: 0 });
  assert.equal(second, null);
  assert.equal(await quantityOf(user, "EVENT_TICKET_PASS"), 0);
});

test("simultaneous requests cannot use more units than exist", async () => {
  const user = await makeUser("concurrent");
  await grant(user, "FORGE_BOOST_PACK", { quantity: 3 });

  const results = await Promise.all(Array.from({ length: 10 }, () => consumeFeatureQuantity(user, "FORGE_BOOST_PACK", 1)));

  const accepted = results.filter((r) => r !== null);
  assert.equal(accepted.length, 3);
  assert.equal(await quantityOf(user, "FORGE_BOOST_PACK"), 0);
});

test("an expired entitlement cannot be consumed", async () => {
  const user = await makeUser("expired");
  await grant(user, "FORGE_BOOST_PACK", { quantity: 4, expiresAt: new Date(Date.now() - 60_000) });

  const result = await consumeFeatureQuantity(user, "FORGE_BOOST_PACK", 1);

  assert.equal(result, null);
  assert.equal(await quantityOf(user, "FORGE_BOOST_PACK"), 4);
});

test("an entitlement that is not active cannot be consumed", async () => {
  const user = await makeUser("inactive");
  await grant(user, "FORGE_BOOST_PACK", { quantity: 4, active: false });

  const result = await consumeFeatureQuantity(user, "FORGE_BOOST_PACK", 1);

  assert.equal(result, null);
  assert.equal(await quantityOf(user, "FORGE_BOOST_PACK"), 4);
});

test("a user who never bought the add-on gets nothing, not a free unit", async () => {
  const user = await makeUser("nobuy");

  const result = await consumeFeatureQuantity(user, "EVENT_TICKET_PASS", 1);

  assert.equal(result, null);
  assert.equal(await quantityOf(user, "EVENT_TICKET_PASS"), null);
});

test("quantities that are not whole positive numbers are refused without touching the balance", async () => {
  const user = await makeUser("badqty");
  await grant(user, "FORGE_BOOST_PACK", { quantity: 5 });

  for (const bad of [0, -1, 1.5, Number.NaN]) {
    assert.equal(await consumeFeatureQuantity(user, "FORGE_BOOST_PACK", bad), null, `quantity ${bad}`);
  }
  assert.equal(await quantityOf(user, "FORGE_BOOST_PACK"), 5);
});

test("consuming one add-on does not change another add-on the user holds", async () => {
  const user = await makeUser("isolated");
  await grant(user, "FORGE_BOOST_PACK", { quantity: 2 });
  await grant(user, "CREATOR_CAMPAIGN_SLOT", { quantity: 7 });

  await consumeFeatureQuantity(user, "FORGE_BOOST_PACK", 1);

  assert.equal(await quantityOf(user, "FORGE_BOOST_PACK"), 1);
  assert.equal(await quantityOf(user, "CREATOR_CAMPAIGN_SLOT"), 7);
});
