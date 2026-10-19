import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import { once } from "node:events";
import { randomBytes, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { signAccessToken } from "../src/lib/jwt.js";
import { prisma } from "../src/lib/prisma.js";
import { EconomyAuthority, InsufficientBalanceError } from "../src/lib/economy-authority.js";
import { MiningAuthority, RIG_PRICING } from "../src/lib/mining-authority.js";
import { buyTickets, JACKPOT_SLUG, JackpotError, ROUND_SEED, TICKET_PRICE } from "../src/lib/jackpot.js";
import { claimDaily, dailyAmountFor } from "../src/lib/rewards.js";
import { requireAge, requireAuth } from "../src/middleware/auth.js";
import economyRouter from "../src/routes/economy-routes.js";
import miningRouter from "../src/routes/mining-routes.js";
import cryptoRouter from "../src/routes/crypto.routes.js";
import { cosmeticsRouter } from "../src/routes/cosmetics.routes.js";
import { assertNotLiveDatabase } from "./helpers/live-database-guard.js";

// Coins must never be spent twice or paid twice when requests race, and every coin route needs a
// signed-in adult plus the CSRF token. Writes test users, a cosmetic item and a jackpot round (all
// removed afterwards), so it must never run against the live database.
assertNotLiveDatabase();

const RUN = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const CSRF = randomBytes(16).toString("hex");
const createdUsers: string[] = [];
let itemId = "";
let roundId = "";

// Mounted the way index.ts mounts them (crypto has no guards there; its router adds them).
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/economy", requireAuth, requireAge, economyRouter);
app.use("/api/mining", requireAuth, requireAge, miningRouter);
app.use("/api/cosmetics", requireAuth, requireAge, cosmeticsRouter);
app.use("/api/crypto", cryptoRouter);
const server = app.listen(0, "127.0.0.1");

async function makeUser(options: { coins?: bigint; adult?: boolean; admin?: boolean } = {}) {
  const id = randomUUID();
  const tag = `ec_${id.slice(0, 8)}_${RUN}`.slice(0, 32);
  await prisma.user.create({
    data: {
      id,
      username: tag,
      email: `${tag}@example.com`,
      password: "not-a-login-in-this-test",
      birthdate: new Date(options.adult === false ? "2015-01-01" : "1990-01-01"),
      ageVerified: options.adult !== false,
      ageVerificationLevel: options.adult === false ? "NONE" : "ATTESTED",
      ...(options.admin ? { appRole: "ADMIN" as const } : {}),
    },
  });
  createdUsers.push(id);
  if (options.coins !== undefined) {
    await prisma.economyAccount.create({ data: { userId: id, currencyType: "NC", balance: options.coins } });
  }
  const token = signAccessToken({ sub: id, username: tag, email: `${tag}@example.com`, jti: randomUUID() });
  return { id, token };
}

async function balanceOf(userId: string) {
  return (await prisma.economyAccount.findUnique({ where: { userId_currencyType: { userId, currencyType: "NC" } } }))?.balance ?? 0n;
}

async function call(method: string, path: string, token: string, body: unknown = {}, withCsrf = true) {
  const { port } = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(withCsrf ? { Cookie: `nf_csrf=${CSRF}`, "x-csrf-token": CSRF } : {}),
    },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json().catch(() => null)) as Record<string, unknown> | null };
}

before(async () => {
  if (!server.listening) await once(server, "listening");
  const item = await prisma.cosmeticItem.create({
    data: { key: `test-item-${RUN}`, name: `Test hat ${RUN}`.slice(0, 80), slot: "HEAD", rarity: "COMMON", priceCoins: 100 },
  });
  itemId = item.id;
  // A round of our own, numbered above every other, so buyTickets picks it as the open round.
  const top = await prisma.jackpotRound.findFirst({ where: { slug: JACKPOT_SLUG }, orderBy: { number: "desc" }, select: { number: true } });
  const round = await prisma.jackpotRound.create({
    data: {
      slug: JACKPOT_SLUG,
      number: (top?.number ?? 0) + 1000,
      ticketPrice: TICKET_PRICE,
      seedAmount: ROUND_SEED,
      pot: ROUND_SEED,
      rakeBps: 500,
      closesAt: new Date(Date.now() + 60 * 60 * 1000),
      serverSeed: "test-seed",
      serverSeedHash: "test-seed-hash",
    },
  });
  roundId = round.id;
});

after(async () => {
  // Purchases kick off achievement checks in the background; let them finish before the rows go.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (roundId) await prisma.jackpotRound.deleteMany({ where: { id: roundId } });
  if (itemId) await prisma.cosmeticItem.deleteMany({ where: { id: itemId } });
  await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
  await prisma.$disconnect();
});

test("racing debits can't overdraw an account, even outside a serializable transaction", async () => {
  const { id } = await makeUser({ coins: 250n });
  // Plain (read committed) transactions, all held open until every one has started and then let go
  // together, so the debits really overlap. Only the conditional write can stop the overdraft here:
  // the old read-then-write code let all three through and left 150 (checked by hand against it).
  const racers = 3;
  let open = 0;
  let release!: () => void;
  const allOpen = new Promise<void>((resolve) => (release = resolve));
  const results = await Promise.allSettled(
    Array.from({ length: racers }, (_, i) =>
      prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT 1`;
          open += 1;
          if (open === racers) release();
          await allOpen;
          return EconomyAuthority.applyChange(tx, { userId: id, amount: -100n, currencyType: "NC", reason: `race ${i}`, referenceId: `test-race:${id}:${i}` });
        },
        { timeout: 15_000 },
      ),
    ),
  );
  const paid = results.filter((result) => result.status === "fulfilled");
  const refused = results.filter((result) => result.status === "rejected");
  assert.equal(paid.length, 2, "250 coins pay for exactly two debits of 100");
  for (const result of refused) assert.ok((result as PromiseRejectedResult).reason instanceof InsufficientBalanceError, String((result as PromiseRejectedResult).reason));
  assert.equal(await balanceOf(id), 50n);

  // The ledger agrees with the balance, step by step.
  const rows = await prisma.economyTransaction.findMany({ where: { userId: id }, orderBy: { balanceAfter: "desc" } });
  assert.deepEqual(rows.map((row) => [row.balanceBefore, row.balanceAfter]), [[250n, 150n], [150n, 50n]]);
});

test("two rig purchases racing on enough coins for one: one rig, no negative balance", async () => {
  const { id } = await makeUser({ coins: RIG_PRICING.BASIC.cost });
  const results = await Promise.allSettled(Array.from({ length: 3 }, (_, i) => MiningAuthority.createRig({ userId: id, name: `Rig ${i}`, tier: "BASIC" })));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(await prisma.miningRig.count({ where: { userId: id } }), 1);
  assert.equal(await balanceOf(id), 0n);
});

test("two jackpot bets racing on coins for one ticket: one ticket, one charge", async () => {
  const { id } = await makeUser({ coins: TICKET_PRICE });
  const results = await Promise.allSettled([
    buyTickets({ userId: id, count: 1, idempotencyKey: randomUUID() }),
    buyTickets({ userId: id, count: 1, idempotencyKey: randomUUID() }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const refused = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
  assert.ok(refused.reason instanceof InsufficientBalanceError, String(refused.reason));
  assert.equal(await balanceOf(id), 0n);
  assert.equal(await prisma.jackpotEntry.count({ where: { roundId, userId: id } }), 1);
});

test("the same jackpot purchase sent twice at once is charged once", async () => {
  const { id } = await makeUser({ coins: TICKET_PRICE * 4n });
  const key = randomUUID();
  const results = await Promise.allSettled([buyTickets({ userId: id, count: 2, idempotencyKey: key }), buyTickets({ userId: id, count: 2, idempotencyKey: key })]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const refused = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
  assert.ok(refused.reason instanceof JackpotError && refused.reason.code === "DUPLICATE", String(refused.reason));
  assert.equal(await balanceOf(id), TICKET_PRICE * 2n);
});

test("players buying at the same moment never get overlapping ticket numbers", async () => {
  const players = await Promise.all([makeUser({ coins: 1000n }), makeUser({ coins: 1000n }), makeUser({ coins: 1000n })]);
  const before = await prisma.jackpotRound.findUniqueOrThrow({ where: { id: roundId } });
  await Promise.all(players.map((player) => buyTickets({ userId: player.id, count: 2, idempotencyKey: randomUUID() })));
  const entries = await prisma.jackpotEntry.findMany({ where: { roundId, userId: { in: players.map((player) => player.id) } }, orderBy: { firstTicket: "asc" } });
  assert.equal(entries.length, 3);
  const numbers = entries.flatMap((entry) => Array.from({ length: entry.tickets }, (_, i) => entry.firstTicket + i));
  assert.equal(new Set(numbers).size, numbers.length, `ticket numbers overlap: ${numbers.join(",")}`);
  const after = await prisma.jackpotRound.findUniqueOrThrow({ where: { id: roundId } });
  assert.equal(after.totalTickets - before.totalTickets, 6);
  assert.equal(after.pot - before.pot, TICKET_PRICE * 6n);
});

test("the daily reward claimed several times at once pays once", async () => {
  const { id } = await makeUser({ coins: 0n });
  const results = await Promise.all(Array.from({ length: 5 }, () => claimDaily(id)));
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(await balanceOf(id), dailyAmountFor(1));
  const user = await prisma.user.findUniqueOrThrow({ where: { id }, select: { dailyStreak: true, lastDailyClaimAt: true } });
  assert.equal(user.dailyStreak, 1);
  assert.ok(user.lastDailyClaimAt);
});

test("double-clicking 'claim' over HTTP pays once and never answers with a server error", async () => {
  const { id, token } = await makeUser({ coins: 0n });
  const responses = await Promise.all(Array.from({ length: 4 }, () => call("POST", "/api/economy/daily/claim", token)));
  assert.equal(responses.filter((response) => response.status === 200).length, 1);
  for (const response of responses.filter((r) => r.status !== 200)) {
    assert.equal(response.status, 400);
    assert.match(String(response.body?.error), /Already claimed/);
  }
  assert.equal(await balanceOf(id), dailyAmountFor(1));
});

test("buying the same cosmetic twice at once charges once", async () => {
  const { id, token } = await makeUser({ coins: 150n });
  const responses = await Promise.all(Array.from({ length: 3 }, () => call("POST", `/api/cosmetics/${itemId}/purchase`, token)));
  assert.equal(responses.filter((response) => response.status === 201).length, 1);
  assert.equal(await prisma.userCosmetic.count({ where: { userId: id, itemId } }), 1);
  const charges = await prisma.economyTransaction.count({ where: { userId: id, amount: -100n } });
  assert.equal(charges, 1);
  assert.ok((await balanceOf(id)) >= 0n);
});

test("coin actions need the CSRF token", async () => {
  const { token } = await makeUser({ coins: 10_000n });
  assert.equal((await call("POST", "/api/economy/daily/claim", token, {}, false)).status, 403);
  assert.equal((await call("POST", "/api/mining/rigs", token, { name: "No csrf", tier: "BASIC" }, false)).status, 403);
  assert.equal((await call("POST", "/api/crypto/swap", token, { fromSymbol: "NF_ETH", toSymbol: "FORGE", amount: "1" }, false)).status, 403);
});

test("the admin balance adjustment needs the CSRF token", async () => {
  const admin = await makeUser({ admin: true });
  const target = await makeUser({ coins: 0n });
  const refused = await call("POST", `/api/economy/${target.id}/adjust`, admin.token, { amount: "10", currencyType: "NC", reason: "test grant" }, false);
  assert.equal(refused.status, 403);
  assert.equal(await balanceOf(target.id), 0n);
  const allowed = await call("POST", `/api/economy/${target.id}/adjust`, admin.token, { amount: "10", currencyType: "NC", reason: "test grant" });
  assert.equal(allowed.status, 200);
  assert.equal(await balanceOf(target.id), 10n);
  // A debit past zero is refused with a plain message, not the internal error text.
  const overdraw = await call("POST", `/api/economy/${target.id}/adjust`, admin.token, { amount: "-50", currencyType: "NC", reason: "test take" });
  assert.equal(overdraw.status, 400);
  assert.equal(overdraw.body?.code, "INSUFFICIENT");
});

test("crypto swaps need a signed-in adult, like the other coin features", async () => {
  const minor = await makeUser({ adult: false });
  const response = await call("POST", "/api/crypto/swap", minor.token, { fromSymbol: "NF_ETH", toSymbol: "FORGE", amount: "1" });
  assert.equal(response.status, 403);
  assert.equal(response.body?.code, "AGE_REQUIRED");
  const { port } = server.address() as AddressInfo;
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/crypto/assets`)).status, 401);
});

test("coin routes answer bad input and failures with plain messages", async () => {
  const { id, token } = await makeUser({ coins: 0n });
  // Swaps: unknown asset, same asset twice, and a non-number used to come back as raw error text.
  for (const body of [
    { fromSymbol: "NOPE", toSymbol: "FORGE", amount: "1" },
    { fromSymbol: "FORGE", toSymbol: "FORGE", amount: "1" },
    { fromSymbol: "NF_ETH", toSymbol: "FORGE", amount: "abc" },
  ]) {
    const response = await call("POST", "/api/crypto/swap", token, body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.doesNotMatch(String(response.body?.error), /BigInt|Nexus Registry|prisma/i);
  }
  const broke = await call("POST", "/api/crypto/swap", token, { fromSymbol: "NF_ETH", toSymbol: "FORGE", amount: "5" });
  assert.equal(broke.status, 402);
  assert.equal(broke.body?.code, "INSUFFICIENT");

  // Mining: a bad status is the player's mistake (400), not a server error.
  const rig = await prisma.miningRig.create({ data: { userId: id, name: "Test rig", tier: "BASIC", hashRate: 10, efficiency: 0.85, status: "ACTIVE" } });
  const badStatus = await call("PATCH", `/api/mining/rigs/${rig.id}`, token, { status: "BOGUS" });
  assert.equal(badStatus.status, 400);
  const prototypeTier = await call("POST", "/api/mining/rigs", token, { name: "Proto rig", tier: "constructor" });
  assert.equal(prototypeTier.status, 400);
  const tooPoor = await call("POST", "/api/mining/rigs", token, { name: "Too poor", tier: "BASIC" });
  assert.equal(tooPoor.status, 402);
  assert.equal(tooPoor.body?.error, "Not enough Nexus Forge Coins.");
  const missing = await call("DELETE", `/api/mining/rigs/${randomUUID()}`, token);
  assert.equal(missing.status, 404);
  assert.equal(missing.body?.error, "Rig not found");
});
