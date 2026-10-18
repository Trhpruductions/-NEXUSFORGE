import { prisma } from "./prisma.js";
import { clearTotpFailures, decryptSecret, hashRecoveryCode, looksLikeRecoveryCode, recordTotpFailure, totpLocked, verifyTotp } from "./totp.js";

export type SecondFactorResult = { ok: true; usedRecoveryCode: boolean; recoveryCodesLeft: number } | { ok: false; status: 400 | 429; error: string };

/**
 * Checks an authenticator code or a one-time recovery code for a user with app-based
 * two-factor on. A matched code can't be used again; a used recovery code is spent.
 */
export async function checkSecondFactor(userId: string, input: string): Promise<SecondFactorResult> {
  if (totpLocked(userId)) return { ok: false, status: 429, error: "Too many wrong codes. Wait 15 minutes and try again." };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { totpSecretEnc: true, totpLastStep: true, totpRecoveryHashes: true } });
  const secret = user?.totpSecretEnc ? decryptSecret(user.totpSecretEnc) : null;
  if (!user || !secret) return { ok: false, status: 400, error: "Authenticator app isn't set up" };

  const code = input.trim();
  if (/^\d{6}$/.test(code)) {
    const step = verifyTotp(secret, code, user.totpLastStep);
    if (step !== null) {
      // Conditional write: two requests racing with the same code can't both win.
      const claimed = await prisma.user.updateMany({
        where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
        data: { totpLastStep: step },
      });
      if (claimed.count === 1) {
        clearTotpFailures(userId);
        return { ok: true, usedRecoveryCode: false, recoveryCodesLeft: user.totpRecoveryHashes.length };
      }
    }
  } else if (looksLikeRecoveryCode(code)) {
    const hash = hashRecoveryCode(code);
    if (user.totpRecoveryHashes.includes(hash)) {
      const remaining = user.totpRecoveryHashes.filter((entry) => entry !== hash);
      const claimed = await prisma.user.updateMany({
        where: { id: userId, totpRecoveryHashes: { has: hash } },
        data: { totpRecoveryHashes: remaining },
      });
      if (claimed.count === 1) {
        clearTotpFailures(userId);
        return { ok: true, usedRecoveryCode: true, recoveryCodesLeft: remaining.length };
      }
    }
  }
  recordTotpFailure(userId);
  return { ok: false, status: 400, error: "That code didn't work. Check your authenticator app, or use a recovery code." };
}
