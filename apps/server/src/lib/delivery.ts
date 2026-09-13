import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";

/**
 * Outbound delivery for verification codes.
 *
 * Email goes through SMTP when SMTP_HOST is configured. SMS goes through Twilio when the
 * account SID, auth token and a sender are configured. When a channel is not configured:
 *   - in development the message is printed to the server console so the flow can be tested,
 *   - in production the send fails loudly so nobody is left believing a code went out.
 */

export type DeliveryResult = { delivered: boolean; transport: "smtp" | "twilio" | "console"; error?: string };

let transporter: Transporter | null = null;

function smtpConfigured() {
  return Boolean(env.SMTP_HOST);
}

function twilioConfigured() {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && (env.TWILIO_FROM_NUMBER || env.TWILIO_MESSAGING_SERVICE_SID));
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export function deliveryStatus() {
  return {
    email: smtpConfigured() ? "smtp" : env.NODE_ENV === "production" ? "unconfigured" : "console",
    sms: twilioConfigured() ? "twilio" : env.NODE_ENV === "production" ? "unconfigured" : "console",
  } as const;
}

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<DeliveryResult> {
  if (smtpConfigured()) {
    try {
      await getTransporter().sendMail({ from: env.MAIL_FROM, to, subject, text, html: html ?? `<pre style="font-family:system-ui;font-size:15px">${text}</pre>` });
      return { delivered: true, transport: "smtp" };
    } catch (error) {
      return { delivered: false, transport: "smtp", error: error instanceof Error ? error.message : "SMTP send failed" };
    }
  }
  if (env.NODE_ENV === "production") {
    return { delivered: false, transport: "console", error: "Email delivery is not configured (SMTP_HOST missing)" };
  }
  console.log(`\n[DEV MAIL] to=${to}\n[DEV MAIL] subject=${subject}\n[DEV MAIL] ${text.replace(/\n/g, "\n[DEV MAIL] ")}\n`);
  return { delivered: true, transport: "console" };
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
