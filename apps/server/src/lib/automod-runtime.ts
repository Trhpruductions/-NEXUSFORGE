import { prisma } from "./prisma.js";
import { createNotification } from "./notifications.js";
import { logForgeAction } from "./forge-audit.js";
import { evictUserFromChannels } from "./realtime.js";
import { hasForgePermission, resolveForgeAccess } from "./forge-permissions.js";
import { evaluateAutoMod, type AutoModRule, type AutoModType } from "./automod.js";
import type { MemberContext } from "./channel-access.js";

/** Rules are read on every message, so keep them briefly in memory (cleared on any change). */
const cache = new Map<string, { at: number; rules: AutoModRule[]; inviteCodes: string[] }>();
const CACHE_MS = 30_000;

export function clearAutoModCache(forgeId: string) {
  cache.delete(forgeId);
}

async function loadRules(forgeId: string) {
  const hit = cache.get(forgeId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;
  const [rows, forge, invites] = await Promise.all([
    prisma.forgeAutoModRule.findMany({ where: { forgeId, enabled: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    prisma.forge.findUnique({ where: { id: forgeId }, select: { inviteCode: true } }),
    prisma.forgeInvite.findMany({ where: { forgeId, revokedAt: null }, select: { code: true } }),
  ]);
  const value = {
    at: Date.now(),
    rules: rows.map((row) => ({ ...row, type: row.type as AutoModType })),
    inviteCodes: [forge?.inviteCode, ...invites.map((invite) => invite.code)].filter(Boolean) as string[],
  };
  cache.set(forgeId, value);
  return value;
}

const recentAlerts = new Map<string, number>();

/**
 * Checks a message against the forge's AutoMod rules and carries out the rule's actions.
 * Returns a refusal when the message must not be posted.
 */
export async function runAutoMod(input: { forgeId: string; channelId: string; content: string; member: MemberContext; username: string }): Promise<{ blocked: false } | { blocked: true; message: string; ruleName: string }> {
  const exempt = input.member.access.isOwner || hasForgePermission(input.member.access, "manageForge");
  if (exempt) return { blocked: false };
  const { rules, inviteCodes } = await loadRules(input.forgeId);
  if (!rules.length) return { blocked: false };
  const hit = evaluateAutoMod(rules, { content: input.content, channelId: input.channelId, roleIds: input.member.roleIds, exempt, ownInviteCodes: inviteCodes });
  if (!hit) return { blocked: false };
  const { rule } = hit;

  void logForgeAction(input.forgeId, input.member.userId, "automod.block", { type: "member", id: input.member.userId, label: input.username }, {
    rule: rule.name,
    match: hit.match.slice(0, 80),
    channelId: input.channelId,
    excerpt: input.content.slice(0, 200),
    blocked: rule.blockMessage,
    timeoutMinutes: rule.timeoutMinutes,
  });

  if (rule.timeoutMinutes) {
    const until = new Date(Date.now() + rule.timeoutMinutes * 60_000);
    await prisma.forgeMember.updateMany({
      where: { userId: input.member.userId, forgeId: input.forgeId, OR: [{ timeoutUntil: null }, { timeoutUntil: { lt: until } }] },
      data: { timeoutUntil: until },
    });
    const voice = await prisma.channel.findMany({ where: { forgeId: input.forgeId, type: { in: ["VOICE", "STAGE"] } }, select: { id: true } });
    evictUserFromChannels(input.member.userId, voice.map((channel) => channel.id), { voiceOnly: true, reason: "timeout" });
  }

  if (rule.alertModerators) {
    // One alert per member per rule per minute, so a spam burst doesn't flood moderators.
    const key = `${input.forgeId}:${rule.id}:${input.member.userId}`;
    if (Date.now() - (recentAlerts.get(key) ?? 0) > 60_000) {
      recentAlerts.set(key, Date.now());
      const forge = await prisma.forge.findUnique({ where: { id: input.forgeId }, select: { ownerId: true, name: true } });
      const members = await prisma.forgeMember.findMany({
        where: { forgeId: input.forgeId, NOT: { userId: input.member.userId } },
        select: { userId: true, roleLinks: { select: { role: { select: { id: true, position: true, permissions: true } } } } },
        take: 5000,
      });
      const moderators = members
        .filter((member) => hasForgePermission(resolveForgeAccess(forge?.ownerId === member.userId, member.roleLinks.map((link) => link.role)), "moderateChat"))
        .slice(0, 25);
      void Promise.allSettled(
        moderators.map((moderator) =>
          createNotification({
            userId: moderator.userId,
            type: "SYSTEM",
            title: `AutoMod ${rule.blockMessage ? "blocked" : "flagged"} a message in ${forge?.name ?? "your forge"}`,
            body: `@${input.username} · rule "${rule.name}"${rule.timeoutMinutes ? ` · timed out ${rule.timeoutMinutes} min` : ""}`,
            data: { kind: "automod", forgeId: input.forgeId, channelId: input.channelId },
          }),
        ),
      );
    }
  }

  if (!rule.blockMessage) return { blocked: false };
  return { blocked: true, ruleName: rule.name, message: rule.customMessage || "This message was blocked by this forge's AutoMod." };
}
