import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { signAccessToken } from "../src/lib/jwt.js";
import { prisma } from "../src/lib/prisma.js";
import { LAST_SEEN_WRITE_INTERVAL_MS, requireAuth, resetLastSeenThrottleForTests, shouldWriteLastSeen } from "../src/middleware/auth.js";
import { assertNotLiveDatabase } from "./helpers/live-database-guard.js";

// Every signed-in request used to write lastSeenAt. Now it's at most once a minute per account.
// Writes one user (removed afterwards), so it must never run against the live database.
assertNotLiveDatabase();

test("lastSeenAt is written at most once a minute per account", () => {
  resetLastSeenThrottleForTests();
  const start = 1_000_000;
  assert.equal(shouldWriteLastSeen("a", start), true, "first request writes");
  assert.equal(shouldWriteLastSeen("a", start + 1_000), false);
  assert.equal(shouldWriteLastSeen("a", start + LAST_SEEN_WRITE_INTERVAL_MS - 1), false);
  assert.equal(shouldWriteLastSeen("b", start + 1_000), true, "each account has its own minute");
  assert.equal(shouldWriteLastSeen("a", start + LAST_SEEN_WRITE_INTERVAL_MS), true, "a minute later it writes again");
  assert.ok(LAST_SEEN_WRITE_INTERVAL_MS <= 60_000, "readers use a five-minute window, so this must stay well under it");
});

const RUN = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const userId = randomUUID();
const app = express();
app.get("/whoami", requireAuth, (req, res) => void res.json({ id: req.user!.id }));
const server = app.listen(0, "127.0.0.1");
let token = "";

before(async () => {
  await once(server, "listening");
  await prisma.user.create({
    data: {
      id: userId,
      username: `ls_${RUN}`.slice(0, 32),
      email: `ls_${RUN}@example.com`,
      password: "not-a-login-in-this-test",
      birthdate: new Date("1990-01-01"),
      lastSeenAt: new Date("2020-01-01T00:00:00Z"),
    },
  });
  token = signAccessToken({ sub: userId, username: `ls_${RUN}`.slice(0, 32), email: `ls_${RUN}@example.com`, jti: randomUUID() });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

async function whoami() {
  const { port } = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${port}/whoami`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200);
}

async function lastSeen() {
  return (await prisma.user.findUnique({ where: { id: userId }, select: { lastSeenAt: true } }))?.lastSeenAt ?? null;
}

async function waitFor(check: () => Promise<boolean>) {
  for (let i = 0; i < 50; i++) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return false;
}

test("a signed-in request still updates lastSeenAt, but the next ones within the minute don't", async () => {
  resetLastSeenThrottleForTests();
  await whoami();
  assert.ok(await waitFor(async () => (await lastSeen())!.getFullYear() > 2020), "the first request wrote lastSeenAt");

  // Put an old value back; the following requests in the same minute must leave it alone.
  const marker = new Date("2021-06-01T00:00:00Z");
  await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: marker } });
  await whoami();
  await whoami();
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal((await lastSeen())?.toISOString(), marker.toISOString());
});
