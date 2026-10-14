import rateLimit from "express-rate-limit";
import { accountOrIpKey } from "./rate-limit.js";

export const economyRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10,          // 10 transactions per minute, per account
  keyGenerator: accountOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Economy operations rate limit exceeded. Slow down." },
});
