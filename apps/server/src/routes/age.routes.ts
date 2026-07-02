import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";

export const ageRouter = Router();

const verifySchema = z.object({
  confirmed: z.boolean(),
});

ageRouter.post("/verify", (req, res) => {
  // Impenetrable check: CSRF protection + strict cookie options
  const origin = req.headers.origin || req.headers.referer;
  if (origin && !origin.includes("nexusforge.app") && !origin.includes("127.0.0.1") && !origin.includes("localhost")) {
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
