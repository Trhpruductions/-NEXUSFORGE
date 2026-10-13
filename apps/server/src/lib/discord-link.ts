/**
 * Linking a Discord account to a Vexora account, proven both ways:
 * 1. In Vexora settings you get a one-time code (only you can see it, you're signed in).
 * 2. You type `/link <code>` to the Vexora bot in Discord (only you can do that as you).
 * The bot then trusts `User.discordUserId` and nothing else: not usernames and not the
 * free-text "Discord" handle on profiles, which anyone can type.
 */
import { createHash, randomInt } from "node:crypto";
import { prisma } from "./prisma.js";

export const LINK_CODE_TTL_MS = 10 * 60 * 1000;
// No 0/O/1/I so codes are easy to read and type.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const hash = (code: string) => createHash("sha256").update(code.trim().toUpperCase()).digest("hex");

export function generateLinkCode(length = 8) {
  let code = "";
  for (let i = 0; i < length; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** A fresh code for this user (any earlier unused code stops working). */
export async function createLinkCode(userId: string) {
  const code = generateLinkCode();
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
  await prisma.$transaction([
    prisma.discordLinkCode.deleteMany({ where: { userId } }),
    prisma.discordLinkCode.create({ data: { codeHash: hash(code), userId, expiresAt } }),
  ]);
  return { code, expiresAt };
}

export type RedeemResult = { ok: true; username: string } | { ok: false; reason: "invalid" | "expired" };

/** Called by the bot's /link command with the Discord user's own id. */
export async function redeemLinkCode(code: string, discordUserId: string): Promise<RedeemResult> {
  if (!/^[A-Za-z0-9]{6,12}$/.test(code.trim())) return { ok: false, reason: "invalid" };
  return prisma.$transaction(async (tx) => {
    const row = await tx.discordLinkCode.findUnique({ where: { codeHash: hash(code) }, include: { user: { select: { id: true, username: true, deletedAt: true } } } });
    if (!row || row.user.deletedAt) return { ok: false as const, reason: "invalid" as const };
    await tx.discordLinkCode.delete({ where: { codeHash: row.codeHash } });
    if (row.expiresAt.getTime() < Date.now()) return { ok: false as const, reason: "expired" as const };
    // One Discord account maps to one Vexora account: move it if it was linked elsewhere.
    await tx.user.updateMany({ where: { discordUserId, NOT: { id: row.userId } }, data: { discordUserId: null, discordLinkedAt: null } });
    await tx.user.update({ where: { id: row.userId }, data: { discordUserId, discordLinkedAt: new Date() } });
    return { ok: true as const, username: row.user.username };
  });
}

/** The Vexora account this Discord user proved they own, or null. */
export async function userForDiscord(discordUserId: string) {
  return prisma.user.findFirst({ where: { discordUserId, deletedAt: null } });
}

export async function unlinkDiscord(userId: string) {
  await prisma.$transaction([
    prisma.discordLinkCode.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { discordUserId: null, discordLinkedAt: null } }),
  ]);
}
