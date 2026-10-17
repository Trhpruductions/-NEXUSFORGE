import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { storeBillingRouter } from "../src/routes/store-billing.routes.js";
import { prisma } from "../src/lib/prisma.js";

// The store verify route must sit behind sign-in: an anonymous caller can never ask for a grant.

const app = express();
app.use(express.json());
app.use("/api/billing", storeBillingRouter);
const server = app.listen(0, "127.0.0.1");

before(async () => {
  await once(server, "listening");
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

function baseUrl(): string {
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

test("the store verify route refuses an anonymous caller", async () => {
  const response = await fetch(`${baseUrl()}/api/billing/store/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "APPLE", transactionId: "2000000111" }),
  });
  assert.equal(response.status, 401);
});

test("the store verify route refuses a bearer token that is not a valid session", async () => {
  const response = await fetch(`${baseUrl()}/api/billing/store/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer not-a-real-token" },
    body: JSON.stringify({ provider: "APPLE", transactionId: "2000000111" }),
  });
  assert.equal(response.status, 401);
});
