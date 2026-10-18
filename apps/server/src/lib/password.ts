import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * A bcrypt hash (same cost as real ones) of random bytes that were thrown away when it was made.
 * No password matches it. It exists only so that checking a password for an account that doesn't
 * exist takes as long as checking one that does.
 */
const NO_ACCOUNT_HASH = "$2b$12$9qlh/yMYeH4CF.ej0jbC6eubuznY4e8stz2lk3j2C/Fp7U5XumD2S";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Checks a password against an account's hash, or, when there is no account, does the same
 * amount of work against a dummy hash and says no. Sign-in used to answer instantly for an
 * unknown email and take a quarter of a second for a known one, which told anyone which emails
 * have accounts.
 */
export async function checkPasswordOrDummy(password: string, hash: string | null | undefined): Promise<boolean> {
  if (hash) return comparePassword(password, hash);
  await bcrypt.compare(password, NO_ACCOUNT_HASH);
  return false;
}
