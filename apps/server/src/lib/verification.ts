import crypto from "node:crypto";
import type { VerificationChannel, VerificationPurpose } from "@prisma/client";
import { prisma } from "./prisma.js";
import { sendEmail, sendSms, type DeliveryResult } from "./delivery.js";
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

const purposeCopy: Record<VerificationPurpose, { subject: string; intro: string }> = {
  VERIFY_EMAIL: { subject: "Verify your Vexora Gaming email", intro: "Use this code to verify your email address." },
  VERIFY_PHONE: { subject: "Verify your Vexora Gaming phone", intro: "Use this code to verify your phone number." },
  LOGIN: { subject: "Your Vexora Gaming sign-in code", intro: "Someone is signing in to your account. If this is you, enter this code." },
  SENSITIVE_CHANGE: { subject: "Confirm a change to your Vexora Gaming account", intro: "Use this code to confirm the change to your account." },
};

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
  const body = `${copy.intro}\n\nYour Vexora Gaming code: ${code}\n\nIt expires in 10 minutes. Never share this code with anyone; Vexora staff will never ask for it.`;
  const delivery =
    params.channel === "EMAIL"
      ? await sendEmail(params.target, copy.subject, body)
      : await sendSms(params.target, `Vexora Gaming code: ${code}. Expires in 10 min. Never share it.`);

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
    await prisma.verificationCode.update({ where: { id: match.id }, data: { consumedAt: new Date() } });
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
export function protectionSummary(user: { emailVerified: boolean; phoneVerified: boolean; twoFactorEnabled: boolean; phoneNumber?: string | null; email: string; twoFactorChannels: string[] }) {
  return {
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    phoneNumber: user.phoneNumber ? maskPhone(user.phoneNumber) : null,
    email: maskEmail(user.email),
    twoFactorEnabled: user.twoFactorEnabled,
    twoFactorChannels: user.twoFactorChannels,
    complete: user.emailVerified && user.phoneVerified && user.twoFactorEnabled,
  };
}
