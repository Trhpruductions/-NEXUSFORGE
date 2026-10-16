#!/usr/bin/env node
// End-to-end check of authenticator-app two-factor sign-in against a LOCAL API (the test API, never production).
//
// Steps: create a throwaway account, turn on the authenticator app, sign in with a code, reject a wrong code and a
// replayed code, use a recovery code once (and not twice), turn the app off, and sign in without a second factor.
//
// Safety: refuses any API that is not on localhost, and only runs with NF_E2E_ALLOW_WRITES=1, because it creates an
// account. It never prints passwords, tokens, codes or recovery codes. It takes about one minute, because two codes
// must come from different 30-second windows.
//
// usage: NF_E2E_ALLOW_WRITES=1 node scripts/e2e/two-factor-check.mjs [apiBaseUrl]

import { createHmac, randomBytes } from "node:crypto";

const API = (process.argv[2] ?? process.env.NF_E2E_API ?? "http://localhost:4101").replace(/\/$/, "");
const ORIGIN = process.env.NF_E2E_ORIGIN ?? "http://localhost:3502";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

if (!LOCAL_HOSTS.has(new URL(API).hostname)) {
  console.error("refusing: this check only runs against a local API");
  process.exit(2);
}
if (process.env.NF_E2E_ALLOW_WRITES !== "1") {
  console.error("refusing: set NF_E2E_ALLOW_WRITES=1 to allow this check to create a test account");
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- RFC 6238, written independently of the server's own helper (same algorithm, separate code) ---
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(input) {
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of input.toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    value = (value << 5) | B32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
function totpFor(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const binary = ((hmac[offset] & 127) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}
const stepNow = () => Math.floor(Date.now() / 1000 / 30);

/** Waits until the clock is past `step`, so the next code cannot be a replay of it. Returns the new step. */
async function nextStepAfter(step) {
  while (stepNow() <= step) await sleep(500);
  return stepNow();
}

// --- HTTP helpers with a manual CSRF pair (cookie and header must match) ---
async function call(method, path, { body, token, csrf } = {}) {
  const headers = { "content-type": "application/json", origin: ORIGIN };
  if (token) headers.authorization = `Bearer ${token}`;
  if (csrf) {
    headers["x-csrf-token"] = csrf;
    headers.cookie = `nf_csrf=${csrf}`;
  }
  const response = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, json };
}

const password = randomBytes(18).toString("base64url");
const username = `tfa${randomBytes(4).toString("hex")}`;
const email = `${username}@preview.test`;

// 1. Register a throwaway account and sign in with the password (no second factor yet).
const registered = await call("POST", "/api/auth/register", { body: { username, email, password, birthdate: "1995-01-01" } });
check("register a throwaway account", registered.status === 201, `status ${registered.status}`);
if (registered.status !== 201) process.exit(1);
let accessToken = registered.json.accessToken;

let login = await call("POST", "/api/auth/login", { body: { email, password } });
check("sign in before two-factor is on", login.status === 200 && typeof login.json?.accessToken === "string", `status ${login.status}`);
accessToken = login.json?.accessToken ?? accessToken;
let csrf = login.json?.csrfToken;

// 2. Turn the authenticator app on: setup with the password, then enter a current code.
const setup = await call("POST", "/api/verification/two-factor/totp/setup", { body: { password }, token: accessToken, csrf });
check("start authenticator setup with the password", setup.status === 200 && typeof setup.json?.secret === "string", `status ${setup.status}`);
const secret = setup.json?.secret;

const enableStep = stepNow();
const enable = await call("POST", "/api/verification/two-factor/totp/enable", { body: { code: totpFor(secret, enableStep) }, token: accessToken, csrf });
const recoveryCodes = enable.json?.recoveryCodes ?? [];
check("enable with a current app code, and receive recovery codes", enable.status === 200 && recoveryCodes.length === 10, `status ${enable.status}, ${recoveryCodes.length} codes`);

// 3. Sign in now needs the second factor.
login = await call("POST", "/api/auth/login", { body: { email, password } });
const challenge = login.json?.challengeToken;
check("sign-in asks for the authenticator code, and gives no access token", login.status === 200 && login.json?.requiresTwoFactor === true && !login.json?.accessToken, `method ${login.json?.method ?? "none"}`);

// 4. A challenge token proves the password only; it must not work as a bearer token.
const asBearer = await call("GET", "/api/auth/me", { token: challenge });
check("the sign-in challenge token is refused as an access token", asBearer.status === 401, `status ${asBearer.status}`);

// 5. A wrong code is refused.
const correctNow = totpFor(secret, stepNow());
const wrong = (Number(correctNow) + 1) % 1_000_000;
const wrongCode = await call("POST", "/api/auth/2fa/verify", { body: { challengeToken: challenge, code: String(wrong).padStart(6, "0") } });
check("a wrong code is refused", wrongCode.status === 400, `status ${wrongCode.status}`);

// 6. A current code from a later window signs in.
const signInStep = await nextStepAfter(enableStep);
const signedIn = await call("POST", "/api/auth/2fa/verify", { body: { challengeToken: challenge, code: totpFor(secret, signInStep) } });
check("a current code from a new window signs in", signedIn.status === 200 && typeof signedIn.json?.accessToken === "string", `status ${signedIn.status}`);
accessToken = signedIn.json?.accessToken ?? accessToken;
csrf = signedIn.json?.csrfToken ?? csrf;
const me = await call("GET", "/api/auth/me", { token: accessToken });
check("the new access token works on a protected route", me.status === 200, `status ${me.status}`);

// 7. The same code cannot be used twice: sign in again and replay the code from step 6.
login = await call("POST", "/api/auth/login", { body: { email, password } });
const replay = await call("POST", "/api/auth/2fa/verify", { body: { challengeToken: login.json?.challengeToken, code: totpFor(secret, signInStep) } });
check("a replayed code is refused", replay.status === 400, `status ${replay.status}`);

// 8. A recovery code signs in once; the same code is refused afterwards.
const recovery = recoveryCodes[0];
login = await call("POST", "/api/auth/login", { body: { email, password } });
const viaRecovery = await call("POST", "/api/auth/2fa/verify", { body: { challengeToken: login.json?.challengeToken, code: recovery } });
check("a recovery code signs in and reports the codes left", viaRecovery.status === 200 && viaRecovery.json?.recoveryCodesLeft === 9, `status ${viaRecovery.status}, left ${viaRecovery.json?.recoveryCodesLeft ?? "n/a"}`);
accessToken = viaRecovery.json?.accessToken ?? accessToken;
csrf = viaRecovery.json?.csrfToken ?? csrf;

login = await call("POST", "/api/auth/login", { body: { email, password } });
const reused = await call("POST", "/api/auth/2fa/verify", { body: { challengeToken: login.json?.challengeToken, code: recovery } });
check("the same recovery code is refused the second time", reused.status === 400, `status ${reused.status}`);

// 9. Turning the app off needs a current code, and then sign-in needs no second factor.
const disableStep = await nextStepAfter(signInStep);
const disable = await call("POST", "/api/verification/two-factor/totp/disable", { body: { code: totpFor(secret, disableStep) }, token: accessToken, csrf });
check("turn the authenticator app off with a current code", disable.status === 200, `status ${disable.status}`);

login = await call("POST", "/api/auth/login", { body: { email, password } });
check("after turning it off, sign-in needs no second factor", login.status === 200 && typeof login.json?.accessToken === "string" && !login.json?.requiresTwoFactor, `status ${login.status}`);

const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
process.exit(failed.length === 0 ? 0 : 1);
