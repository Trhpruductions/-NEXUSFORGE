import { prisma } from "./prisma.js";

/** Same characters @mentions understand, so every name can be mentioned. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,32}$/;

/** How long after a rename before the next one (stops name-hopping to dodge blocks and reports). */
export const USERNAME_CHANGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const RESERVED = new Set([
  "admin", "administrator", "moderator", "mod", "staff", "support", "help", "system", "official",
  "vexora", "vexoragaming", "vexora_gaming", "vexorastaff", "vexora_staff", "vexorasupport", "vexora_support",
  "nexusforge", "everyone", "here", "root", "null", "undefined", "owner", "security", "billing",
]);

/** A problem with a proposed username, in plain words, or null if it's fine to use. */
export function usernameProblem(raw: string): string | null {
  const name = raw.trim();
  if (!USERNAME_PATTERN.test(name)) return "Usernames are 3 to 32 letters, numbers or underscores.";
  if (RESERVED.has(name.toLowerCase())) return "That username is reserved.";
  return null;
}

/** True if someone else already has this name, ignoring upper/lower case ("AtlasOps" = "atlasops"). */
export async function usernameTaken(name: string, exceptUserId?: string) {
  const found = await prisma.user.findFirst({
    where: { username: { equals: name.trim(), mode: "insensitive" }, ...(exceptUserId ? { id: { not: exceptUserId } } : {}) },
    select: { id: true },
  });
  return Boolean(found);
}
