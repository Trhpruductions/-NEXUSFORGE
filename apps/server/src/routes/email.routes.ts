/**
 * Public email endpoints (no login):
 *   POST /api/email/webhooks   provider delivery events, HMAC-signed over the raw body
 *   GET  /api/email/unsubscribe?token=   one-click opt-out for optional mail (also accepts POST)
 *
 * The webhook handler must sit BEFORE the global express.json() parser in index.ts, because the
 * signature is computed over the exact bytes the provider sent.
 */
import { Router, type Request, type Response } from "express";
import { env } from "../config/env.js";
import { emailPipeline } from "../lib/delivery.js";
import { setUserOptIn } from "../lib/email-store.js";
import { handleProviderWebhook } from "../lib/email-webhook.js";
import {
  ReplayGuard,
  secretUsable,
  unsubscribeKey,
  verifyUnsubscribeToken,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from "../lib/email-tokens.js";

const replayGuard = new ReplayGuard();
let unsubscribeSigningKey: Buffer | null = null;

export async function emailWebhookHandler(req: Request, res: Response): Promise<void> {
  // Disabled (no secret, or one too short) looks exactly like a missing route.
  if (!secretUsable(env.EMAIL_WEBHOOK_SECRET)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!Buffer.isBuffer(req.body)) {
    res.status(415).json({ error: "Send the event as JSON" });
    return;
  }
  const result = await handleProviderWebhook({
    secret: env.EMAIL_WEBHOOK_SECRET,
    timestamp: req.header(WEBHOOK_TIMESTAMP_HEADER),
    signature: req.header(WEBHOOK_SIGNATURE_HEADER),
    rawBody: req.body,
    nowMs: Date.now(),
    replay: replayGuard,
    pipeline: emailPipeline,
  });
  res.status(result.status).json(result.body);
}

export const emailRouter = Router();

function page(res: Response, status: number, title: string, message: string) {
  res
    .status(status)
    .type("html")
    .send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#070a12;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;padding:48px 16px">
  <main style="max-width:480px;margin:0 auto;background:#0f1420;border:1px solid #1f2a3d;border-radius:16px;padding:28px">
    <h1 style="margin:0 0 12px;font-size:20px;color:#ffffff">${title}</h1>
    <p style="margin:0;line-height:1.6">${message}</p>
  </main>
</body></html>`);
}

/** Idempotent: unsubscribing twice leaves the same state. Needs no login; the signed token is the credential. */
async function unsubscribe(req: Request, res: Response): Promise<void> {
  const fromQuery = typeof req.query.token === "string" ? req.query.token : undefined;
  const fromBody = typeof req.body?.token === "string" ? req.body.token : undefined;
  const token = fromQuery ?? fromBody ?? "";

  unsubscribeSigningKey ??= unsubscribeKey({ explicit: env.EMAIL_UNSUBSCRIBE_SECRET, fallbackSecret: env.JWT_ACCESS_SECRET });
  const verdict = verifyUnsubscribeToken(unsubscribeSigningKey, token, Date.now());
  if (!verdict.ok) {
    page(res, 400, "This link isn't valid", "The unsubscribe link is invalid or has expired. You can change your email preferences in Settings.");
    return;
  }
  try {
    await setUserOptIn(verdict.userId, verdict.category, false);
  } catch (error) {
    console.error("[EMAIL] unsubscribe failed", error);
    page(res, 503, "Please try again", "We couldn't update your preferences just now. Try the link again in a few minutes.");
    return;
  }
  page(res, 200, "You're unsubscribed", "You won't get these emails any more. You can turn them back on in Settings at any time.");
}

emailRouter.get("/unsubscribe", unsubscribe);
emailRouter.post("/unsubscribe", unsubscribe);
