import { prisma } from "./prisma.js";
import { comparePassword } from "./password.js";
import { sendEmail } from "./delivery.js";

/**
 * Changing how an account is recovered (its email or phone) needs the current password,
 * so a stolen session alone can't add the attacker's number and reset the password by text.
 */
export async function confirmCurrentPassword(userId: string, password: unknown): Promise<boolean> {
  if (typeof password !== "string" || !password) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
  return Boolean(user && (await comparePassword(password, user.password)));
}

export const PASSWORD_REQUIRED = { error: "Enter your current password to make this change.", needsPassword: true } as const;

/** Tells the owner, at their (old) email, that a recovery detail changed. Never blocks the change. */
export function sendSecurityAlert(to: string, username: string, what: string) {
  void sendEmail(
    to,
    "A change was made to your Nexus Forge Gaming account",
    `Hi ${username},

${what}

If this was you, there's nothing to do. If it wasn't, reset your password right away and check Settings → Account protection.

Nexus Forge Gaming`,
  ).catch((error) => console.error("[SECURITY] alert email failed", error));
}
