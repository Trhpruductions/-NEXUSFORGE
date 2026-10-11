import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

// The server audit log: who did what to whom. Writing is best-effort so a logging
// failure never blocks the moderation action itself.

export type ForgeAuditAction =
  | "forge.update"
  | "forge.transfer"
  | "channel.create"
  | "channel.update"
  | "channel.delete"
  | "role.create"
  | "role.update"
  | "role.delete"
  | "member.roles"
  | "member.nickname"
  | "member.kick"
  | "member.timeout"
  | "member.untimeout"
  | "ban.create"
  | "ban.delete"
  | "invite.create"
  | "invite.revoke"
  | "message.delete"
  | "message.pin"
  | "message.unpin";

export type AuditTarget = { type: "forge" | "channel" | "role" | "member" | "invite" | "message"; id?: string; label?: string };

export async function logForgeAction(
  forgeId: string,
  actorId: string,
  action: ForgeAuditAction,
  target?: AuditTarget,
  details?: Record<string, unknown>,
) {
  try {
    await prisma.forgeAuditEntry.create({
      data: {
        forgeId,
        actorId,
        action,
        targetType: target?.type,
        targetId: target?.id,
        targetLabel: target?.label?.slice(0, 120),
        details: details ? (JSON.parse(JSON.stringify(details)) as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch (error) {
    console.warn("[audit] could not record", action, error instanceof Error ? error.message : error);
  }
}
