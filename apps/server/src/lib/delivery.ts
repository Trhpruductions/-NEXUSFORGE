import { env } from "../config/env.js";
import { brandedEmailHtml, senderAddress } from "./email-template.js";
import { createEmailPipeline, type EmailMode } from "./email-pipeline.js";
import { emailContextFromEnv, type EmailKindData } from "./email-templates.js";
import { smtpSend, testSend, getSmtpTransporter } from "./email-transports.js";
import { prismaEmailStore, userOptedIn } from "./email-store.js";
import { issueUnsubscribeToken, unsubscribeKey } from "./email-tokens.js";
import { resolveEmailMode, type EmailCategory, type EmailKind, type OptionalPreferenceKey } from "./email-policy.js";

/**
 * Outbound delivery for verification codes and account mail.
 *
 * Email goes through SMTP when SMTP_HOST is configured and EMAIL_TEST_MODE is off. In test mode (or
 * with no SMTP outside production) mail goes through nodemailer's JSON transport: nothing leaves the
 * process, but every send is still recorded. SMS goes through Twilio when the account SID, auth token
 * and a sender are configured. When a channel is not configured:
 *   - in development the message is printed to the server console so the flow can be tested,
 *   - in production the send fails loudly so nobody is left believing a code went out.
 *
 * `delivered` only means the SMTP server accepted the message. It does not mean the inbox received it.
 * Real delivery is only confirmed by a provider webhook (see routes/email.routes.ts).
 */

export type DeliveryResult = {
  delivered: boolean;
  transport: "smtp" | "twilio" | "console" | "test";
  error?: string;
  suppressed?: boolean;
  skipped?: "not-subscribed";
};

function twilioConfigured() {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && (env.TWILIO_FROM_NUMBER || env.TWILIO_MESSAGING_SERVICE_SID));
}

/** smtp, test (JSON transport), or unconfigured (production without SMTP: sends fail loudly). */
export function emailMode(): EmailMode {
  return resolveEmailMode({ testMode: env.EMAIL_TEST_MODE, smtpHost: env.SMTP_HOST, production: env.NODE_ENV === "production" });
}

/** Opens and checks the SMTP connection once at boot (sends nothing), so the first sign-up doesn't pay the connection cost. */
export async function warmUpEmailDelivery(): Promise<void> {
  const mode = emailMode();
  if (mode === "test") {
    if (env.NODE_ENV === "production") {
      console.error("[mail] EMAIL_TEST_MODE is on in production: mail is recorded but nothing reaches an inbox.");
    } else {
      console.log("[mail] test mode: emails are recorded, nothing leaves the process");
    }
    return;
  }
  if (mode !== "smtp") {
    if (env.NODE_ENV === "production") console.error("[mail] SMTP is not configured: verification emails will not go out.");
    return;
  }
  const started = Date.now();
  try {
    await getSmtpTransporter().verify();
    console.log(`[mail] SMTP ready (${env.SMTP_HOST}, ${Date.now() - started} ms)`);
  } catch (error) {
    console.error(`[mail] SMTP check failed, verification emails will not go out: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Status shown to the sign-in pages and to the admin. `email` keeps its old values. `emailMode`
 * says exactly what is happening: smtp, test, or unconfigured.
 */
export function deliveryStatus() {
  const mode = emailMode();
  return {
    // A test mode in production reads as "unconfigured": nothing real goes out, so no email options are offered.
    email: mode === "smtp" ? "smtp" : mode === "test" && env.NODE_ENV !== "production" ? "console" : "unconfigured",
    emailMode: mode,
    sms: twilioConfigured() ? "twilio" : env.NODE_ENV === "production" ? "unconfigured" : "console",
  } as const;
}

let unsubscribeSigningKey: Buffer | null = null;

/** Signed link for one optional kind. Points at the API, because the web app does not proxy /api. */
export function buildUnsubscribeUrl(userId: string, key: OptionalPreferenceKey): string {
  if (!unsubscribeSigningKey) {
    unsubscribeSigningKey = unsubscribeKey({ explicit: env.EMAIL_UNSUBSCRIBE_SECRET, fallbackSecret: env.JWT_ACCESS_SECRET });
  }
  const token = issueUnsubscribeToken(unsubscribeSigningKey, userId, key, Date.now());
  const base = (env.API_PUBLIC_URL || env.APP_WEB_URL).replace(/\/+$/, "");
  return `${base}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
}

export const emailPipeline = createEmailPipeline({
  store: prismaEmailStore,
  transports: { smtp: smtpSend, test: testSend },
  mode: emailMode,
  context: emailContextFromEnv,
  sender: senderAddress,
  replyTo: () => env.MAIL_REPLY_TO,
  isOptedIn: userOptedIn,
  unsubscribeUrl: buildUnsubscribeUrl,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
  log: (line) => console.log(line),
});

export type EmailSendMeta = {
  /** Template key or a free label, recorded with the delivery. Defaults to "legacy". */
  kind?: string;
  /** Defaults to ESSENTIAL, which is never gated by preferences. */
  category?: EmailCategory;
  userId?: string | null;
};

/**
 * Sends a plain or pre-rendered email. Existing call sites keep working unchanged. Pass `meta` to get
 * a named delivery record and duplicate protection for the account.
 */
export async function sendEmail(to: string, subject: string, text: string, html?: string, meta: EmailSendMeta = {}): Promise<DeliveryResult> {
  return emailPipeline.sendMessage({
    kind: meta.kind ?? "legacy",
    category: meta.category ?? "ESSENTIAL",
    to,
    subject,
    text,
    html: html ?? brandedEmailHtml(subject, text),
    userId: meta.userId ?? null,
  });
}

/** Renders a named template and sends it. Optional kinds only go to accounts that opted in. */
export function sendTemplateEmail<K extends EmailKind>(kind: K, to: string, data: EmailKindData[K], options: { userId?: string | null } = {}): Promise<DeliveryResult> {
  return emailPipeline.sendTemplate(kind, to, data, options);
}

/** Seconds until an identical essential email to this account is allowed again (0 = now). */
export function duplicateWaitSeconds(userId: string, kind: string, subject: string): Promise<number> {
  return emailPipeline.duplicateWaitSeconds(userId, kind, subject);
}

export async function sendSms(to: string, body: string): Promise<DeliveryResult> {
  if (twilioConfigured()) {
    try {
      const params = new URLSearchParams({ To: to, Body: body });
      if (env.TWILIO_MESSAGING_SERVICE_SID) params.set("MessagingServiceSid", env.TWILIO_MESSAGING_SERVICE_SID);
      else params.set("From", env.TWILIO_FROM_NUMBER!);
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { message?: string } | null;
        return { delivered: false, transport: "twilio", error: detail?.message ?? `Twilio responded ${response.status}` };
      }
      return { delivered: true, transport: "twilio" };
    } catch (error) {
      return { delivered: false, transport: "twilio", error: error instanceof Error ? error.message : "SMS send failed" };
    }
  }
  if (env.NODE_ENV === "production") {
    return { delivered: false, transport: "console", error: "SMS delivery is not configured (Twilio credentials missing)" };
  }
  console.log(`\n[DEV SMS] to=${to}\n[DEV SMS] ${body}\n`);
  return { delivered: true, transport: "console" };
}
