/**
 * Stage channels: who is on stage (speakers), who has a hand raised, and who can run
 * the stage (moderators). Held in memory beside voice occupancy; a stage resets when
 * the last person leaves.
 *
 * Calls are peer-to-peer, so this can't stop audio leaving someone's computer. Instead
 * every listener's app only plays audio/video from current speakers, which a modified
 * client can't override for anyone else.
 */

export type StageSnapshot = { speakers: string[]; raised: string[]; moderators: string[] };

type StageState = { speakers: Set<string>; raised: Set<string>; moderators: Set<string> };

const stages = new Map<string, StageState>();

function stage(channelId: string) {
  let entry = stages.get(channelId);
  if (!entry) {
    entry = { speakers: new Set(), raised: new Set(), moderators: new Set() };
    stages.set(channelId, entry);
  }
  return entry;
}

/** Joining: moderators walk straight on stage; everyone else is in the audience. */
export function stageJoin(channelId: string, userId: string, isModerator: boolean) {
  const entry = stage(channelId);
  if (isModerator) {
    entry.moderators.add(userId);
    entry.speakers.add(userId);
    entry.raised.delete(userId);
  }
}

/** Drop anyone no longer in the room; forget the stage once it's empty. */
export function stageSync(channelId: string, present: string[]) {
  const entry = stages.get(channelId);
  if (!entry) return;
  const here = new Set(present);
  for (const set of [entry.speakers, entry.raised, entry.moderators]) {
    for (const userId of Array.from(set)) if (!here.has(userId)) set.delete(userId);
  }
  if (!here.size) stages.delete(channelId);
}

/** Audience members raise or lower their hand. Speakers don't need to. */
export function stageRaise(channelId: string, userId: string, raised: boolean) {
  const entry = stage(channelId);
  if (entry.speakers.has(userId)) return false;
  if (raised) entry.raised.add(userId);
  else entry.raised.delete(userId);
  return true;
}

/**
 * Put someone on stage or move them to the audience.
 * - Moderators can do either to anyone (except move another moderator off stage).
 * - Anyone can step down themselves.
 */
export function stageSetSpeaker(channelId: string, actorId: string, targetId: string, speaker: boolean) {
  const entry = stage(channelId);
  const actorIsModerator = entry.moderators.has(actorId);
  const self = actorId === targetId;
  if (speaker) {
    if (!actorIsModerator) return false;
  } else if (!self) {
    if (!actorIsModerator || entry.moderators.has(targetId)) return false;
  }
  if (speaker) {
    entry.speakers.add(targetId);
    entry.raised.delete(targetId);
  } else {
    entry.speakers.delete(targetId);
  }
  return true;
}

export function stageSnapshot(channelId: string): StageSnapshot {
  const entry = stages.get(channelId);
  return {
    speakers: entry ? Array.from(entry.speakers) : [],
    raised: entry ? Array.from(entry.raised) : [],
    moderators: entry ? Array.from(entry.moderators) : [],
  };
}

export function resetStagesForTests() {
  stages.clear();
}
