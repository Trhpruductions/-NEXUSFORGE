import { prisma } from "./prisma.js";

/** Same characters @mentions understand, so every name can be mentioned. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,32}$/;

/** How long after a rename before the next one (stops name-hopping to dodge blocks and reports). */
export const USERNAME_CHANGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const RESERVED = new Set([
  "admin", "administrator", "moderator", "mod", "staff", "support", "help", "system", "official",
  "vexora", "vexoragaming", "vexora_gaming", "vexorastaff", "vexora_staff", "vexorasupport", "vexora_support",
  "nexusforge", "nexus_forge", "nexusforgegaming", "nexusforge_gaming", "nexusforgestaff", "nexusforge_staff", "nfgcord", "everyone", "here", "root", "null", "undefined", "owner", "security", "billing",
]);

export type UsernameIssue = { reason: "invalid" | "reserved"; message: string };

/** Why a proposed username can't be used, or null if the form is fine (taken is checked separately). */
export function usernameIssue(raw: string): UsernameIssue | null {
  const name = raw.trim();
  if (!USERNAME_PATTERN.test(name)) return { reason: "invalid", message: "Usernames are 3 to 32 letters, numbers or underscores." };
  if (RESERVED.has(name.toLowerCase())) return { reason: "reserved", message: "That username is reserved." };
  return null;
}

/** A problem with a proposed username, in plain words, or null if it's fine to use. */
export function usernameProblem(raw: string): string | null {
  return usernameIssue(raw)?.message ?? null;
}

/** When the username may next be changed, or null if it may be changed now. */
export function usernameCooldownEndsAt(changedAt: Date | null | undefined, now = Date.now()): Date | null {
  if (!changedAt) return null;
  const endsAt = changedAt.getTime() + USERNAME_CHANGE_COOLDOWN_MS;
  return endsAt > now ? new Date(endsAt) : null;
}

/** True when a write failed because a unique column (such as username) already holds that value. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

/** True if someone else already has this name, ignoring upper/lower case ("AtlasOps" = "atlasops"). */
export async function usernameTaken(name: string, exceptUserId?: string) {
  const found = await prisma.user.findFirst({
    where: { username: { equals: name.trim(), mode: "insensitive" }, ...(exceptUserId ? { id: { not: exceptUserId } } : {}) },
    select: { id: true },
  });
  return Boolean(found);
}
