import { randomBytes } from "node:crypto";
import { prisma } from "./prisma.js";

// A forge has its permanent vanity code (Forge.inviteCode) plus any number of extra
// invites with an expiry and/or a use limit (ForgeInvite). Both resolve here.

export type ResolvedInvite =
  | { ok: true; forgeId: string; inviteId: string | null }
  | { ok: false; status: 404 | 410; error: string };

const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateInviteCode(length = 8) {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i += 1) code += alphabet[bytes[i] % alphabet.length];
  return code;
}

export function inviteIsUsable(invite: { revokedAt: Date | null; expiresAt: Date | null; maxUses: number | null; uses: number }, now = new Date()) {
  if (invite.revokedAt) return false;
  if (invite.expiresAt && invite.expiresAt <= now) return false;
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) return false;
  return true;
}

export async function resolveInviteCode(rawCode: string): Promise<ResolvedInvite> {
  const code = rawCode.trim().toLowerCase();
  const forge = await prisma.forge.findUnique({ where: { inviteCode: code }, select: { id: true } });
  if (forge) return { ok: true, forgeId: forge.id, inviteId: null };

  const invite = await prisma.forgeInvite.findUnique({ where: { code } });
  if (!invite) return { ok: false, status: 404, error: "Invalid invite code" };
  if (!inviteIsUsable(invite)) return { ok: false, status: 410, error: "This invite has expired" };
  return { ok: true, forgeId: invite.forgeId, inviteId: invite.id };
}

/** Counts a use, atomically refusing once the limit is hit (two people can't take the last slot). */
export async function consumeInvite(inviteId: string): Promise<boolean> {
  const invite = await prisma.forgeInvite.findUnique({ where: { id: inviteId }, select: { maxUses: true } });
  if (!invite) return false;
  const now = new Date();
  const result = await prisma.forgeInvite.updateMany({
    where: {
      id: inviteId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      ...(invite.maxUses !== null ? { uses: { lt: invite.maxUses } } : {}),
    },
    data: { uses: { increment: 1 } },
  });
  return result.count === 1;
}
