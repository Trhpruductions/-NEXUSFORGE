import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { signAccessToken } from "../src/lib/jwt.js";
import { prisma } from "../src/lib/prisma.js";
import { pushConfigured } from "../src/lib/push.js";
import { authRouter } from "../src/routes/auth.routes.js";
import { pushSubscriptionGuard, TEST_PUSH_LIMIT } from "../src/middleware/push-subscription-guard.js";
import { assertNotLiveDatabase } from "./helpers/live-database-guard.js";

// The push-subscription routes (auth.routes.ts) behind the guard, mounted the way index.ts mounts them.
// Writes one user and its push subscriptions (removed afterwards), so it must never run against the live database.
assertNotLiveDatabase();

const RUN = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const userId = randomUUID();

const app = express();
app.use(express.json());
app.use("/api/auth/push-subscriptions", ...pushSubscriptionGuard);
app.use("/api/auth", authRouter);
const server = app.listen(0, "127.0.0.1");
let token = "";

before(async () => {
  await once(server, "listening");
  await prisma.user.create({
    data: {
      id: userId,
      username: `ps_${RUN}`.slice(0, 32),
      email: `ps_${RUN}@example.com`,
      password: "not-a-login-in-this-test",
      birthdate: new Date("1990-01-01"),
    },
  });
  token = signAccessToken({ sub: userId, username: `ps_${RUN}`.slice(0, 32), email: `ps_${RUN}@example.com`, jti: randomUUID() });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

function url(path: string): string {
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}${path}`;
}

async function send(method: string, path: string, body?: unknown, auth = true) {
  const response = await fetch(url(path), {
    method,
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json().catch(() => null)) as Record<string, unknown> | null };
}

const fcm = (n: number) => `https://fcm.googleapis.com/fcm/send/${RUN}-${n}`;
const subscription = (endpoint: string) => ({ endpoint, p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg", deviceName: "Test" });
const stored = () => prisma.pushSubscription.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { endpoint: true } });

test("signed-out requests are refused before anything else", async () => {
  const response = await send("POST", "/api/auth/push-subscriptions", subscription(fcm(0)), false);
  assert.equal(response.status, 401);
});

test("a subscription that doesn't point at a browser push service is refused and not stored", async () => {
  for (const endpoint of ["https://127.0.0.1:4001/api/admin", "http://fcm.googleapis.com/fcm/send/x", "https://example.com/hook"]) {
    const response = await send("POST", "/api/auth/push-subscriptions", subscription(endpoint));
    assert.equal(response.status, 400, endpoint);
    assert.equal(response.body?.code, "PUSH_ENDPOINT_NOT_ALLOWED");
  }
  assert.equal((await stored()).length, 0);
});

test("an account keeps at most 10 devices; registering more drops the oldest", async () => {
  for (let n = 1; n <= 12; n++) {
    const response = await send("POST", "/api/auth/push-subscriptions", subscription(fcm(n)));
    assert.equal(response.status, 201, `device ${n}`);
    await new Promise((resolve) => setTimeout(resolve, 5)); // distinct timestamps, so "oldest" is well defined
  }
  const endpoints = (await stored()).map((row) => row.endpoint);
  assert.equal(endpoints.length, 10);
  assert.ok(!endpoints.includes(fcm(1)) && !endpoints.includes(fcm(2)), "the two oldest were dropped");
  assert.ok(endpoints.includes(fcm(3)) && endpoints.includes(fcm(12)));

  // Refreshing a device that is already registered doesn't push anyone else out.
  assert.equal((await send("POST", "/api/auth/push-subscriptions", subscription(fcm(3)))).status, 201);
  const after = (await stored()).map((row) => row.endpoint);
  assert.equal(after.length, 10);
  assert.ok(after.includes(fcm(4)));
});

test("an incomplete subscription is rejected by the route and doesn't drop any device", async () => {
  const before = (await stored()).length;
  const response = await send("POST", "/api/auth/push-subscriptions", { endpoint: fcm(99) });
  assert.equal(response.status, 400);
  assert.equal((await stored()).length, before);
});

test("removing a device still works through the guard", async () => {
  const response = await send("DELETE", "/api/auth/push-subscriptions", { endpoint: fcm(12) });
  assert.equal(response.status, 200);
  assert.equal(response.body?.removed, 1);
});

test("test notifications are limited per account", async (t) => {
  // With push keys set this would send real notifications to the fake endpoints above; the safe test runner blanks them.
  if (pushConfigured()) {
    t.skip("push keys are configured in this environment; not sending test notifications");
    return;
  }
  for (let n = 1; n <= TEST_PUSH_LIMIT; n++) {
    const response = await send("POST", "/api/auth/push-subscriptions/test", {});
    assert.equal(response.status, 503, `request ${n} reaches the route (push isn't configured here)`);
  }
  const limited = await send("POST", "/api/auth/push-subscriptions/test", {});
  assert.equal(limited.status, 429);
});
