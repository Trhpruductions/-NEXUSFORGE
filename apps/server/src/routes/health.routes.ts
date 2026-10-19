import { Router } from "express";
import { getDiscordBotStatus } from "../lib/discord-bot.js";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "nexusforge-api" });
});

export const READY_TIMEOUT_MS = 5000;

/**
 * Like /health, but also proves the database answers. 503 when it doesn't (watchdog and status card use this).
 * This route is public, so the answer is only "unreachable": the reason (which can name the database host and
 * port) goes to the server log instead.
 */
healthRouter.get("/health/ready", async (_req, res) => {
  const started = Date.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`database did not answer within ${READY_TIMEOUT_MS / 1000} s`)), READY_TIMEOUT_MS);
      }),
    ]);
    res.json({ status: "ok", service: "nexusforge-api", database: "ok", ms: Date.now() - started });
  } catch (error) {
    console.error("[health] readiness check failed:", error instanceof Error ? error.message : String(error));
    res.status(503).json({ status: "degraded", service: "nexusforge-api", database: "unreachable" });
  } finally {
    if (timer) clearTimeout(timer);
  }
});

healthRouter.get("/health/discord", (_req, res) => {
  res.json({ status: "ok", bot: getDiscordBotStatus() });
});
