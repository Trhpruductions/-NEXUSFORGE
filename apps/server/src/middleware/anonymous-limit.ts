import express, { type Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { accountOrIpKey } from "./rate-limit.js";

/** True when the request carries a genuine Nexus Forge sign-in token (a third-party app's token or a bad one counts as signed out). */
export function isSignedInRequest(req: Request): boolean {
  return accountOrIpKey(req).startsWith("user:");
}

/**
 * A limit per internet address that applies only to signed-out requests. Signed-in people keep their own
 * per-account budget (the route's usual limiter), so a busy shared connection doesn't block their reports.
 */
export function anonymousPerIpLimit(options: { windowMs: number; limit: number; message: string }) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    keyGenerator: (req) => `anon:${ipKeyGenerator(req.ip ?? "")}`,
    skip: isSignedInRequest,
    standardHeaders: false,
    legacyHeaders: false,
    message: { error: options.message },
  });
}

/** Largest JSON body the public report endpoints accept (the app-wide parser allows 10 MB). */
export const REPORT_BODY_LIMIT = "16kb";

/** JSON parser for the public report endpoints; mounted ahead of the app-wide parser, which then skips the body. */
export const reportBodyParser = express.json({ limit: REPORT_BODY_LIMIT });

/** Content-Security-Policy reports: JSON, but labelled with the two report media types browsers use. */
export const cspReportBodyParser = express.json({ limit: REPORT_BODY_LIMIT, type: ["application/csp-report", "application/reports+json", "application/json"] });
