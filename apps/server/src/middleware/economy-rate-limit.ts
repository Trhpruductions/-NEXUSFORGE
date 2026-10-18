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

/**
 * Mining actions (buy, rename, pause, harvest, decommission), per account. Its own budget, so a
 * player harvesting rigs one by one doesn't use up the economy allowance that balance and wallet
 * reads share; looser than economyRateLimit because each rig has its own buttons.
 */
export const miningRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: accountOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many mining actions. Wait a moment." },
});
