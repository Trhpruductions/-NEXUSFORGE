import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";

// The env schema is read when config/env.ts loads, so set throwaway secrets for this run first.
// They are random per run and never written anywhere.
process.env.JWT_ACCESS_SECRET ??= randomBytes(32).toString("hex");
process.env.JWT_REFRESH_SECRET ??= randomBytes(32).toString("hex");
process.env.DATABASE_URL ??= "postgresql://localhost/unused";

const { env } = await import("../src/config/env.js");
const { signAccessToken, verifyAccessToken } = await import("../src/lib/jwt.js");

const subject = { sub: "user-123", username: "tester", email: "tester@example.com", jti: "token-id-1" };

test("a token issued by signAccessToken is accepted", () => {
  const token = signAccessToken(subject);
  assert.equal(verifyAccessToken(token).sub, "user-123");
});

test("a two-factor challenge token cannot be used as an access token", () => {
  // Same signing key and subject as the challenge issued after a correct password.
  const challenge = jwt.sign({ sub: "user-123", purpose: "2fa" }, env.JWT_ACCESS_SECRET, { expiresIn: "10m" });
  assert.throws(() => verifyAccessToken(challenge));
});

test("an authenticator challenge token cannot be used as an access token", () => {
  const challenge = jwt.sign({ sub: "user-123", purpose: "2fa", method: "totp" }, env.JWT_ACCESS_SECRET, { expiresIn: "10m" });
  assert.throws(() => verifyAccessToken(challenge));
});

test("a token without a token id is rejected", () => {
  const { jti: _jti, ...withoutId } = subject;
  const token = jwt.sign(withoutId, env.JWT_ACCESS_SECRET, { expiresIn: "15m" });
  assert.throws(() => verifyAccessToken(token));
});

test("a token signed with a different key is rejected", () => {
  const forged = jwt.sign(subject, randomBytes(32).toString("hex"), { expiresIn: "15m" });
  assert.throws(() => verifyAccessToken(forged));
});
