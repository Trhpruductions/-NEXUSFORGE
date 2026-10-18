import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac, hkdfSync, randomBytes } from "node:crypto";
import { createAgeGateToken, verifyAgeGateToken } from "../../web/src/lib/age-gate-token.ts";

// The anonymous "I am 18+" cookie is signed by the web app (apps/web/src/lib/age-gate-token.ts).
// Without a dedicated secret it used to be signed with JWT_ACCESS_SECRET itself; it must now use a
// key derived from it with its own label, so the JWT secret is never used directly for it. No
// database, no network: only environment variables and the signing code.

const KEYS = ["VEXORA_AGE_GATE_SECRET", "NEXUSFORGE_AGE_GATE_SECRET", "JWT_ACCESS_SECRET"] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestRunner";

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function useSecrets(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, values);
}

const hmacHex = (key: Buffer | string, payload: string) => createHmac("sha256", key).update(payload).digest("hex");

test("with only the JWT secret set, the cookie is signed with an HKDF-derived key, not the JWT secret", async () => {
  const jwtSecret = randomBytes(32).toString("hex");
  useSecrets({ JWT_ACCESS_SECRET: jwtSecret });

  const token = await createAgeGateToken(Date.now(), UA);
  const [payload, signature] = token.split(".");
  const derived = Buffer.from(hkdfSync("sha256", jwtSecret, Buffer.alloc(0), "nexusforge/age-gate-cookie/hmac-sha256/v1", 32));

  assert.notEqual(signature, hmacHex(jwtSecret, payload), "the JWT secret must not be the signing key");
  assert.equal(signature, hmacHex(derived, payload));
  assert.equal(await verifyAgeGateToken(token, Date.now(), UA), true);

  // A cookie signed the old way (directly with the JWT secret) is no longer accepted: those
  // visitors are asked to confirm once more.
  assert.equal(await verifyAgeGateToken(`${payload}.${hmacHex(jwtSecret, payload)}`, Date.now(), UA), false);
});

test("a dedicated age-gate secret is used as before, so its cookies keep working", async () => {
  const dedicated = randomBytes(32).toString("hex");
  useSecrets({ VEXORA_AGE_GATE_SECRET: dedicated, JWT_ACCESS_SECRET: randomBytes(32).toString("hex") });

  const token = await createAgeGateToken(Date.now(), UA);
  const [payload, signature] = token.split(".");
  assert.equal(signature, hmacHex(dedicated, payload));
  assert.equal(await verifyAgeGateToken(token, Date.now(), UA), true);
});

test("a sample value is never used as a secret", async () => {
  useSecrets({ VEXORA_AGE_GATE_SECRET: "change-me-change-me-change-me-change-me", JWT_ACCESS_SECRET: randomBytes(32).toString("hex") });
  const token = await createAgeGateToken(Date.now(), UA);
  const [payload, signature] = token.split(".");
  assert.notEqual(signature, hmacHex("change-me-change-me-change-me-change-me", payload));
});
