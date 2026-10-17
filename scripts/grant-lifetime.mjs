#!/usr/bin/env node
/**
 * node scripts/grant-lifetime.mjs <username> [CORE|PLUS|ELITE|INFINITE]
 * node scripts/grant-lifetime.mjs <username> --revoke
 *
 * Gives an account a lifetime Core+ membership (default: INFINITE, the top tier) that is
 * never billed and that Stripe events never lower or remove. --revoke takes it away again.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const [username, option = "INFINITE"] = process.argv.slice(2);
const tiers = ["CORE", "PLUS", "ELITE", "INFINITE"];
const revoke = option === "--revoke";
if (!username || (!revoke && !tiers.includes(option.toUpperCase()))) {
  console.log("Usage: node scripts/grant-lifetime.mjs <username> [CORE|PLUS|ELITE|INFINITE | --revoke]");
  process.exit(1);
}
const tier = option.toUpperCase();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "apps/server/package.json"));
require("dotenv").config({ path: path.join(root, "apps/server/.env"), quiet: true });
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

try {
  const user = await db.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } }, select: { id: true, username: true } });
  if (!user) {
    console.log(`No account named "${username}".`);
    process.exit(1);
  }
  if (revoke) {
    const active = await db.billingSubscription.count({ where: { userId: user.id, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } } });
    await db.user.update({
      where: { id: user.id },
      data: { lifetimeMember: false, lifetimeGrantedAt: null, ...(active ? {} : { premium: false, premiumTier: "NONE" }) },
    });
    console.log(`Lifetime membership removed from ${user.username}${active ? " (their paid subscription stays)" : ""}.`);
  } else {
    await db.user.update({
      where: { id: user.id },
      data: {
        lifetimeMember: true,
        lifetimeGrantedAt: new Date(),
        premium: true,
        premiumTier: tier,
        corePlusActivatedAt: new Date(),
        corePlusBoostLevel: tier === "INFINITE" ? 5 : tier === "ELITE" ? 3 : tier === "PLUS" ? 2 : 1,
      },
    });
    console.log(`${user.username} is now a lifetime ${tier} member.`);
  }
} finally {
  await db.$disconnect();
}
