import { prisma } from "./prisma.js";
import { hasForgePermission, resolveForgeAccess, type ResolvedForgeAccess } from "./forge-permissions.js";

// One place for "can this member see / post in this channel", so private channels and
// timeouts are enforced the same way by every route and the realtime gateway.

export type ChannelLike = { id: string; forgeId: string; isPrivate: boolean; allowedRoleIds: string[]; allowedUserIds: string[] };

export type MemberContext = {
  userId: string;
  forgeId: string;
  ownerId: string;
  roleIds: string[];
  access: ResolvedForgeAccess;
  timeoutUntil: Date | null;
};

/** The member's standing in a forge, or null when they aren't a member. */
export async function loadMemberContext(userId: string, forgeId: string): Promise<MemberContext | null> {
  const [forge, member] = await Promise.all([
    prisma.forge.findUnique({ where: { id: forgeId }, select: { ownerId: true } }),
    prisma.forgeMember.findUnique({
      where: { userId_forgeId: { userId, forgeId } },
      include: { roleLinks: { include: { role: { select: { id: true, position: true, permissions: true } } } } },
    }),
  ]);
  if (!forge || !member) return null;
  return {
    userId,
    forgeId,
    ownerId: forge.ownerId,
    roleIds: member.roleLinks.map((link) => link.role.id),
    access: resolveForgeAccess(forge.ownerId === userId, member.roleLinks.map((link) => link.role)),
    timeoutUntil: member.timeoutUntil,
  };
}

/** Private channels: owner, channel managers, and the listed roles/members only. */
export function canViewChannel(member: MemberContext | null, channel: ChannelLike): boolean {
  if (!member || member.forgeId !== channel.forgeId) return false;
  if (!channel.isPrivate) return true;
  if (member.access.isOwner || hasForgePermission(member.access, "manageChannels")) return true;
  if (channel.allowedUserIds.includes(member.userId)) return true;
  return channel.allowedRoleIds.some((roleId) => member.roleIds.includes(roleId));
}

export function isTimedOut(member: MemberContext | null, now = new Date()): boolean {
  return Boolean(member?.timeoutUntil && member.timeoutUntil > now);
}

export const channelAccessSelect = { id: true, forgeId: true, isPrivate: true, allowedRoleIds: true, allowedUserIds: true } as const;

/** Convenience: load the channel and the member, and answer "can they see it". */
export async function userCanViewChannel(userId: string, channelId: string) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId }, select: { ...channelAccessSelect, type: true } });
  if (!channel) return { ok: false as const, channel: null, member: null };
  const member = await loadMemberContext(userId, channel.forgeId);
  return { ok: canViewChannel(member, channel), channel, member };
}

/** The ids of every channel in a forge this member can't see (for filtering lists/queries). */
export async function hiddenChannelIds(member: MemberContext): Promise<string[]> {
  const privateChannels = await prisma.channel.findMany({ where: { forgeId: member.forgeId, isPrivate: true }, select: channelAccessSelect });
  return privateChannels.filter((channel) => !canViewChannel(member, channel)).map((channel) => channel.id);
}

/** Everyone in the forge who can see a private channel (for targeted realtime events). */
export async function privateChannelViewerIds(channel: ChannelLike): Promise<string[]> {
  const forge = await prisma.forge.findUnique({ where: { id: channel.forgeId }, select: { ownerId: true } });
  if (!forge) return [];
  const members = await prisma.forgeMember.findMany({
    where: { forgeId: channel.forgeId },
    select: { userId: true, timeoutUntil: true, roleLinks: { select: { role: { select: { id: true, position: true, permissions: true } } } } },
  });
  return members
    .filter((member) =>
      canViewChannel(
        {
          userId: member.userId,
          forgeId: channel.forgeId,
          ownerId: forge.ownerId,
          roleIds: member.roleLinks.map((link) => link.role.id),
          access: resolveForgeAccess(forge.ownerId === member.userId, member.roleLinks.map((link) => link.role)),
          timeoutUntil: member.timeoutUntil,
        },
        channel,
      ),
    )
    .map((member) => member.userId);
}

/** Moderators skip slowmode, like Discord's "Manage Messages / Manage Channel". */
export function bypassesSlowmode(member: MemberContext) {
  return member.access.isOwner || hasForgePermission(member.access, "moderateChat") || hasForgePermission(member.access, "manageChannels");
}

/** Private channels this user can't see, across one forge or every forge they're in. */
export async function hiddenChannelIdsForUser(userId: string, forgeId?: string): Promise<string[]> {
  const forgeIds = forgeId
    ? [forgeId]
    : (await prisma.forgeMember.findMany({ where: { userId }, select: { forgeId: true } })).map((row) => row.forgeId);
  const privateChannels = await prisma.channel.findMany({ where: { forgeId: { in: forgeIds }, isPrivate: true }, select: channelAccessSelect });
  if (!privateChannels.length) return [];
  const hidden: string[] = [];
  const contexts = new Map<string, MemberContext | null>();
  for (const channel of privateChannels) {
    if (!contexts.has(channel.forgeId)) contexts.set(channel.forgeId, await loadMemberContext(userId, channel.forgeId));
    if (!canViewChannel(contexts.get(channel.forgeId) ?? null, channel)) hidden.push(channel.id);
  }
  return hidden;
}
