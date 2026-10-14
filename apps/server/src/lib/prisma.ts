import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as any;

const prismaLogLevels =
  process.env.NODE_ENV === "development"
    ? process.env.PRISMA_LOG_QUERIES === "true"
      ? (["query", "warn", "error"] as const)
      : (["warn", "error"] as const)
    : (["error"] as const);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set for Prisma runtime.");
}

// One page load can run several queries at once (the home summary runs six in parallel),
// each on its own connection, so a burst of people opening the app needs headroom: 40 of
// Postgres's 100 connections, and up to 15 s waiting for a free one before a request fails
// (20 and 5 s timed out under a modest load test).
const pool = new pg.Pool({
  connectionString: databaseUrl,
  max: Number(process.env.DB_POOL_MAX || 40),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  // Keep idle connections alive through NAT/firewall timeouts.
  keepAlive: true,
});

// An idle connection that drops (Postgres restarted, network blip) emits "error" on the
// pool. Without a listener Node treats it as unhandled and the whole server exits; the
// pool already discards the broken connection, so logging it is all that's needed.
pool.on("error", (error) => {
  console.error("[db] idle connection lost:", error.message);
});

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: prismaLogLevels as any,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

