/**
 * Handles a delivery event posted by an email provider. The request is checked (HMAC over the raw body,
 * a timestamp within five minutes, no replay) before its JSON is even read.
 *
 * The body format is generic on purpose: { "messageId", "type": "delivered" | "bounced" | "complained"
 * | "failed", "occurredAt" }. Provider-specific formats (SES, SendGrid, Mailgun, Postmark, ...) are NOT
 * implemented. Each needs its own parser that turns its payload into this shape.
 */
import { z } from "zod";
import type { ProviderEventType } from "./email-status.js";
import { verifyWebhookSignature, type ReplayGuard } from "./email-tokens.js";
import type { EmailPipeline } from "./email-pipeline.js";

export const providerEventSchema = z.object({
  messageId: z.string().trim().min(1).max(255),
  type: z.enum(["delivered", "bounced", "complained", "failed"] satisfies ProviderEventType[]),
  occurredAt: z
    .string()
    .max(64)
    .refine((value) => !Number.isNaN(Date.parse(value)), "occurredAt must be a date"),
});

export type WebhookResponse = { status: number; body: Record<string, unknown> };

export async function handleProviderWebhook(params: {
  secret: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
  rawBody: Buffer;
  nowMs: number;
  replay: ReplayGuard;
  pipeline: Pick<EmailPipeline, "recordProviderEvent">;
}): Promise<WebhookResponse> {
  const verdict = verifyWebhookSignature(params);
  // Disabled looks like a missing route, so nobody can tell the endpoint exists without the secret.
  if (!verdict.ok && verdict.reason === "disabled") return { status: 404, body: { error: "Not found" } };
  if (!verdict.ok) return { status: 401, body: { error: "Invalid signature" } };

  let json: unknown;
  try {
    json = JSON.parse(params.rawBody.toString("utf8"));
  } catch {
    return { status: 400, body: { error: "Body must be JSON" } };
  }
  const parsed = providerEventSchema.safeParse(json);
  if (!parsed.success) return { status: 400, body: { error: "Invalid event" } };

  const outcome = await params.pipeline.recordProviderEvent({ messageId: parsed.data.messageId, type: parsed.data.type });
  // Always 2xx for a verified event (even an unknown message id), so the provider does not retry forever.
  return { status: 200, body: { received: true, matched: outcome.matched, applied: outcome.applied } };
}
