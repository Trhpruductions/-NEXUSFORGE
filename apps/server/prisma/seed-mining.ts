import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";
import path from "path";

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set.");
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
  console.log("⛏ Seeding Industrial Mining Rigs...");

  // Find or create a default user
  let user = await prisma.user.findFirst();
  if (!user) {
    console.log("No user found. Please run user seed first.");
    return;
  }

  const rigs = [
    {
      userId: user.id,
      slug: "rig-01-phoenix",
      name: "PHOENIX-01",
      tier: 2,
      hashRate: 42.5,
      efficiency: 0.95,
      status: "ACTIVE",
    },
    {
      userId: user.id,
      slug: "rig-02-hyperion",
      name: "HYPERION-02",
      tier: 1,
      hashRate: 18.2,
      efficiency: 0.88,
      status: "ACTIVE",
    },
    {
      userId: user.id,
      slug: "rig-03-vortex",
      name: "VORTEX-03",
      tier: 3,
      hashRate: 125.0,
      efficiency: 0.99,
      status: "ACTIVE",
    }
  ];

  for (const rig of rigs) {
    await prisma.miningRig.upsert({
      where: { slug: rig.slug },
      update: rig,
      create: rig,
    });
  }

  console.log("✅ Mining rigs seeded.");
}

seed().catch(console.error).finally(() => prisma.$disconnect());
