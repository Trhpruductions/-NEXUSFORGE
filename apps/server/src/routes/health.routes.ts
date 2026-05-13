import { Router } from "express";
import { getDiscordBotStatus } from "../lib/discord-bot.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "nexusforge-api" });
});

healthRouter.get("/health/discord", (_req, res) => {
  res.json({ status: "ok", bot: getDiscordBotStatus() });
});
