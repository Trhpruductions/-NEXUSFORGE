import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { deliveryStatus } from "../lib/delivery.js";
import { issueCode, normalizePhone, protectionSummary, verifyCode } from "../lib/verification.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { authRateLimit } from "../middleware/rate-limit.js";

/**
 * Account protection: email verification, phone verification and two-factor settings.
 * Codes are 6 digits, expire in 10 minutes, and allow 5 attempts.
 */
export const verificationRouter = Router();

verificationRouter.use(requireAuth);
verificationRouter.use(requireCsrf);

const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") });
const phoneSchema = z.object({ phoneNumber: z.string().trim().min(7).max(24) });
const twoFactorSchema = z.object({
  enabled: z.boolean(),
  channels: z.array(z.enum(["EMAIL", "SMS"])).min(1).max(2).optional(),
  code: z.string().trim().regex(/^\d{6}$/).optional(),
});

const userSelect = { id: true, email: true, emailVerified: true, phoneNumber: true, phoneVerified: true, twoFactorEnabled: true, twoFactorChannels: true } as const;

verificationRouter.get("/status", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: userSelect });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ protection: protectionSummary(user), delivery: deliveryStatus() });
});

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

verificationRouter.post("/email/send", authRateLimit, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: userSelect });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.emailVerified) {
    res.json({ ok: true, alreadyVerified: true });
    return;
  }
  const result = await issueCode({ userId: user.id, channel: "EMAIL", purpose: "VERIFY_EMAIL", target: user.email });
  if (!result.ok) {
    res.status(result.retryAfterSeconds ? 429 : 502).json({ error: result.error, retryAfterSeconds: result.retryAfterSeconds });
    return;
  }
  res.json({ ok: true, sentTo: protectionSummary(user).email, transport: result.delivery?.transport, devCode: result.devCode });
});

verificationRouter.post("/email/confirm", authRateLimit, async (req, res) => {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter the 6-digit code" });
    return;
  }
  const result = await verifyCode({ userId: req.user!.id, purpose: "VERIFY_EMAIL", code: parsed.data.code, channel: "EMAIL" });
  if (!result.ok) {
    res.status(400).json({ error: result.error, attemptsLeft: result.attemptsLeft });
    return;
  }
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { emailVerified: true, emailVerifyToken: null, emailVerifyExpires: null },
    select: userSelect,
  });
  res.json({ ok: true, protection: protectionSummary(user) });
});

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

verificationRouter.post("/phone/send", authRateLimit, async (req, res) => {
  const parsed = phoneSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid phone number" });
    return;
  }
  const phone = normalizePhone(parsed.data.phoneNumber);
  if (!phone) {
    res.status(400).json({ error: "Enter a valid phone number with country code, e.g. +1 555 123 4567" });
    return;
  }
  const taken = await prisma.user.findFirst({ where: { phoneNumber: phone, id: { not: req.user!.id } }, select: { id: true } });
  if (taken) {
    res.status(409).json({ error: "That phone number is already linked to another account" });
    return;
  }
  const result = await issueCode({ userId: req.user!.id, channel: "SMS", purpose: "VERIFY_PHONE", target: phone });
  if (!result.ok) {
    res.status(result.retryAfterSeconds ? 429 : 502).json({ error: result.error, retryAfterSeconds: result.retryAfterSeconds });
    return;
  }
  res.json({ ok: true, sentTo: phone, transport: result.delivery?.transport, devCode: result.devCode });
});

verificationRouter.post("/phone/confirm", authRateLimit, async (req, res) => {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter the 6-digit code" });
    return;
  }
  const result = await verifyCode({ userId: req.user!.id, purpose: "VERIFY_PHONE", code: parsed.data.code, channel: "SMS" });
  if (!result.ok) {
    res.status(400).json({ error: result.error, attemptsLeft: result.attemptsLeft });
    return;
  }
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { phoneNumber: result.target, phoneVerified: true },
    select: userSelect,
  });
  res.json({ ok: true, protection: protectionSummary(user) });
});

verificationRouter.delete("/phone", authRateLimit, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: userSelect });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.twoFactorEnabled && user.twoFactorChannels.includes("SMS") && user.twoFactorChannels.length === 1) {
    res.status(400).json({ error: "Turn off two-factor or add email as a channel before removing your phone" });
    return;
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { phoneNumber: null, phoneVerified: false, twoFactorChannels: user.twoFactorChannels.filter((channel) => channel !== "SMS") },
    select: userSelect,
  });
  res.json({ ok: true, protection: protectionSummary(updated) });
});

// ---------------------------------------------------------------------------
// Two-factor
// ---------------------------------------------------------------------------

/** Sends a confirmation code (to every verified channel) before 2FA can be switched off. */
verificationRouter.post("/two-factor/challenge", authRateLimit, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: userSelect });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const sends = await Promise.all([
    user.emailVerified ? issueCode({ userId: user.id, channel: "EMAIL", purpose: "SENSITIVE_CHANGE", target: user.email }) : null,
    user.phoneVerified && user.phoneNumber ? issueCode({ userId: user.id, channel: "SMS", purpose: "SENSITIVE_CHANGE", target: user.phoneNumber }) : null,
  ]);
  const delivered = sends.filter((entry) => entry?.ok);
  if (!delivered.length) {
    const failed = sends.find((entry) => entry && !entry.ok);
    res.status(failed?.retryAfterSeconds ? 429 : 400).json({ error: failed?.error ?? "Verify your email or phone first" });
    return;
  }
  res.json({ ok: true, channels: delivered.map((entry) => entry?.delivery?.transport), devCode: delivered.find((entry) => entry?.devCode)?.devCode });
});

verificationRouter.put("/two-factor", authRateLimit, async (req, res) => {
  const parsed = twoFactorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: userSelect });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (parsed.data.enabled) {
    if (!user.emailVerified || !user.phoneVerified) {
      res.status(400).json({ error: "Verify both your email and phone number before turning on two-factor" });
      return;
    }
    const channels = parsed.data.channels ?? ["EMAIL", "SMS"];
    const updated = await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true, twoFactorChannels: channels }, select: userSelect });
    res.json({ ok: true, protection: protectionSummary(updated) });
    return;
  }

  // Turning 2FA off requires a fresh code so a hijacked session cannot silently weaken the account.
  if (!parsed.data.code) {
    res.status(400).json({ error: "A confirmation code is required to turn off two-factor", needsCode: true });
    return;
  }
  const check = await verifyCode({ userId: user.id, purpose: "SENSITIVE_CHANGE", code: parsed.data.code });
  if (!check.ok) {
    res.status(400).json({ error: check.error, attemptsLeft: check.attemptsLeft });
    return;
  }
  const updated = await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false }, select: userSelect });
  res.json({ ok: true, protection: protectionSummary(updated) });
});
