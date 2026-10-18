/**
 * Changing the account email, as two steps: request (a 6-digit code goes to the NEW address), then
 * confirm (the code is checked, the address is switched, and a notice goes to the OLD address).
 *
 * Pure logic. The database, code issuing and mail are injected, so the flow is tested with stubs.
 * The route in account.routes.ts wires the real Prisma-backed versions.
 */
import { maskRecipient as maskEmail } from "./email-status.js";

export const EMAIL_CHANGE_SENT_MESSAGE = "If that address can be used, we've sent a 6-digit code to it. It works for 10 minutes.";

export type ChangeResponse = { status: number; body: Record<string, unknown> };

export type EmailChangeDeps = {
  findAccount(userId: string): Promise<{ id: string; username: string; email: string } | null>;
  isEmailTaken(email: string, exceptUserId: string): Promise<boolean>;
  /** Seconds until this account may request another change code (0 = now). Address-independent. */
  cooldownSeconds(userId: string): Promise<number>;
  /** Issues and sends a code. Called only for a free address, after the answer has been decided. */
  issueCode(input: { userId: string; target: string }): Promise<{ ok: boolean; retryAfterSeconds?: number; error?: string }>;
  checkCode(input: { userId: string; code: string }): Promise<{ ok: true; target: string } | { ok: false; error: string; attemptsLeft?: number }>;
  /** Switches the address. Returns "taken" when a concurrent request claimed it first (unique-constraint race). */
  applyEmail(input: { userId: string; email: string }): Promise<{ ok: true } | { ok: false; reason: "taken" }>;
  /** Security notice to the OLD address. Never blocks the change. */
  notifyOldAddress(input: { userId: string; to: string; username: string; newEmailMasked: string; at: Date }): void;
  now?: () => Date;
};

/**
 * Step 1. The answer must not reveal whether an address has an account, so every check that can
 * differ between a taken address and a free one is made the same way for both:
 *   - the cooldown is checked first, for everyone (it depends on the account, not the address);
 *   - a taken or current address gets the same answer and does no further work;
 *   - a free address gets the same answer, and its code is sent after the answer is decided, so
 *     mail delivery time does not show up in the response time either.
 */
export async function requestEmailChange(deps: EmailChangeDeps, input: { userId: string; newEmail: string }): Promise<ChangeResponse> {
  const account = await deps.findAccount(input.userId);
  if (!account) return { status: 404, body: { error: "Account not found" } };

  const wait = await deps.cooldownSeconds(account.id);
  if (wait > 0) {
    return { status: 429, body: { error: "Please wait before requesting another code", retryAfterSeconds: wait } };
  }

  const target = input.newEmail.trim().toLowerCase();
  const unavailable = target === account.email.toLowerCase() || (await deps.isEmailTaken(target, account.id));
  if (!unavailable) {
    // Fire and forget: a failure is logged here, never shown to the requester.
    deps.issueCode({ userId: account.id, target }).catch((error: unknown) => console.error("[ACCOUNT] email change code failed", error));
  }
  return { status: 200, body: { ok: true, message: EMAIL_CHANGE_SENT_MESSAGE } };
}

/** Step 2. Checks the code, switches the address, and tells the old address. */
export async function confirmEmailChange(deps: EmailChangeDeps, input: { userId: string; code: string }): Promise<ChangeResponse> {
  const before = await deps.findAccount(input.userId);
  if (!before) return { status: 404, body: { error: "Account not found" } };

  const check = await deps.checkCode({ userId: input.userId, code: input.code });
  if (!check.ok) {
    return { status: 400, body: { error: check.error, ...(check.attemptsLeft !== undefined ? { attemptsLeft: check.attemptsLeft } : {}) } };
  }

  const target = check.target.trim().toLowerCase();
  const applied = await deps.applyEmail({ userId: input.userId, email: target });
  if (!applied.ok) {
    return { status: 409, body: { error: "That email is already in use" } };
  }

  const newEmailMasked = maskEmail(target);
  deps.notifyOldAddress({
    userId: before.id,
    to: before.email,
    username: before.username,
    newEmailMasked,
    at: deps.now?.() ?? new Date(),
  });
  return { status: 200, body: { ok: true, email: newEmailMasked, emailVerified: true } };
}
