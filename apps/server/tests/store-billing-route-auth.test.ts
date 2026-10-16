import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { signAccessToken } from "../src/lib/jwt.js";
import { prisma } from "../src/lib/prisma.js";
import { storeBillingRouter } from "../src/routes/store-billing.routes.js";

// Signed-in and notification behaviour of the store routes, in a test environment where no store is configured.
// Runs against the test database (the user row is removed afterwards).

if (!/\/nexusforge_test$/.test(new URL(process.env.DATABASE_URL ?? "postgres://invalid/").pathname)) {
  throw new Error("store-billing-route-auth.test.ts must run against nexusforge_test");
}

const RUN = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const userId = randomUUID();

const app = express();
app.use(express.json());
app.use("/api/billing", storeBillingRouter);
const server = app.listen(0, "127.0.0.1");
let token = "";

before(async () => {
  await once(server, "listening");
  await prisma.user.create({
    data: {
      id: userId,
      username: `ra_${RUN}`.slice(0, 32),
      email: `ra_${RUN}@example.com`,
      password: "not-a-login-in-this-test",
      birthdate: new Date("1990-01-01"),
    },
  });
  token = signAccessToken({ sub: userId, username: `ra_${RUN}`.slice(0, 32), email: `ra_${RUN}@example.com`, jti: randomUUID() });
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

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(url(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json().catch(() => null)) as Record<string, unknown> | null };
}

test("a signed-in user with a malformed purchase request is told what was wrong", async () => {
  const response = await post("/api/billing/store/verify", { provider: "NOPE" }, { Authorization: `Bearer ${token}` });
  assert.equal(response.status, 400);
});

test("a signed-in user asking about Apple gets 'not configured' when Apple is not set up here", async () => {
  const response = await post("/api/billing/store/verify", { provider: "APPLE", transactionId: "2000000111" }, { Authorization: `Bearer ${token}` });
  assert.equal(response.status, 503);
  assert.equal(response.body?.code, "NOT_CONFIGURED");
});

test("Microsoft and Amazon purchases are refused as not set up yet", async () => {
  for (const provider of ["MICROSOFT", "AMAZON"]) {
    const response = await post("/api/billing/store/verify", { provider, purchaseToken: "x" }, { Authorization: `Bearer ${token}` });
    assert.equal(response.status, 503, provider);
    assert.equal(response.body?.code, "NOT_CONFIGURED");
  }
});

test("Apple's notification endpoint refuses while Apple is not set up here", async () => {
  const response = await post("/api/billing/store/apple/notifications", { signedPayload: "x.y.z" });
  assert.equal(response.status, 503);
});

test("Google's notification endpoint refuses while no shared token is configured", async () => {
  const response = await post("/api/billing/store/google/notifications?token=anything", {});
  assert.equal(response.status, 503);
});
