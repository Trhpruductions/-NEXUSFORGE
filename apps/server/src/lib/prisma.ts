const globalForPrisma = globalThis as any;

const prismaLogLevels =
  process.env.NODE_ENV === "development"
    ? process.env.PRISMA_LOG_QUERIES === "true"
      ? ["query", "warn", "error"] as const
      : ["warn", "error"] as const
    : ["error"] as const;

const [{ PrismaClient }, { PrismaPg }] = await Promise.all([
  import("@prisma/client"),
  import("@prisma/adapter-pg"),
]);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set for Prisma runtime.");
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
    log: prismaLogLevels as any,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
