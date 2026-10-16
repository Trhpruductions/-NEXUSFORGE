/**
 * The two ways mail leaves (or doesn't leave) the process:
 *   - SMTP, pooled, for real delivery when SMTP_HOST is set and test mode is off.
 *   - nodemailer's JSON transport for test mode. It builds the message and never opens a socket.
 */
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";
import type { MailMessage, TransportSend } from "./email-pipeline.js";

let smtpTransporter: Transporter | null = null;
let testTransporter: Transporter | null = null;

export function getSmtpTransporter(): Transporter {
  if (!smtpTransporter) {
    // Pooled: the SMTP connection (TLS handshake + login, 1-3 s on Gmail) is reused between
    // sends instead of being rebuilt for every code, so sign-up and resend answer faster.
    smtpTransporter = nodemailer.createTransport({
      pool: true,
      maxConnections: 2,
      maxMessages: 100,
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      connectionTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }
  return smtpTransporter;
}

function getTestTransporter(): Transporter {
  if (!testTransporter) {
    testTransporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return testTransporter;
}

function toNodemailer(message: MailMessage) {
  return {
    from: message.from,
    ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    ...(message.headers ? { headers: message.headers } : {}),
  };
}

export const smtpSend: TransportSend = async (message) => {
  const info = await getSmtpTransporter().sendMail(toNodemailer(message));
  return { messageId: info.messageId };
};

export const testSend: TransportSend = async (message) => {
  // The JSON transport only builds the message. Nothing is opened, nothing is sent.
  const info = await getTestTransporter().sendMail(toNodemailer(message));
  // Outside production, print the text so a developer can read a code. In production this never prints.
  if (env.NODE_ENV !== "production") {
    console.log(`\n[DEV MAIL] to=${message.to}\n[DEV MAIL] subject=${message.subject}\n[DEV MAIL] ${message.text.replace(/\n/g, "\n[DEV MAIL] ")}\n`);
  }
  return { messageId: info.messageId };
};
