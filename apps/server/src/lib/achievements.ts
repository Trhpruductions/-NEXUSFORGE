import { prisma } from "./prisma.js";
import { createNotification } from "./notifications.js";

/**
 * Achievements are medals earned automatically from what a player actually does.
 * Routes call `evaluateAchievements(userId)` after a relevant action; every
 * check runs against live counts, so nothing here is seeded or faked.
 */

type Stats = {
  posts: number;
  messages: number;
  friends: number;
  forgesOwned: number;
  forgesJoined: number;
  followers: number;
  wentLive: boolean;
  idVerified: boolean;
  twoFactor: boolean;
  cosmetics: number;
  eventsGoing: number;
  avatarPresets: number;
  accountAgeDays: number;
};

export type AchievementDefinition = {
  key: string;
  name: string;
  description: string;
  icon: string;
  /** Returns true when the player has met the requirement. */
  check: (stats: Stats) => boolean;
};

export const achievementCatalog: AchievementDefinition[] = [
  { key: "first-post", name: "First Post", description: "Shared your first update with the community.", icon: "📝", check: (s) => s.posts >= 1 },
  { key: "storyteller", name: "Storyteller", description: "Posted 25 updates or clips.", icon: "🎬", check: (s) => s.posts >= 25 },
  { key: "chatterbox", name: "Chatterbox", description: "Sent 100 messages in forge channels.", icon: "💬", check: (s) => s.messages >= 100 },
  { key: "voice-of-the-forge", name: "Voice of the Forge", description: "Sent 1,000 messages in forge channels.", icon: "📣", check: (s) => s.messages >= 1000 },
  { key: "squad-up", name: "Squad Up", description: "Made 5 friends on Vexora.", icon: "🤝", check: (s) => s.friends >= 5 },
  { key: "full-lobby", name: "Full Lobby", description: "Made 25 friends on Vexora.", icon: "🎮", check: (s) => s.friends >= 25 },
  { key: "forge-founder", name: "Forge Founder", description: "Created your own forge.", icon: "🏗", check: (s) => s.forgesOwned >= 1 },
  { key: "explorer", name: "Explorer", description: "Joined 5 forges.", icon: "🧭", check: (s) => s.forgesJoined >= 5 },
  { key: "rising-star", name: "Rising Star", description: "Reached 10 followers.", icon: "⭐", check: (s) => s.followers >= 10 },
  { key: "headliner", name: "Headliner", description: "Reached 100 followers.", icon: "🌟", check: (s) => s.followers >= 100 },
  { key: "on-air", name: "On Air", description: "Went live on Vexora for the first time.", icon: "📡", check: (s) => s.wentLive },
  { key: "verified-18", name: "Verified 18+", description: "Verified your age with a government ID.", icon: "🪪", check: (s) => s.idVerified },
  { key: "locked-down", name: "Locked Down", description: "Turned on two-factor sign-in.", icon: "🔐", check: (s) => s.twoFactor },
  { key: "drip", name: "Drip", description: "Own 5 cosmetics.", icon: "👟", check: (s) => s.cosmetics >= 5 },
  { key: "collector", name: "Collector", description: "Own 20 cosmetics.", icon: "🧥", check: (s) => s.cosmetics >= 20 },
  { key: "event-goer", name: "Event Goer", description: "RSVP'd to 3 events.", icon: "🎟", check: (s) => s.eventsGoing >= 3 },
  { key: "shapeshifter", name: "Shapeshifter", description: "Saved 3 avatar presets.", icon: "🎭", check: (s) => s.avatarPresets >= 3 },
  { key: "veteran", name: "Veteran", description: "Been on Vexora for a year.", icon: "🎖", check: (s) => s.accountAgeDays >= 365 },
  // Granted directly by the tournament engine when a bracket completes.
  { key: "champion", name: "Champion", description: "Won a Vexora tournament.", icon: "🏆", check: () => false },
];

export async function ensureAchievementCatalog() {
  for (const entry of achievementCatalog) {
    await prisma.medal.upsert({
      where: { key: entry.key },
      update: { name: entry.name, description: entry.description, icon: entry.icon },
      create: { key: entry.key, name: entry.name, description: entry.description, icon: entry.icon },
    });
  }
}

/** Grants one medal if the player does not have it yet and tells them about it. Returns true when newly granted. */
export async function grantMedal(userId: string, key: string): Promise<boolean> {
  const medal = await prisma.medal.findUnique({ where: { key }, select: { id: true, name: true, description: true, icon: true } });
  if (!medal) return false;
  const existing = await prisma.userMedal.findUnique({ where: { userId_medalId: { userId, medalId: medal.id } }, select: { id: true } });
  if (existing) return false;
  await prisma.userMedal.create({ data: { userId, medalId: medal.id } });
  void createNotification({
    userId,
    type: "SYSTEM",
    title: `Achievement unlocked: ${medal.name}`,
    body: medal.description ?? "",
    data: { achievement: key, icon: medal.icon },
  }).catch(() => undefined);
  return true;
}

async function collectStats(userId: string): Promise<Stats | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
      isCreator: true,
      liveStartedAt: true,
      creatorStatus: true,
      ageVerificationLevel: true,
      twoFactorEnabled: true,
      _count: { select: { posts: true, followers: true, ownedForges: true, memberships: true, cosmetics: true, avatarPresets: true } },
    },
  });
  if (!user) return null;
  const [messages, friends, eventsGoing] = await Promise.all([
    prisma.message.count({ where: { authorId: userId } }),
    prisma.friend.count({ where: { status: "ACCEPTED", OR: [{ senderId: userId }, { receiverId: userId }] } }),
    prisma.eventParticipant.count({ where: { userId, status: { in: ["GOING", "ELIMINATED"] } } }),
  ]);
  return {
    posts: user._count.posts,
    messages,
    friends,
    forgesOwned: user._count.ownedForges,
    forgesJoined: user._count.memberships,
    followers: user._count.followers,
    wentLive: user.creatorStatus === "LIVE" || Boolean(user.liveStartedAt) || user.isCreator,
    idVerified: user.ageVerificationLevel === "VERIFIED",
    twoFactor: user.twoFactorEnabled,
    cosmetics: user._count.cosmetics,
    eventsGoing,
    avatarPresets: user._count.avatarPresets,
    accountAgeDays: Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000),
  };
}

/** Re-checks every achievement for a player and grants the ones newly earned. Safe to fire-and-forget. */
export async function evaluateAchievements(userId: string): Promise<string[]> {
  try {
    const stats = await collectStats(userId);
    if (!stats) return [];
    const held = new Set(
      (await prisma.userMedal.findMany({ where: { userId }, select: { medal: { select: { key: true } } } })).map((entry) => entry.medal.key),
    );
    const granted: string[] = [];
    for (const entry of achievementCatalog) {
      if (held.has(entry.key) || !entry.check(stats)) continue;
      if (await grantMedal(userId, entry.key)) granted.push(entry.key);
    }
    return granted;
  } catch (error) {
    console.warn("[achievements] evaluation failed", error);
    return [];
  }
}

/** Progress view for the profile: every achievement with whether it is unlocked. */
export async function achievementProgress(userId: string) {
  const [stats, held] = await Promise.all([
    collectStats(userId),
    prisma.userMedal.findMany({ where: { userId }, select: { grantedAt: true, medal: { select: { key: true } } } }),
  ]);
  const grantedAt = new Map(held.map((entry) => [entry.medal.key, entry.grantedAt]));
  return achievementCatalog.map((entry) => ({
    key: entry.key,
    name: entry.name,
    description: entry.description,
    icon: entry.icon,
    unlocked: grantedAt.has(entry.key),
    unlockedAt: grantedAt.get(entry.key) ?? null,
    met: stats ? entry.check(stats) : false,
  }));
}
