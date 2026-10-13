import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { evaluateAchievements } from "../lib/achievements.js";
import { deliveryStatus } from "../lib/delivery.js";
import { issueCode, maskPhone, normalizePhone, protectionSummary, verifyCode } from "../lib/verification.js";
import { PASSWORD_REQUIRED, confirmCurrentPassword, sendSecurityAlert } from "../lib/reauth.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { authRateLimit } from "../middleware/rate-limit.js";
import { comparePassword } from "../lib/password.js";
import { checkSecondFactor } from "../lib/second-factor.js";
import { decryptSecret, encryptSecret, generateRecoveryCodes, generateTotpSecret, otpauthUrl, verifyTotp } from "../lib/totp.js";

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

const userSelect = { id: true, email: true, emailVerified: true, phoneNumber: true, phoneVerified: true, twoFactorEnabled: true, twoFactorChannels: true, totpEnabledAt: true, totpRecoveryHashes: true } as const;

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
  if (!(await confirmCurrentPassword(req.user!.id, req.body?.password))) {
    res.status(403).json(PASSWORD_REQUIRED);
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
  const before = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { email: true, username: true, phoneNumber: true, phoneVerified: true } });
  let user;
  try {
    user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { phoneNumber: result.target, phoneVerified: true },
      select: userSelect,
    });
    if (user.twoFactorEnabled && !user.twoFactorChannels.includes("SMS")) {
      user = await prisma.user.update({ where: { id: user.id }, data: { twoFactorChannels: [...user.twoFactorChannels, "SMS"] }, select: userSelect });
    }
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      res.status(409).json({ error: "That phone number is already linked to another account" });
      return;
    }
    throw error;
  }
  if (before && before.phoneNumber !== result.target) {
    sendSecurityAlert(before.email, before.username, `The phone number ${maskPhone(result.target)} was added to your account${before.phoneVerified && before.phoneNumber ? `, replacing ${maskPhone(before.phoneNumber)}` : ""}. It can now be used to sign in and reset your password.`);
  }
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
  if (!(await confirmCurrentPassword(user.id, req.body?.password))) {
    res.status(403).json(PASSWORD_REQUIRED);
    return;
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { phoneNumber: null, phoneVerified: false, twoFactorChannels: user.twoFactorChannels.filter((channel) => channel !== "SMS") },
    select: userSelect,
  });
  if (user.phoneNumber) {
    const owner = await prisma.user.findUnique({ where: { id: user.id }, select: { username: true } });
    sendSecurityAlert(user.email, owner?.username ?? "there", `The phone number ${maskPhone(user.phoneNumber)} was removed from your account.`);
  }
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
    if (!user.emailVerified) {
      res.status(400).json({ error: "Verify your email before turning on two-factor" });
      return;
    }
    // Codes go only to channels that are actually verified.
    const requested = parsed.data.channels ?? ["EMAIL", "SMS"];
    const channels = requested.filter((channel) => (channel === "SMS" ? user.phoneVerified : true));
    if (!channels.length) {
      res.status(400).json({ error: "Verify your phone number first, or choose email codes" });
      return;
    }
    const updated = await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true, twoFactorChannels: channels }, select: userSelect });
    void evaluateAchievements(user.id);
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

// ---------------------------------------------------------------------------
// Authenticator app (TOTP)
// ---------------------------------------------------------------------------

const passwordSchema = z.object({ password: z.string().min(1).max(200) });
const anyCodeSchema = z.object({ code: z.string().trim().min(6).max(12) });

/** Step 1: confirm the password, get a fresh secret to scan. Nothing changes until step 2. */
verificationRouter.post("/two-factor/totp/setup", authRateLimit, async (req, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter your password" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { password: true, username: true, totpEnabledAt: true } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (!(await comparePassword(parsed.data.password, user.password))) {
    res.status(403).json({ error: "That password isn't right" });
    return;
  }
  if (user.totpEnabledAt) {
    res.status(400).json({ error: "An authenticator app is already set up. Turn it off first to switch apps." });
    return;
  }
  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: req.user!.id }, data: { totpPendingEnc: encryptSecret(secret) } });
  res.json({ secret, otpauthUrl: otpauthUrl(secret, user.username) });
});

/** Step 2: prove the app works by entering its current code. Returns recovery codes, shown once. */
verificationRouter.post("/two-factor/totp/enable", authRateLimit, async (req, res) => {
  const parsed = codeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter the 6-digit code from your app" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { totpPendingEnc: true, totpEnabledAt: true } });
  const secret = user?.totpPendingEnc ? decryptSecret(user.totpPendingEnc) : null;
  if (!user || !secret || user.totpEnabledAt) {
    res.status(400).json({ error: "Start the setup again" });
    return;
  }
  const step = verifyTotp(secret, parsed.data.code, null);
  if (step === null) {
    res.status(400).json({ error: "That code didn't match. Check the time on your phone is set automatically, then try the newest code." });
    return;
  }
  const recovery = generateRecoveryCodes();
  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: { totpSecretEnc: encryptSecret(secret), totpPendingEnc: null, totpEnabledAt: new Date(), totpLastStep: step, totpRecoveryHashes: recovery.hashes },
    select: userSelect,
  });
  void evaluateAchievements(req.user!.id);
  res.json({ ok: true, recoveryCodes: recovery.codes, protection: protectionSummary(updated) });
});

/** Turning it off needs a current app code (or a recovery code), so a stolen session can't. */
verificationRouter.post("/two-factor/totp/disable", authRateLimit, async (req, res) => {
  const parsed = anyCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a code from your app or a recovery code" });
    return;
  }
  const check = await checkSecondFactor(req.user!.id, parsed.data.code);
  if (!check.ok) {
    res.status(check.status).json({ error: check.error });
    return;
  }
  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: { totpSecretEnc: null, totpPendingEnc: null, totpEnabledAt: null, totpLastStep: null, totpRecoveryHashes: [] },
    select: userSelect,
  });
  res.json({ ok: true, protection: protectionSummary(updated) });
});

/** New set of recovery codes (the old ones stop working). */
verificationRouter.post("/two-factor/totp/recovery-codes", authRateLimit, async (req, res) => {
  const parsed = anyCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a code from your app" });
    return;
  }
  const check = await checkSecondFactor(req.user!.id, parsed.data.code);
  if (!check.ok) {
    res.status(check.status).json({ error: check.error });
    return;
  }
  const recovery = generateRecoveryCodes();
  const updated = await prisma.user.update({ where: { id: req.user!.id }, data: { totpRecoveryHashes: recovery.hashes }, select: userSelect });
  res.json({ ok: true, recoveryCodes: recovery.codes, protection: protectionSummary(updated) });
});
