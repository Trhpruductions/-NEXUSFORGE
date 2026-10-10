import rateLimit from "express-rate-limit";

const isLocalLoopback = (ip?: string) => {
  if (!ip) return false;
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
};

const shouldBypassRateLimit = (ip?: string) => process.env.NODE_ENV !== "production" && isLocalLoopback(ip);

export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
  skip: (req) => shouldBypassRateLimit(req.ip),
});

// Endpoints worth brute-forcing or spamming: guessing passwords and codes, mass sign-ups,
// mailbombing. Everything else under /api/auth (GET /me on every page load, profile
// edits, telemetry) needs a valid session already and is covered by globalRateLimit.
// Putting /me under this 40-per-15-minutes budget throttled ordinary browsing.
const CREDENTIAL_AUTH_PATHS = new Set([
  "/register",
  "/login",
  "/2fa/verify",
  "/2fa/resend",
  "/refresh",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/core-plus/activate",
]);

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts. Please slow down." },
  // req.path is relative to the /api/auth mount point.
  skip: (req) => shouldBypassRateLimit(req.ip) || !CREDENTIAL_AUTH_PATHS.has(req.path),
});

export const messageRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 45,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Message rate limit exceeded." },
  skip: (req) => shouldBypassRateLimit(req.ip),
});
