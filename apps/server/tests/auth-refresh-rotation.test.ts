import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { randomToken, sha256 } from "../src/lib/jwt.js";
import { prisma } from "../src/lib/prisma.js";
import { authRouter, REFRESH_COOKIE_NAME } from "../src/routes/auth.routes.js";
import { assertNotLiveDatabase } from "./helpers/live-database-guard.js";

// Refresh-token rotation must be atomic: when several requests bring the same refresh token at
// once, exactly one gets a new token. Reuse detection must still end the whole session when an
// old token turns up later. Writes one user and its tokens (removed afterwards), so it must never
// run against the live database.
assertNotLiveDatabase();

const RUN = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const userId = randomUUID();

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
      username: `rr_${RUN}`.slice(0, 32),
      email: `rr_${RUN}@example.com`,
      password: "not-a-login-in-this-test",
      birthdate: new Date("1990-01-01"),
    },
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

/** A signed-in session: one live refresh token, as sign-in leaves it. */
async function newSession() {
  const token = randomToken();
  const sessionId = randomUUID();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      sessionId,
      signedInAt: new Date(),
      lastUsedAt: new Date(),
      deviceLabel: "Test runner",
    },
  });
  return { token, sessionId };
}

type RefreshResult = { status: number; body: Record<string, unknown> | null; newToken: string | null; clearedCookie: boolean };

async function refresh(token: string): Promise<RefreshResult> {
  const { port } = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/refresh`, {
    method: "POST",
    headers: { Cookie: `${REFRESH_COOKIE_NAME}=${token}` },
  });
  const cookies = response.headers.getSetCookie();
  const refreshCookie = cookies.find((cookie) => cookie.startsWith(`${REFRESH_COOKIE_NAME}=`)) ?? null;
  const value = refreshCookie ? decodeURIComponent(refreshCookie.split(";")[0].slice(REFRESH_COOKIE_NAME.length + 1)) : "";
  const cleared = Boolean(refreshCookie && (value === "" || /Expires=Thu, 01 Jan 1970/i.test(refreshCookie)));
  return {
    status: response.status,
    body: (await response.json().catch(() => null)) as Record<string, unknown> | null,
    newToken: refreshCookie && !cleared ? value : null,
    clearedCookie: cleared,
  };
}

test("simultaneous refreshes with one token: exactly one wins, the rest fail cleanly", async () => {
  const { token, sessionId } = await newSession();

  const results = await Promise.all(Array.from({ length: 6 }, () => refresh(token)));
  const winners = results.filter((result) => result.status === 200);
  const losers = results.filter((result) => result.status !== 200);

  assert.equal(winners.length, 1, `expected one successful rotation, got ${winners.length}`);
  assert.ok(winners[0].newToken, "the winner gets a new refresh cookie");
  assert.equal(typeof winners[0].body?.accessToken, "string");
  for (const loser of losers) {
    assert.equal(loser.status, 401);
    assert.equal(loser.body?.error, "Invalid refresh token");
    // Tells the website to retry once with the newer cookie instead of signing this tab out.
    assert.equal(loser.body?.code, "REFRESH_TOKEN_ROTATED");
    // The winner's cookie is in the shared cookie jar; a loser must not wipe it.
    assert.equal(loser.clearedCookie, false, "a request that lost the race must not clear the cookie");
  }

  // The session now holds the old (revoked) token and exactly one live successor.
  const rows = await prisma.refreshToken.findMany({ where: { sessionId }, select: { tokenHash: true, revokedAt: true } });
  assert.equal(rows.length, 2, "only one new token may be issued");
  assert.equal(rows.filter((row) => row.revokedAt === null).length, 1);
  assert.equal(rows.find((row) => row.revokedAt === null)?.tokenHash, sha256(winners[0].newToken!));

  // The successor keeps working (the session was not ended by the race).
  const next = await refresh(winners[0].newToken!);
  assert.equal(next.status, 200);
});

test("a copied token used again after the grace window ends the whole session", async () => {
  const { token, sessionId } = await newSession();
  const first = await refresh(token);
  assert.equal(first.status, 200);
  const live = first.newToken!;

  // Pretend the original was replaced a minute ago (past the few seconds two tabs are allowed).
  await prisma.refreshToken.update({ where: { tokenHash: sha256(token) }, data: { revokedAt: new Date(Date.now() - 60_000) } });

  const reused = await refresh(token);
  assert.equal(reused.status, 401);
  assert.equal(reused.clearedCookie, true);
  assert.equal(reused.body?.code, undefined, "a replayed old token is not told to retry");

  const stillLive = await prisma.refreshToken.count({ where: { sessionId, revokedAt: null } });
  assert.equal(stillLive, 0, "reuse must revoke every token of that session");
  assert.equal((await refresh(live)).status, 401, "the thief's or the owner's newer token stops working too");
});

test("the same token again within the grace window is refused without ending the session", async () => {
  const { token, sessionId } = await newSession();
  const first = await refresh(token);
  assert.equal(first.status, 200);

  // A second tab that read the cookie just before the first tab replaced it.
  const late = await refresh(token);
  assert.equal(late.status, 401);
  assert.equal(late.clearedCookie, false);
  // Same answer as losing the race at the same instant, so the website retries with its newer cookie.
  assert.equal(late.body?.code, "REFRESH_TOKEN_ROTATED");
  assert.equal(await prisma.refreshToken.count({ where: { sessionId, revokedAt: null } }), 1);
  assert.equal((await refresh(first.newToken!)).status, 200);
});
