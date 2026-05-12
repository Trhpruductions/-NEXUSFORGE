import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const sharedPassword = "Sample!2026";
const passwordHash = await bcrypt.hash(sharedPassword, 12);

const medalCatalog = [
  { key: "founding-member", name: "Founding Member", description: "Early supporter of NexusForge.", icon: "🏛" },
  { key: "forge-commander", name: "Forge Commander", description: "Leads high-signal communities.", icon: "🛡" },
  { key: "signal-booster", name: "Signal Booster", description: "Maintains a strong Core+ streak.", icon: "⚡" },
  { key: "legendary-builder", name: "Legendary Builder", description: "Built and scaled a thriving forge.", icon: "🏗" },
  { key: "community-pillar", name: "Community Pillar", description: "Recognized for consistent impact.", icon: "🏅" },
  { key: "day1-pioneer", name: "Day 1 Pioneer", description: "Beta tester and launch pioneer.", icon: "🔥" },
] as const;
// --- Beta tester list (usernames, case-insensitive) ---
const betaTesters = [
  "jacksongaming69",
  "vanillapea",
  "bbrosius",
];


const groupDefinitions = [
  {
    key: "CASUAL",
    name: "Casual Crew",
    tag: "CAS",
    description: "Low-friction players who check in, chat, and jump into quick sessions.",
    members: [
      {
        username: "lunaplay",
        email: "lunaplay@nexusforge.local",
        displayName: "Luna Play",
        status: "ONLINE",
        premiumTier: "CORE",
        appRole: "USER",
        premium: true,
        corePlusBoostLevel: 3,
        reputation: 118,
        currentActivity: "Browsing for a quick session",
        activityDetails: "Looking for a squad to jump into after work.",
        bio: "Casual sessions, weekend raids, and good energy only.",
        medals: ["signal-booster"],
      },
      {
        username: "novaquest",
        email: "novaquest@nexusforge.local",
        displayName: "Nova Quest",
        status: "IDLE",
        premiumTier: "NONE",
        appRole: "USER",
        premium: false,
        corePlusBoostLevel: 3,
        reputation: 92,
        currentActivity: "Watching friends go live",
        activityDetails: "Usually joins mid-match or late-night chats.",
        bio: "Relaxed player, social first, competitive second.",
        medals: [],
      },
      {
        username: "pixelmuse",
        email: "pixelmuse@nexusforge.local",
        displayName: "Pixel Muse",
        status: "ONLINE",
        premiumTier: "CORE",
        appRole: "USER",
        premium: true,
        corePlusBoostLevel: 2,
        reputation: 156,
        currentActivity: "Posting screenshots and clips",
        activityDetails: "Keeps the feed active with highlight reels.",
        bio: "Screenshot collector and highlight reel curator.",
        medals: ["community-pillar"],
      },
      {
        username: "driftbyte",
        email: "driftbyte@nexusforge.local",
        displayName: "Drift Byte",
        status: "OFFLINE",
        premiumTier: "NONE",
        appRole: "USER",
        premium: false,
        corePlusBoostLevel: 3,
        reputation: 74,
        currentActivity: "Offline for the day",
        activityDetails: "Usually comes online after 8 PM local time.",
        bio: "Night owl, casual queue enjoyer, low-pressure gamer.",
        medals: [],
      },
      {
        username: "echolane",
        email: "echolane@nexusforge.local",
        displayName: "Echo Lane",
        status: "DND",
        premiumTier: "CORE",
        appRole: "USER",
        premium: true,
        corePlusBoostLevel: 4,
        reputation: 141,
        currentActivity: "Muted while in a call",
        activityDetails: "Drops in for voice after work.",
        bio: "Voice chat regular and weekend event regular.",
        medals: ["founding-member"],
      },
    ],
  },
  {
    key: "CREATOR",
    name: "Creator Circle",
    tag: "CRT",
    description: "Streamers, editors, and clip makers who keep the community fed.",
    members: [
      {
        username: "ariaframe",
        email: "ariaframe@nexusforge.local",
        displayName: "Aria Frame",
        status: "ONLINE",
        premiumTier: "PLUS",
        appRole: "USER",
        premium: true,
        corePlusBoostLevel: 8,
        reputation: 364,
        currentActivity: "Scheduling a live stream",
        activityDetails: "Posts stream notices and clip drops.",
        bio: "Variety streamer with a strong clip pipeline.",
        medals: ["signal-booster", "community-pillar"],
      },
      {
        username: "remicuts",
        email: "remicuts@nexusforge.local",
        displayName: "Remi Cuts",
        status: "ONLINE",
        premiumTier: "CORE",
        appRole: "MODERATOR",
        premium: true,
        corePlusBoostLevel: 5,
        reputation: 278,
        currentActivity: "Editing highlight reels",
        activityDetails: "Turns community moments into short-form edits.",
        bio: "Editor, clipper, and creator support lead.",
        medals: ["legendary-builder"],
      },
      {
        username: "vibemint",
        email: "vibemint@nexusforge.local",
        displayName: "Vibe Mint",
        status: "IDLE",
        premiumTier: "PLUS",
        appRole: "USER",
        premium: true,
        corePlusBoostLevel: 6,
        reputation: 412,
        currentActivity: "Drafting a community post",
        activityDetails: "Plans weekly announcements and polls.",
        bio: "Community builder who keeps channels active.",
        medals: ["community-pillar"],
      },
      {
        username: "bloomcast",
        email: "bloomcast@nexusforge.local",
        displayName: "Bloom Cast",
        status: "ONLINE",
        premiumTier: "PLUS",
        appRole: "USER",
        premium: true,
        corePlusBoostLevel: 7,
        reputation: 340,
        currentActivity: "Planning a fan event",
        activityDetails: "Coordinates giveaways and live meetups.",
        bio: "Event host with a creator-first workflow.",
        medals: ["forge-commander"],
      },
      {
        username: "junoedit",
        email: "junoedit@nexusforge.local",
        displayName: "Juno Edit",
        status: "DND",
        premiumTier: "PLUS",
        appRole: "USER",
        premium: true,
        corePlusBoostLevel: 9,
        reputation: 399,
        currentActivity: "Rendering a promo cut",
        activityDetails: "Usually responds after edits finish exporting.",
        bio: "Creative producer and premium media contributor.",
        medals: ["signal-booster"],
      },
    ],
  },
  {
    key: "COMPETITIVE",
    name: "Competitive League",
    tag: "COMP",
    description: "Ranked players, scrim captains, and tournament regulars.",
    members: [
      {
        username: "kaderush",
        email: "kaderush@nexusforge.local",
        displayName: "Kade Rush",
        status: "ONLINE",
        premiumTier: "ELITE",
        appRole: "USER",
        premium: true,
        corePlusBoostLevel: 12,
        reputation: 731,
        currentActivity: "Running scrims",
        activityDetails: "Leads the first team into practice lobbies.",
        bio: "Competitor who treats every lobby like a bracket run.",
        medals: ["forge-commander", "legendary-builder"],
      },
      {
        username: "nyxclutch",
        email: "nyxclutch@nexusforge.local",
        displayName: "Nyx Clutch",
        status: "ONLINE",
        premiumTier: "PLUS",
        appRole: "USER",
        premium: true,
        corePlusBoostLevel: 10,
        reputation: 588,
        currentActivity: "Queueing ranked matches",
        activityDetails: "Prefers short, high-intensity sessions.",
        bio: "Queue grinder with sharp reactions and clean comms.",
        medals: ["signal-booster"],
      },
      {
        username: "razeprime",
        email: "razeprime@nexusforge.local",
        displayName: "Raze Prime",
        status: "DND",
        premiumTier: "ELITE",
        appRole: "ADMIN",
        premium: true,
        corePlusBoostLevel: 14,
        reputation: 860,
        currentActivity: "Reviewing scrim footage",
        activityDetails: "Breaks down match VODs between practice blocks.",
        bio: "Tactical lead who manages competitive operations.",
        medals: ["community-pillar", "forge-commander"],
      },
      {
        username: "boltsync",
        email: "boltsync@nexusforge.local",
        displayName: "Bolt Sync",
        status: "ONLINE",
        premiumTier: "PLUS",
        appRole: "USER",
        premium: true,
        corePlusBoostLevel: 11,
        reputation: 642,
        currentActivity: "Hosting a tournament lobby",
        activityDetails: "Builds brackets and match reminders.",
        bio: "Bracket runner and live match coordinator.",
        medals: ["founding-member"],
      },
      {
        username: "hexstrike",
        email: "hexstrike@nexusforge.local",
        displayName: "Hex Strike",
        status: "IDLE",
        premiumTier: "ELITE",
        appRole: "USER",
        premium: true,
        corePlusBoostLevel: 13,
        reputation: 904,
        currentActivity: "Waiting for match calls",
        activityDetails: "Usually offline between evening scrims.",
        bio: "Flex player with tournament-ready habits.",
        medals: ["legendary-builder"],
      },
    ],
  },
  {
    key: "OPS",
    name: "Ops Team",
    tag: "OPS",
    description: "Moderators, admins, and the owner lane that keeps everything running.",
    members: [
      {
        username: "atlasops",
        email: "atlasops@nexusforge.local",
        displayName: "Atlas Ops",
        status: "ONLINE",
        premiumTier: "INFINITE",
        appRole: "OWNER",
        premium: true,
        corePlusBoostLevel: 999,
        reputation: 5000,
        currentActivity: "Monitoring platform health",
        activityDetails: "Keeps the command surface stable and fast.",
        bio: "Platform owner and operations lead.",
        medals: ["founding-member", "forge-commander", "legendary-builder"],
      },
      {
        username: "seraforge",
        email: "seraforge@nexusforge.local",
        displayName: "Sera Forge",
        status: "ONLINE",
        premiumTier: "ELITE",
        appRole: "ADMIN",
        premium: true,
        corePlusBoostLevel: 120,
        reputation: 2610,
        currentActivity: "Reviewing reports and flags",
        activityDetails: "Handles escalations and content review.",
        bio: "Admin lane with rapid response habits.",
        medals: ["community-pillar", "signal-booster"],
      },
      {
        username: "makoguard",
        email: "makoguard@nexusforge.local",
        displayName: "Mako Guard",
        status: "IDLE",
        premiumTier: "PLUS",
        appRole: "MODERATOR",
        premium: true,
        corePlusBoostLevel: 44,
        reputation: 1540,
        currentActivity: "Watching moderation queue",
        activityDetails: "Keeps incidents and spam under control.",
        bio: "Moderator focused on safety and response speed.",
        medals: ["forge-commander"],
      },
      {
        username: "valeadmin",
        email: "valeadmin@nexusforge.local",
        displayName: "Vale Admin",
        status: "DND",
        premiumTier: "ELITE",
        appRole: "EXEC",
        premium: true,
        corePlusBoostLevel: 88,
        reputation: 2200,
        currentActivity: "Approving platform changes",
        activityDetails: "Usually in deep work while platform updates ship.",
        bio: "Executive ops lead with eyes on the roadmap.",
        medals: ["legendary-builder", "signal-booster"],
      },
      {
        username: "quinncore",
        email: "quinncore@nexusforge.local",
        displayName: "Quinn Core",
        status: "ONLINE",
        premiumTier: "INFINITE",
        appRole: "ADMIN",
        premium: true,
        corePlusBoostLevel: 170,
        reputation: 3180,
        currentActivity: "Running release checks",
        activityDetails: "Oversees rollout, billing, and stability checks.",
        bio: "Release manager and final sign-off admin.",
        medals: ["founding-member", "community-pillar"],
      },
    ],
  },
] as const;

function activityTemplateFor(groupKey: string, index: number) {
  const map: Record<string, readonly { type: "JOINED_FORGE" | "CREATED_FORGE" | "MESSAGE_SENT" | "FRIEND_ADDED" | "LEVEL_UP" | "PREMIUM_UPGRADE"; title: string; description: string }[]> = {
    CASUAL: [
      { type: "JOINED_FORGE", title: "[seed] Joined casual forge", description: "Dropped into a low-pressure hangout session." },
      { type: "MESSAGE_SENT", title: "[seed] Shared a quick update", description: "Posted a short check-in for the crew." },
      { type: "FRIEND_ADDED", title: "[seed] Added a new friend", description: "Connected with a regular player." },
      { type: "CUSTOM", title: "[seed] Casual night in", description: "Kept things relaxed and social." },
    ],
    CREATOR: [
      { type: "CREATED_FORGE", title: "[seed] Launched creator hub", description: "Set up a workspace for content planning." },
      { type: "MESSAGE_SENT", title: "[seed] Posted a clip drop", description: "Shared a fresh content highlight." },
      { type: "PREMIUM_UPGRADE", title: "[seed] Activated creator perks", description: "Unlocked a premium creator workflow." },
      { type: "LEVEL_UP", title: "[seed] Grew audience reach", description: "Progressed audience and engagement goals." },
    ],
    COMPETITIVE: [
      { type: "JOINED_FORGE", title: "[seed] Joined scrim roster", description: "Entered a ranked practice session." },
      { type: "MESSAGE_SENT", title: "[seed] Posted match notes", description: "Logged team callouts and observations." },
      { type: "LEVEL_UP", title: "[seed] Cleared a rank milestone", description: "Moved closer to tournament readiness." },
      { type: "CUSTOM", title: "[seed] Competitive prep", description: "Focused on match readiness and synergy." },
    ],
    OPS: [
      { type: "CREATED_FORGE", title: "[seed] Opened ops workspace", description: "Prepared a governance-ready forge space." },
      { type: "PREMIUM_UPGRADE", title: "[seed] Validated enterprise access", description: "Confirmed premium tooling was enabled." },
      { type: "MESSAGE_SENT", title: "[seed] Reviewed incident notes", description: "Tracked moderation and release follow-ups." },
      { type: "CUSTOM", title: "[seed] Release coordination", description: "Kept operational tasks moving." },
    ],
  };

  const templates = map[groupKey];
  return templates[index % templates.length];
}

async function seedMedals() {
  for (const medal of medalCatalog) {
    await prisma.medal.upsert({
      where: { key: medal.key },
      update: {
        name: medal.name,
        description: medal.description,
        icon: medal.icon,
      },
      create: {
        key: medal.key,
        name: medal.name,
        description: medal.description,
        icon: medal.icon,
      },
    });
  }
}

async function main() {
  await seedMedals();

  const medalRows = await prisma.medal.findMany({ select: { id: true, key: true } });
  const medalIdByKey = new Map(medalRows.map((row) => [row.key, row.id]));
  const pioneerMedalId = medalIdByKey.get("day1-pioneer");

  const allUserIds: string[] = [];
  const groupSummaries: Array<{ group: string; createdOrUpdated: number }> = [];

  for (const group of groupDefinitions) {
    const groupUserIds: string[] = [];

    for (let index = 0; index < group.members.length; index += 1) {
      const member = group.members[index]!;
      const existing = await prisma.user.findUnique({ where: { email: member.email }, select: { id: true } });

      const user = existing
        ? await prisma.user.update({
            where: { id: existing.id },
            data: {
              username: member.username,
              email: member.email,
              password: passwordHash,
              avatar: null,
              banner: null,
              bio: member.bio,
              status: member.status,
              premium: member.premium,
              premiumTier: member.premiumTier,
              corePlusBoostLevel: member.corePlusBoostLevel,
              appRole: member.appRole,
              isAdmin: member.appRole === "ADMIN" || member.appRole === "EXEC" || member.appRole === "OWNER",
              reputation: member.reputation,
              currentActivity: member.currentActivity,
              activityDetails: member.activityDetails,
              emailVerified: true,
              clanTag: group.tag,
            },
            select: { id: true },
          })
        : await prisma.user.create({
            data: {
              username: member.username,
              email: member.email,
              password: passwordHash,
              avatar: null,
              banner: null,
              bio: member.bio,
              status: member.status,
              premium: member.premium,
              premiumTier: member.premiumTier,
              corePlusBoostLevel: member.corePlusBoostLevel,
              appRole: member.appRole,
              isAdmin: member.appRole === "ADMIN" || member.appRole === "EXEC" || member.appRole === "OWNER",
              reputation: member.reputation,
              currentActivity: member.currentActivity,
              activityDetails: member.activityDetails,
              emailVerified: true,
              clanTag: group.tag,
            },
            select: { id: true },
          });

      groupUserIds.push(user.id);
      allUserIds.push(user.id);

      await prisma.userActivity.deleteMany({
        where: {
          userId: user.id,
          title: { startsWith: "[seed]" },
        },
      });

      const baseActivities = Array.from({ length: 4 }).map((_, activityIndex) => {
        const template = activityTemplateFor(group.key, activityIndex);
        const offsetMinutes = (index * 4 + activityIndex + 1) * 97;
        return {
          userId: user.id,
          type: template.type,
          title: template.title,
          description: template.description,
          metadata: {
            source: "seed-user-groups",
            group: group.key,
            groupName: group.name,
            username: member.username,
          },
          createdAt: new Date(Date.now() - offsetMinutes * 60 * 1000),
        };
      });

      await prisma.userActivity.createMany({ data: baseActivities });

      const isBeta = betaTesters.includes(member.username.toLowerCase());
      const medalKeys = [...member.medals.slice(0, 3)];
      if (isBeta && !medalKeys.includes("day1-pioneer")) medalKeys.push("day1-pioneer");
      const medalIds = medalKeys.map((key) => medalIdByKey.get(key)).filter((id): id is string => Boolean(id));

      if (medalIds.length > 0) {
        await prisma.userMedal.createMany({
          data: medalIds.map((medalId) => ({ userId: user.id, medalId })),
          skipDuplicates: true,
        });
      }
    }

    const existingPairs: Array<{ senderId: string; receiverId: string }> = [];
    for (let index = 0; index < groupUserIds.length - 1; index += 2) {
      const senderId = groupUserIds[index];
      const receiverId = groupUserIds[index + 1];
      if (senderId && receiverId) existingPairs.push({ senderId, receiverId });
    }

    await prisma.friend.deleteMany({
      where: {
        OR: existingPairs.flatMap((pair) => [
          { senderId: pair.senderId, receiverId: pair.receiverId },
          { senderId: pair.receiverId, receiverId: pair.senderId },
        ]),
      },
    });

    if (existingPairs.length > 0) {
      await prisma.friend.createMany({
        data: existingPairs.map((pair) => ({
          senderId: pair.senderId,
          receiverId: pair.receiverId,
          status: "ACCEPTED",
        })),
        skipDuplicates: true,
      });
    }

    groupSummaries.push({ group: group.name, createdOrUpdated: group.members.length });
  }

  const explicitBetaUsers = [
    {
      username: "JacksonGaming69",
      email: "jacksongaming69@nexusforge.local",
      password: "676769Jj$",
    },
    {
      username: "vanillapea",
      email: "vanillapea@nexusforge.local",
      password: "Sammya04!",
    },
    {
      username: "bbrosius",
      email: "bbrosius@nexusforge.local",
      password: "gofuckyourself",
    },
  ] as const;

  for (const betaUser of explicitBetaUsers) {
    const hashed = await bcrypt.hash(betaUser.password, 12);
    const user = await prisma.user.upsert({
      where: { email: betaUser.email },
      update: {
        username: betaUser.username,
        password: hashed,
        avatar: null,
        banner: null,
        bio: "Beta tester for Day 1.",
        status: "ONLINE",
        premium: false,
        premiumTier: "NONE",
        corePlusBoostLevel: 3,
        appRole: "USER",
        isAdmin: false,
        reputation: 100,
        currentActivity: "Beta testing",
        activityDetails: "Day 1 Pioneer.",
        emailVerified: true,
        clanTag: null,
      },
      create: {
        username: betaUser.username,
        email: betaUser.email,
        password: hashed,
        avatar: null,
        banner: null,
        bio: "Beta tester for Day 1.",
        status: "ONLINE",
        premium: false,
        premiumTier: "NONE",
        corePlusBoostLevel: 3,
        appRole: "USER",
        isAdmin: false,
        reputation: 100,
        currentActivity: "Beta testing",
        activityDetails: "Day 1 Pioneer.",
        emailVerified: true,
        clanTag: null,
      },
      select: { id: true },
    });

    if (pioneerMedalId) {
      await prisma.userMedal.upsert({
        where: { userId_medalId: { userId: user.id, medalId: pioneerMedalId } },
        update: {},
        create: { userId: user.id, medalId: pioneerMedalId },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        sharedPassword,
        groups: groupSummaries,
        totalUsers: allUserIds.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Seed user groups failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });