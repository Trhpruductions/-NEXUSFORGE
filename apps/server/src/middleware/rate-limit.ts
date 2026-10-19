import type { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { isAppToken, verifyAccessToken } from "../lib/jwt.js";

const isLocalLoopback = (ip?: string) => {
  if (!ip) return false;
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
};

const shouldBypassRateLimit = (ip?: string) => process.env.NODE_ENV !== "production" && isLocalLoopback(ip);

/** The signed-in user behind a request, if its access token is genuine (checked, not just decoded). */
function signedInUserId(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const payload = verifyAccessToken(header.slice(7));
    // A third-party app's token doesn't get the signed-in allowance; it is counted per address like anyone else.
    return isAppToken(payload) ? null : payload.sub ?? null;
  } catch {
    return null;
  }
}

/** Count per signed-in account, or per IP address for anyone else. */
export function accountOrIpKey(req: Request) {
  const userId = signedInUserId(req);
  return userId ? `user:${userId}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;
}

// Signed-in people are counted per account, so a household or school sharing one internet
// address doesn't share one budget, and quick browsing (each page load makes ~15 calls) no
// longer runs out after ~40 pages. Anonymous traffic is still counted per IP address.
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: (req) => (signedInUserId(req) ? 3000 : 600),
  keyGenerator: accountOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
  skip: (req) => shouldBypassRateLimit(req.ip),
});

// Endpoints worth brute-forcing or spamming: guessing passwords and codes, mass sign-ups,
// mailbombing. Everything else under /api/auth (GET /me on every page load, profile
// edits, telemetry) needs a valid session already and is covered by globalRateLimit.
// Putting /me under this 40-per-15-minutes budget throttled ordinary browsing. /refresh is
// left out too: refresh tokens are random (nothing to guess) and every open tab refreshes.
const CREDENTIAL_AUTH_PATHS = new Set([
  "/register",
  "/login",
  "/2fa/verify",
  "/2fa/resend",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  // Checks a texted code and sets a new password: as guessable as /reset-password.
  "/reset-password/phone",
  // Checks an email and password, so it can be used to guess passwords like /login.
  "/vac-appeal",
  "/core-plus/activate",
]);

/**
 * The path as the router will match it. Express matches routes case-insensitively and ignores a
 * trailing slash, so "/LOGIN" and "/login/" reach the /login handler. They must count against the
 * same budget, or changing the case of one letter would skip the limit entirely.
 */
export function credentialPathKey(path: string): string {
  const trimmed = path.toLowerCase().replace(/\/+$/, "");
  return trimmed || "/";
}

/** Whether a path (relative to /api/auth) is one of the guessable sign-in endpoints. */
export function isCredentialAuthPath(path: string): boolean {
  return CREDENTIAL_AUTH_PATHS.has(credentialPathKey(path));
}

/**
 * Mounted in front of the whole /api/auth router (see index.ts); only the credential paths above
 * are counted. Use accountSecurityRateLimit on individual routes elsewhere: this one skips any
 * path that isn't in the list, so on another router it would silently do nothing.
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts. Please slow down." },
  // req.path is relative to the /api/auth mount point.
  skip: (req) => shouldBypassRateLimit(req.ip) || !isCredentialAuthPath(req.path),
});

/**
 * For account-security actions of a signed-in user, used on individual routes: sending and
 * checking verification codes, changing two-factor, confirming age and submitting an ID. Counted
 * per account (per address when signed out), with its own budget so settings changes can never
 * use up the sign-in allowance. These routes used to carry authRateLimit, which skipped them
 * because their paths aren't sign-in paths, so they had no tight limit at all.
 */
export const accountSecurityRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: accountOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
  skip: (req) => shouldBypassRateLimit(req.ip),
});

// 45 messages a minute per account (people on one shared connection no longer share it),
// plus a looser per-address cap so one person can't flood from many accounts at once.
const messagePerAccount = rateLimit({
  windowMs: 60 * 1000,
  limit: 45,
  keyGenerator: accountOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "You're sending messages too fast. Wait a moment." },
  skip: (req) => shouldBypassRateLimit(req.ip),
});

const messagePerAddress = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: false,
  legacyHeaders: false,
  message: { error: "Too many messages from this network. Wait a moment." },
  skip: (req) => shouldBypassRateLimit(req.ip),
});

export const messageRateLimit = [messagePerAddress, messagePerAccount];
