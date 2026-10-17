import { Router } from "express";
import { getDiscordBotStatus } from "../lib/discord-bot.js";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "nexusforge-api" });
});

/** Like /health, but also proves the database answers. 503 when it doesn't (watchdog and status card use this). */
healthRouter.get("/health/ready", async (_req, res) => {
  const started = Date.now();
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error("database did not answer within 5 s")), 5000)),
    ]);
    res.json({ status: "ok", service: "nexusforge-api", database: "ok", ms: Date.now() - started });
  } catch (error) {
    res.status(503).json({ status: "degraded", service: "nexusforge-api", database: "unreachable", error: error instanceof Error ? error.message : String(error) });
  }
});

healthRouter.get("/health/discord", (_req, res) => {
  res.json({ status: "ok", bot: getDiscordBotStatus() });
});
