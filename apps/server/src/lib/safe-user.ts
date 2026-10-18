/**
 * Never send these User fields to a client: credentials, secrets, tokens and private
 * contact details. Use `safeUser(row)` whenever a route returns a raw `prisma.user` row.
 */
const SECRET_USER_FIELDS = [
  "password",
  "resetToken",
  "resetTokenExpires",
  "emailVerifyToken",
  "emailVerifyExpires",
  "totpSecretEnc",
  "totpPendingEnc",
  "totpLastStep",
  "totpRecoveryHashes",
  "phoneNumber",
  "birthdate",
  "email",
] as const;

export function safeUser<T extends Record<string, unknown>>(user: T): Omit<T, (typeof SECRET_USER_FIELDS)[number]> {
  const copy: Record<string, unknown> = { ...user };
  for (const field of SECRET_USER_FIELDS) delete copy[field];
  return copy as Omit<T, (typeof SECRET_USER_FIELDS)[number]>;
}
