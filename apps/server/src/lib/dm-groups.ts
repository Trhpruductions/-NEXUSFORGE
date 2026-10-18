/**
 * Who may be put in a group DM: the same rule as one-to-one DMs. Everyone added must be the creator's accepted
 * friend, and nobody with a block between them and the creator (either way) can be added. Without this, anyone
 * could pull any user ID into a group, around both the friends-only rule and blocks.
 */
export type FriendRelation = { senderId: string; receiverId: string; status: string };

export function groupMemberProblem(creatorId: string, memberIds: string[], relations: FriendRelation[]): string | null {
  const other = (relation: FriendRelation) => (relation.senderId === creatorId ? relation.receiverId : relation.senderId);
  const mine = relations.filter((relation) => relation.senderId === creatorId || relation.receiverId === creatorId);
  const blocked = new Set(mine.filter((relation) => relation.status === "BLOCKED").map(other));
  const friends = new Set(mine.filter((relation) => relation.status === "ACCEPTED").map(other));
  for (const id of memberIds) {
    if (id === creatorId) continue;
    if (blocked.has(id)) return "You can't add a player you've blocked or who has blocked you";
    if (!friends.has(id)) return "You can only add accepted friends to a group";
  }
  return null;
}
