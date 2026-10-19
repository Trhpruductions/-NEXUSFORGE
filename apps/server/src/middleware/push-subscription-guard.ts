import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { isAllowedPushEndpoint, makeRoomForPushSubscription } from "../lib/push.js";
import { requireAuth } from "./auth.js";

/**
 * Checks that run in front of the push-subscription routes (/api/auth/push-subscriptions, in auth.routes.ts):
 *
 * - a new subscription must point at a real browser push service (https, a known host);
 * - an account keeps at most 10 push devices: registering another drops the one refreshed longest ago;
 * - "send me a test notification" is limited per account, on top of the route's own 10-second wait.
 *
 * Before this, any signed-in account could register any number of arbitrary URLs and have the server send
 * requests to all of them on demand.
 */

const TEST_PUSH_WINDOW_MS = 15 * 60 * 1000;
export const TEST_PUSH_LIMIT = 5;

const testPushLimit = rateLimit({
  windowMs: TEST_PUSH_WINDOW_MS,
  limit: TEST_PUSH_LIMIT,
  // requireAuth runs first, so there is always an account to count against.
  keyGenerator: (req) => `push-test:${req.user?.id ?? "unknown"}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "You've sent a few test notifications already. Try again in a few minutes." },
});

function isRegistration(req: Request) {
  return req.method === "POST" && (req.path === "/" || req.path === "");
}

async function checkPushSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.method === "POST" && req.path === "/test") {
    await testPushLimit(req, res, next);
    return;
  }
  if (isRegistration(req)) {
    const body = (req.body ?? {}) as { endpoint?: unknown; p256dh?: unknown; auth?: unknown };
    if (typeof body.endpoint === "string" && !isAllowedPushEndpoint(body.endpoint)) {
      res.status(400).json({ error: "This browser's push address isn't supported. Try again in a current version of Chrome, Edge, Firefox or Safari.", code: "PUSH_ENDPOINT_NOT_ALLOWED" });
      return;
    }
    // Only a complete subscription makes room; the route itself still validates the rest of the payload.
    if (typeof body.endpoint === "string" && typeof body.p256dh === "string" && body.p256dh && typeof body.auth === "string" && body.auth) {
      await makeRoomForPushSubscription(req.user!.id, body.endpoint);
    }
  }
  next();
}

/** Mount in front of the auth router: app.use("/api/auth/push-subscriptions", ...pushSubscriptionGuard). */
export const pushSubscriptionGuard = [requireAuth, checkPushSubscription];
