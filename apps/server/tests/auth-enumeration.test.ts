import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { checkPasswordOrDummy, comparePassword, hashPassword } from "../src/lib/password.js";
import { prisma } from "../src/lib/prisma.js";
import { authRouter } from "../src/routes/auth.routes.js";
import { assertNotLiveDatabase } from "./helpers/live-database-guard.js";

// Sign-in and password reset must not reveal which emails (or phone numbers) have accounts,
// neither in what they answer nor in how long they take. Writes one user (removed afterwards),
// so it must never run against the live database.
assertNotLiveDatabase();

const RUN = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const userId = randomUUID();
const email = `en_${RUN}@example.com`;
const password = `Right-${RUN}`;
const phone = `+1555${String(Date.now()).slice(-7)}`;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRouter);
const server = app.listen(0, "127.0.0.1");

before(async () => {
  if (!server.listening) await once(server, "listening");
  await prisma.user.create({
    data: {
      id: userId,
      username: `en_${RUN}`.slice(0, 32),
      email,
      password: await hashPassword(password),
      birthdate: new Date("1990-01-01"),
      phoneNumber: phone,
      phoneVerified: true,
    },
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

async function post(path: string, body: unknown) {
  const { port } = server.address() as AddressInfo;
  const started = performance.now();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: response.status, body: json, ms: performance.now() - started };
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

test("a password check for a missing account still does a full bcrypt comparison", async () => {
  const realHash = await hashPassword("something-else-entirely");
  assert.equal(await checkPasswordOrDummy("guess-guess", null), false);
  assert.equal(await checkPasswordOrDummy("guess-guess", undefined), false);
  assert.equal(await checkPasswordOrDummy("something-else-entirely", realHash), true);
  assert.equal(await checkPasswordOrDummy("guess-guess", realHash), false);

  const time = async (work: () => Promise<unknown>) => {
    const started = performance.now();
    await work();
    return performance.now() - started;
  };
  const missing: number[] = [];
  const existing: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    missing.push(await time(() => checkPasswordOrDummy("guess-guess", null)));
    existing.push(await time(() => comparePassword("guess-guess", realHash)));
  }
  // Same cost factor, so the same order of time; the old code returned in well under a millisecond.
  assert.ok(median(missing) > median(existing) * 0.5, `missing ${median(missing).toFixed(1)}ms vs existing ${median(existing).toFixed(1)}ms`);
});

test("sign-in gives the same answer, in about the same time, for an unknown email and a wrong password", async () => {
  const unknown: number[] = [];
  const wrong: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const a = await post("/api/auth/login", { email: `nobody_${RUN}_${i}@example.com`, password: "Wrong-password-1" });
    const b = await post("/api/auth/login", { email, password: "Wrong-password-1" });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.deepEqual(a.body, b.body);
    assert.deepEqual(a.body, { error: "Invalid credentials" });
    unknown.push(a.ms);
    wrong.push(b.ms);
  }
  assert.ok(median(unknown) > median(wrong) * 0.5, `unknown ${median(unknown).toFixed(1)}ms vs known ${median(wrong).toFixed(1)}ms`);

  // An unknown phone number takes the dummy path too.
  const byPhone = await post("/api/auth/login", { email: "+15550000000", password: "Wrong-password-1" });
  assert.equal(byPhone.status, 401);
  assert.deepEqual(byPhone.body, { error: "Invalid credentials" });

  // And the right password still signs in.
  const right = await post("/api/auth/login", { email, password });
  assert.equal(right.status, 200);
  assert.equal(typeof right.body?.accessToken, "string");
});

test("forgot-password answers the same for a known and an unknown address, and only the known one gets a link", async () => {
  const known = await post("/api/auth/forgot-password", { email });
  const unknown = await post("/api/auth/forgot-password", { email: `nobody_${RUN}@example.com` });
  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  assert.deepEqual(known.body, unknown.body);

  // The lookup and the reset link happen after the answer; wait for them so the row is not deleted mid-way.
  let resetToken: string | null = null;
  for (let i = 0; i < 50 && !resetToken; i += 1) {
    resetToken = (await prisma.user.findUnique({ where: { id: userId }, select: { resetToken: true } }))?.resetToken ?? null;
    if (!resetToken) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(resetToken, "the account with that address gets a reset token");
});

test("a wrong phone reset code gets the same answer whether or not the number is on an account", async () => {
  const body = { code: "123456", newPassword: "Another-password-1" };
  const known = await post("/api/auth/reset-password/phone", { ...body, phone });
  const unknown = await post("/api/auth/reset-password/phone", { ...body, phone: "+15550000001" });
  assert.equal(known.status, 400);
  assert.equal(unknown.status, 400);
  assert.deepEqual(known.body, unknown.body);
  assert.equal(known.body?.attemptsLeft, undefined);
});
