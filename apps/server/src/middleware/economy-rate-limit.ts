import rateLimit from "express-rate-limit";

export const economyRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,            // 10 transactions per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Economy operations rate limit exceeded. Slow down." },
});
