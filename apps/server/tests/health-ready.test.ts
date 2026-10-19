import test, { after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";

// The readiness check used to put the database error (host, port, driver message) in its public answer.
// This file points Prisma at an address where nothing listens (port 1 on this machine), so the check fails
// the way it does when Postgres is down. No database is touched.
process.env.DATABASE_URL = "postgresql://nobody:nothing@127.0.0.1:1/none";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-at-least-32-characters";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-at-least-32-characters";
const { healthRouter } = await import("../src/routes/health.routes.js");
const { prisma } = await import("../src/lib/prisma.js");

const app = express();
app.use("/api", healthRouter);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect().catch(() => undefined);
});

test("when the database is down, /health/ready answers 503 without the error text, and logs the reason", async () => {
  const logged: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => void logged.push(args.map(String).join(" "));
  let status = 0;
  let body: Record<string, unknown> = {};
  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/api/health/ready`);
    status = response.status;
    body = (await response.json()) as Record<string, unknown>;
  } finally {
    console.error = originalError;
  }
  assert.equal(status, 503);
  assert.deepEqual(body, { status: "degraded", service: "nexusforge-api", database: "unreachable" });
  assert.ok(!JSON.stringify(body).includes("127.0.0.1"), "no address in the answer");
  assert.ok(logged.some((line) => line.startsWith("[health] readiness check failed:") && line.length > "[health] readiness check failed:".length), "the reason is in the server log");
});

test("/health still answers without touching the database", async () => {
  const { port } = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", service: "nexusforge-api" });
});
