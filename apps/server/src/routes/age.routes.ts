import { Router, type Request } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { allowedOriginList, isAllowedOrigin } from "../lib/origins.js";

export const ageRouter = Router();

const verifySchema = z.object({
  confirmed: z.boolean(),
});

const allowedOrigins = allowedOriginList({ clientOrigin: env.CLIENT_ORIGIN, appWebUrl: env.APP_WEB_URL, nodeEnv: env.NODE_ENV });

/** The page the request came from: its Origin, or the origin of its Referer when Origin is missing. */
export function requestOrigin(req: Request): string | undefined {
  if (req.headers.origin) return req.headers.origin;
  if (req.headers.referer) {
    try {
      return new URL(req.headers.referer).origin;
    } catch {
      return "invalid";
    }
  }
  return undefined;
}

ageRouter.post("/verify", (req, res) => {
  // CSRF guard: the request must come from one of the app's own origins, matched exactly.
  if (!isAllowedOrigin(requestOrigin(req), allowedOrigins, env.NODE_ENV)) {
    res.setHeader("Cache-Control", "no-store, no-cache");
    res.status(403).json({ error: "Cross-origin age gate bypass blocked" });
    return;
  }

  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.confirmed) {
    res.status(400).json({ error: "Confirmation required" });
    return;
  }

  res.cookie("nexusforge_age18", "true", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    path: "/",
  });

  res.setHeader("Cache-Control", "no-store, no-cache");
  res.json({ success: true, message: "Age verified for session" });
});

ageRouter.post("/reject", (req, res) => {
  res.clearCookie("nexusforge_age18");
  res.json({ success: true, message: "Age verification cleared" });
});
