import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import { applyStorePurchase } from "../src/lib/store-billing/grant.js";
import { StoreVerifyError, type VerifiedStorePurchase } from "../src/lib/store-billing/types.js";

// Runs against the isolated test database only. Refuses to run against any other database.
if (!/\/nexusforge_test$/.test(new URL(process.env.DATABASE_URL ?? "postgres://invalid/").pathname)) {
  throw new Error("store-billing-grant.test.ts must run against nexusforge_test");
}

const RUN = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const createdUserIds: string[] = [];

async function makeUser(label: string, extra: { lifetimeMember?: boolean; premiumTier?: "NONE" | "CORE" | "PLUS" | "ELITE" | "INFINITE" } = {}) {
  const id = randomUUID();
  createdUserIds.push(id);
  await prisma.user.create({
    data: {
      id,
      username: `sb_${label}_${RUN}`.slice(0, 32),
      email: `sb_${label}_${RUN}@example.com`,
      password: "not-a-login-in-this-test",
      birthdate: new Date("1990-01-01"),
      lifetimeMember: extra.lifetimeMember ?? false,
      premiumTier: extra.premiumTier ?? "NONE",
    },
  });
  return id;
}

let counter = 0;
function purchase(overrides: Partial<VerifiedStorePurchase> & { accountToken: string | null }): VerifiedStorePurchase {
  counter += 1;
  return {
    provider: "APPLE",
    productId: "nfg.coreplus.plus.monthly",
    transactionId: `T-${RUN}-${counter}`,
    originalTransactionId: null,
    environment: "SANDBOX",
    status: "ACTIVE",
    purchasedAt: new Date("2026-10-15T00:00:00Z"),
    expiresAt: new Date("2026-11-15T00:00:00Z"),
    grant: { kind: "SUBSCRIPTION", tier: "PLUS" },
    ...overrides,
  };
}

async function refusedWith(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => error instanceof StoreVerifyError && error.code === code);
}

after(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

test("an add-on purchase is granted once: a replay of the same store transaction does not add to the quantity", async () => {
  const userId = await makeUser("addon");
  const addon = purchase({
    accountToken: userId,
    productId: "nfg.addon.forge_boost_pack",
    grant: { kind: "ADDON", featureCode: "FORGE_BOOST_PACK" },
  });

  assert.equal(await applyStorePurchase({ userId, purchase: addon, receipt: "receipt-one" }), "applied");
  assert.equal(await applyStorePurchase({ userId, purchase: addon, receipt: "receipt-one" }), "duplicate");
  assert.equal(await applyStorePurchase({ userId, purchase: addon, receipt: "receipt-one" }), "duplicate");

  const entitlement = await prisma.featureEntitlement.findUnique({
    where: { userId_featureCode: { userId, featureCode: "FORGE_BOOST_PACK" } },
    select: { quantity: true, source: true, active: true },
  });
  assert.equal(entitlement?.quantity, 1);
  assert.equal(entitlement?.source, "APPLE");
  assert.equal(entitlement?.active, true);
});

test("two deliveries of the same purchase at the same moment grant it once", async () => {
  const userId = await makeUser("race");
  const addon = purchase({ accountToken: userId, productId: "nfg.addon.event_ticket_pass", grant: { kind: "ADDON", featureCode: "EVENT_TICKET_PASS" } });

  const results = await Promise.all([
    applyStorePurchase({ userId, purchase: addon, receipt: "race" }),
    applyStorePurchase({ userId, purchase: addon, receipt: "race" }),
  ]);
  assert.deepEqual(results.sort(), ["applied", "duplicate"]);

  const entitlement = await prisma.featureEntitlement.findUnique({
    where: { userId_featureCode: { userId, featureCode: "EVENT_TICKET_PASS" } },
    select: { quantity: true },
  });
  assert.equal(entitlement?.quantity, 1);
});

test("a subscription sets the user's Core+ tier and boost level, as the Stripe checkout does", async () => {
  const userId = await makeUser("sub");
  const sub = purchase({ accountToken: userId, provider: "GOOGLE", grant: { kind: "SUBSCRIPTION", tier: "ELITE" } });

  assert.equal(await applyStorePurchase({ userId, purchase: sub, receipt: "sub-receipt" }), "applied");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { premium: true, premiumTier: true, corePlusBoostLevel: true, corePlusActivatedAt: true } });
  assert.equal(user.premium, true);
  assert.equal(user.premiumTier, "ELITE");
  assert.equal(user.corePlusBoostLevel, 3);
  assert.ok(user.corePlusActivatedAt);
});

test("a lifetime member keeps their granted tier when they buy a subscription", async () => {
  const userId = await makeUser("lifetime", { lifetimeMember: true, premiumTier: "INFINITE" });
  const sub = purchase({ accountToken: userId, grant: { kind: "SUBSCRIPTION", tier: "CORE" } });

  assert.equal(await applyStorePurchase({ userId, purchase: sub, receipt: "lifetime" }), "applied");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { premiumTier: true } });
  assert.equal(user.premiumTier, "INFINITE");
});

test("a store purchase already linked to another account is refused, and the other account gets nothing", async () => {
  const owner = await makeUser("owner");
  const thief = await makeUser("thief");
  const shared = purchase({ accountToken: owner, grant: { kind: "SUBSCRIPTION", tier: "PLUS" } });
  assert.equal(await applyStorePurchase({ userId: owner, purchase: shared, receipt: "owner" }), "applied");

  await refusedWith(applyStorePurchase({ userId: thief, purchase: { ...shared, accountToken: thief }, receipt: "thief" }), "CLAIMED");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: thief }, select: { premium: true } });
  assert.equal(user.premium, false);
});

test("a purchase made under a different account's token is refused before anything is recorded", async () => {
  const userId = await makeUser("mismatch");
  const other = await makeUser("elsewhere");
  const wrongAccount = purchase({ accountToken: other, grant: { kind: "SUBSCRIPTION", tier: "PLUS" } });
  const transactionId = wrongAccount.transactionId;

  await refusedWith(applyStorePurchase({ userId, purchase: wrongAccount, receipt: "wrong" }), "ACCOUNT_MISMATCH");

  const recorded = await prisma.storePurchase.findFirst({ where: { transactionId }, select: { id: true } });
  assert.equal(recorded, null);
});

test("a purchase with no account token is refused, because it cannot be tied to anyone", async () => {
  const userId = await makeUser("untied");
  await refusedWith(applyStorePurchase({ userId, purchase: purchase({ accountToken: null }), receipt: "untied" }), "ACCOUNT_MISMATCH");
});

test("a refunded or expired purchase is not granted and is not recorded", async () => {
  const userId = await makeUser("lapsed");
  const refunded = purchase({ accountToken: userId, status: "REVOKED" });
  const expired = purchase({ accountToken: userId, status: "EXPIRED" });

  await refusedWith(applyStorePurchase({ userId, purchase: refunded, receipt: "refunded" }), "INVALID_PURCHASE");
  await refusedWith(applyStorePurchase({ userId, purchase: expired, receipt: "expired" }), "INVALID_PURCHASE");

  const count = await prisma.storePurchase.count({ where: { userId } });
  assert.equal(count, 0);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { premium: true } });
  assert.equal(user.premium, false);
});

test("the purchase record keeps the store, product, tier, environment and a hash of the receipt, not the receipt itself", async () => {
  const userId = await makeUser("record");
  const sub = purchase({ accountToken: userId, provider: "APPLE", grant: { kind: "SUBSCRIPTION", tier: "PLUS" } });
  await applyStorePurchase({ userId, purchase: sub, receipt: "the-raw-receipt" });

  const row = await prisma.storePurchase.findUniqueOrThrow({ where: { provider_transactionId: { provider: "APPLE", transactionId: sub.transactionId } } });
  assert.equal(row.productId, "nfg.coreplus.plus.monthly");
  assert.equal(row.tier, "PLUS");
  assert.equal(row.featureCode, null);
  assert.equal(row.environment, "SANDBOX");
  assert.equal(row.status, "ACTIVE");
  assert.equal(row.receiptHash.length, 64);
  assert.ok(!row.receiptHash.includes("the-raw-receipt"));
});
