import crypto from "node:crypto";
import type { VerificationChannel, VerificationPurpose } from "@prisma/client";
import { prisma } from "./prisma.js";
import { sendEmail, sendSms, type DeliveryResult } from "./delivery.js";
import { codeEmailHtml } from "./email-template.js";
import { env } from "../config/env.js";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 45 * 1000;
export const MAX_ATTEMPTS = 5;

function hashCode(userId: string, code: string) {
  return crypto.createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Normalize to E.164. Accepts "+1 (555) 123-4567", "555-123-4567" (assumes +1) and similar. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  let value = digits.startsWith("+") ? digits : digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : `+${digits}`;
  value = value.replace(/(?!^)\+/g, "");
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : null;
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 2)}${"•".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

export function maskPhone(phone: string) {
  return `${phone.slice(0, 3)}${"•".repeat(Math.max(3, phone.length - 5))}${phone.slice(-2)}`;
}

// Warm, plain wording: say what the code is for, and what to do if it wasn't the person asking.
const purposeCopy: Record<VerificationPurpose, { subject: string; intro: string }> = {
  VERIFY_EMAIL: { subject: "Welcome! Confirm your email", intro: "Welcome to Nexus Forge Gaming. Enter this code to confirm your email address and get started." },
  VERIFY_PHONE: { subject: "Confirm your phone number", intro: "Enter this code to confirm your phone number." },
  LOGIN: { subject: "Your sign-in code", intro: "Someone is trying to sign in to your account. If that's you, enter this code. If it isn't, change your password right away." },
  SENSITIVE_CHANGE: { subject: "Confirm your account change", intro: "You asked to change something on your account. Enter this code to confirm it." },
  RESET_PASSWORD: { subject: "Reset your password", intro: "Enter this code to choose a new password. If you didn't ask for this, you can ignore this email. Your password stays the same until you set a new one." },
};

const CODE_FOOTNOTE = "This code expires in 10 minutes. Never share it with anyone, including Nexus Forge staff. We will never ask for it.";

export type IssueResult = {
  ok: boolean;
  delivery?: DeliveryResult;
  retryAfterSeconds?: number;
  error?: string;
  /** Only present outside production when delivery falls back to the console. */
  devCode?: string;
};

/** Create and deliver a fresh code, invalidating any earlier code for the same user, purpose and channel. */
export async function issueCode(params: {
  userId: string;
  channel: VerificationChannel;
  purpose: VerificationPurpose;
  target: string;
}): Promise<IssueResult> {
  const recent = await prisma.verificationCode.findFirst({
    where: { userId: params.userId, channel: params.channel, purpose: params.purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - recent.createdAt.getTime())) / 1000), error: "Please wait before requesting another code" };
  }

  const code = generateCode();
  await prisma.$transaction([
    prisma.verificationCode.updateMany({
      where: { userId: params.userId, channel: params.channel, purpose: params.purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.verificationCode.create({
      data: {
        userId: params.userId,
        channel: params.channel,
        purpose: params.purpose,
        target: params.target,
        codeHash: hashCode(params.userId, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    }),
  ]);

  const copy = purposeCopy[params.purpose];
  // The email gets a styled code box; the plain-text part carries the same words for mail apps that show text only.
  const body = `${copy.intro}\n\nYour code: ${code}\n\n${CODE_FOOTNOTE}`;
  const delivery =
    params.channel === "EMAIL"
      ? await sendEmail(params.target, copy.subject, body, codeEmailHtml({ subject: copy.subject, intro: copy.intro, code, footnote: CODE_FOOTNOTE }))
      : await sendSms(params.target, `Nexus Forge code: ${code}. It expires in 10 minutes. Don't share it, not even with Nexus Forge staff.`);

  if (!delivery.delivered) {
    return { ok: false, delivery, error: delivery.error };
  }

  return {
    ok: true,
    delivery,
    ...(delivery.transport === "console" && env.NODE_ENV !== "production" ? { devCode: code } : {}),
  };
}

export type VerifyResult = { ok: true; channel: VerificationChannel; target: string } | { ok: false; error: string; attemptsLeft?: number };

/** Check a code for a purpose across any channel. Consumes it on success, counts attempts on failure. */
export async function verifyCode(params: { userId: string; purpose: VerificationPurpose; code: string; channel?: VerificationChannel }): Promise<VerifyResult> {
  const candidates = await prisma.verificationCode.findMany({
    where: {
      userId: params.userId,
      purpose: params.purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      ...(params.channel ? { channel: params.channel } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  if (!candidates.length) {
    return { ok: false, error: "No active code. Request a new one." };
  }

  const hash = hashCode(params.userId, params.code.trim());
  const match = candidates.find((entry) => entry.codeHash === hash && entry.attempts < MAX_ATTEMPTS);
  if (match) {
    // One confirmation is one use: the copy sent to the other channel (email vs text) is used
    // up too, so it can't be replayed and doesn't block the next request with "please wait".
    await prisma.verificationCode.updateMany({
      where: { id: { in: candidates.map((entry) => entry.id) } },
      data: { consumedAt: new Date() },
    });
    return { ok: true, channel: match.channel, target: match.target };
  }

  // Count the failed attempt against every live code for this purpose.
  await prisma.verificationCode.updateMany({
    where: { id: { in: candidates.map((entry) => entry.id) } },
    data: { attempts: { increment: 1 } },
  });
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - (Math.min(...candidates.map((entry) => entry.attempts)) + 1));
  if (attemptsLeft === 0) {
    await prisma.verificationCode.updateMany({ where: { id: { in: candidates.map((entry) => entry.id) } }, data: { consumedAt: new Date() } });
    return { ok: false, error: "Too many wrong codes. Request a new one.", attemptsLeft: 0 };
  }
  return { ok: false, error: "That code is not right.", attemptsLeft };
}

/** Whether the user has completed the account-protection checklist. */
export function protectionSummary(user: {
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  phoneNumber?: string | null;
  email: string;
  twoFactorChannels: string[];
  totpEnabledAt?: Date | null;
  totpRecoveryHashes?: string[];
}) {
  const totpEnabled = Boolean(user.totpEnabledAt);
  return {
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    phoneNumber: user.phoneNumber ? maskPhone(user.phoneNumber) : null,
    email: maskEmail(user.email),
    twoFactorEnabled: user.twoFactorEnabled,
    twoFactorChannels: user.twoFactorChannels,
    totpEnabled,
    recoveryCodesLeft: totpEnabled ? user.totpRecoveryHashes?.length ?? 0 : 0,
    // Verified email plus a second step at sign-in (authenticator app, or codes by email/text).
    // A phone is a welcome extra but not required, since texts aren't available everywhere.
    complete: user.emailVerified && (totpEnabled || user.twoFactorEnabled),
  };
}
