import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const medalCatalog = [
  { key: "founding-member", name: "Founding Member", description: "Early supporter of NexusForge.", icon: "🏛" },
  { key: "forge-commander", name: "Forge Commander", description: "Leads high-signal communities.", icon: "🛡" },
  { key: "signal-booster", name: "Signal Booster", description: "Maintains a strong Core+ streak.", icon: "⚡" },
  { key: "legendary-builder", name: "Legendary Builder", description: "Built and scaled a thriving forge.", icon: "🏗" },
  { key: "community-pillar", name: "Community Pillar", description: "Recognized for consistent impact.", icon: "🏅" },
] as const;

const activityTemplates = [
  { type: "JOINED_FORGE", title: "Joined a new forge", description: "Connected with a new community node." },
  { type: "CREATED_FORGE", title: "Created a forge", description: "Started a new operational workspace." },
  { type: "MESSAGE_SENT", title: "Published a high-signal message", description: "Contributed to active discussions." },
  { type: "FRIEND_ADDED", title: "Expanded social graph", description: "Added a trusted ally." },
  { type: "LEVEL_UP", title: "Advanced profile level", description: "Unlocked new progression tier." },
  { type: "PREMIUM_UPGRADE", title: "Upgraded to Core+", description: "Enabled premium operations." },
] as const;

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

async function seedUserProfileSignals() {
  const users = await prisma.user.findMany({
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const medals = await prisma.medal.findMany({
    select: { id: true },
  });

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        reputation: randomInt(50, 1200),
      },
    });

    const existingActivityCount = await prisma.userActivity.count({ where: { userId: user.id } });
    if (existingActivityCount < 8) {
      const payload = Array.from({ length: 8 - existingActivityCount }).map(() => {
        const template = activityTemplates[randomInt(0, activityTemplates.length - 1)];
        const offsetMinutes = randomInt(0, 60 * 24 * 28);
        return {
          userId: user.id,
          type: template.type,
          title: template.title,
          description: template.description,
          createdAt: new Date(Date.now() - offsetMinutes * 60 * 1000),
        };
      });

      await prisma.userActivity.createMany({ data: payload });
    }

    if (medals.length > 0) {
      const grantCount = randomInt(1, Math.min(3, medals.length));
      for (let idx = 0; idx < grantCount; idx += 1) {
        const medal = medals[randomInt(0, medals.length - 1)];
        if (!medal) continue;

        await prisma.userMedal.upsert({
          where: {
            userId_medalId: {
              userId: user.id,
              medalId: medal.id,
            },
          },
          update: {},
          create: {
            userId: user.id,
            medalId: medal.id,
          },
        });
      }
    }
  }
}

async function main() {
  await seedMedals();
  await seedUserProfileSignals();
  console.log("Profile seed complete: medals, reputation, activities, and medal grants are populated.");
}

main()
  .catch((error) => {
    console.error("Profile seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
