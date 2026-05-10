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

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts. Please slow down." },
  skip: (req) => shouldBypassRateLimit(req.ip),
});

export const messageRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 45,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Message rate limit exceeded." },
  skip: (req) => shouldBypassRateLimit(req.ip),
});
