import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express, { Router, type RequestHandler } from "express";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { signAccessToken } from "../src/lib/jwt.js";
import { accountSecurityRateLimit, authRateLimit, credentialPathKey, isCredentialAuthPath } from "../src/middleware/rate-limit.js";
import { verificationRouter } from "../src/routes/verification.routes.js";
import { ageVerificationRouter } from "../src/routes/age-verification.routes.js";

// Sign-in and account-security endpoints must sit behind the tight limiters. No database rows are
// written: the routes below are stand-ins that only answer 200.

const ok: RequestHandler = (_req, res) => {
  res.json({ ok: true });
};

const authStandIn = Router();
for (const path of ["/login", "/register", "/2fa/verify", "/2fa/resend", "/forgot-password", "/reset-password", "/reset-password/phone", "/vac-appeal"]) {
  authStandIn.post(path, ok);
}
authStandIn.get("/me", ok);

const app = express();
// As in index.ts: the address comes from X-Forwarded-For when the proxy is on this machine.
app.set("trust proxy", "loopback");
app.use(express.json());
app.use("/api/auth", authRateLimit, authStandIn);
app.post("/api/verification/email/send", accountSecurityRateLimit, ok);
const server = app.listen(0, "127.0.0.1");

before(async () => {
  if (!server.listening) await once(server, "listening");
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function url(path: string) {
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}${path}`;
}

async function call(method: string, path: string, headers: Record<string, string>) {
  const response = await fetch(url(path), { method, headers: { "Content-Type": "application/json", ...headers }, body: method === "GET" ? undefined : "{}" });
  await response.arrayBuffer();
  return response.status;
}

test("the sign-in path check ignores letter case and a trailing slash, as the router does", () => {
  assert.equal(credentialPathKey("/LOGIN/"), "/login");
  for (const path of ["/login", "/LOGIN", "/login/", "/Login//", "/reset-password/phone", "/RESET-PASSWORD/PHONE/", "/vac-appeal", "/2fa/resend", "/forgot-password"]) {
    assert.equal(isCredentialAuthPath(path), true, path);
  }
  for (const path of ["/me", "/refresh", "/logout", "/delivery"]) {
    assert.equal(isCredentialAuthPath(path), false, path);
  }
});

test("sign-in attempts share one budget per address, whatever the spelling of the path", async () => {
  const from = { "X-Forwarded-For": "203.0.113.10" };
  const spellings = ["/api/auth/login", "/api/auth/LOGIN", "/api/auth/login/", "/api/auth/Login", "/api/auth/reset-password/phone", "/api/auth/vac-appeal", "/api/auth/2fa/verify", "/api/auth/forgot-password"];
  for (let i = 0; i < 40; i += 1) {
    assert.equal(await call("POST", spellings[i % spellings.length], from), 200, `attempt ${i + 1}`);
  }
  // The 41st, in a spelling that used to skip the limiter entirely.
  assert.equal(await call("POST", "/api/auth/LOGIN/", from), 429);
  assert.equal(await call("POST", "/api/auth/reset-password/phone", from), 429);
  // Ordinary signed-in calls under /api/auth are not counted.
  assert.equal(await call("GET", "/api/auth/me", from), 200);
  // Another address has its own budget.
  assert.equal(await call("POST", "/api/auth/login", { "X-Forwarded-For": "203.0.113.11" }), 200);
});

test("account-security actions are limited per account", async () => {
  const tokenFor = (sub: string) => signAccessToken({ sub, username: `u_${sub.slice(0, 8)}`, email: `${sub}@example.com`, jti: randomUUID() });
  const first = { Authorization: `Bearer ${tokenFor(randomUUID())}`, "X-Forwarded-For": "203.0.113.20" };
  for (let i = 0; i < 30; i += 1) {
    assert.equal(await call("POST", "/api/verification/email/send", first), 200, `attempt ${i + 1}`);
  }
  assert.equal(await call("POST", "/api/verification/email/send", first), 429);
  // Someone else on the same network is not affected.
  const second = { Authorization: `Bearer ${tokenFor(randomUUID())}`, "X-Forwarded-For": "203.0.113.20" };
  assert.equal(await call("POST", "/api/verification/email/send", second), 200);
});

/** The handlers on a router's route for `method path`, in order. */
function handlersFor(router: Router, method: string, path: string) {
  const stack = (router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: unknown }> } }> }).stack;
  const layer = stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  assert.ok(layer?.route, `${method.toUpperCase()} ${path} is not on the router`);
  return layer.route.stack.map((entry) => entry.handle);
}

test("verification and age routes use the account-security limiter, not the sign-in one", () => {
  const routes: Array<[Router, string, string]> = [
    [verificationRouter, "post", "/email/send"],
    [verificationRouter, "post", "/email/confirm"],
    [verificationRouter, "post", "/phone/send"],
    [verificationRouter, "post", "/two-factor/challenge"],
    [verificationRouter, "put", "/two-factor"],
    [verificationRouter, "post", "/two-factor/totp/disable"],
    [ageVerificationRouter, "post", "/attest"],
    [ageVerificationRouter, "post", "/submit"],
  ];
  for (const [router, method, path] of routes) {
    const handlers = handlersFor(router, method, path);
    assert.ok(handlers.includes(accountSecurityRateLimit), `${method.toUpperCase()} ${path} has no account-security limit`);
    // authRateLimit skips any path that isn't a sign-in path, so on these routes it did nothing.
    assert.ok(!handlers.includes(authRateLimit), `${method.toUpperCase()} ${path} still relies on authRateLimit`);
  }
});
