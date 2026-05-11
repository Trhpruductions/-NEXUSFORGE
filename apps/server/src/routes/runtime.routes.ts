import { Router } from "express";
import { getLaunchMode } from "../lib/launch-mode.js";

export const runtimeRouter = Router();

runtimeRouter.get("/launch-mode", async (_req, res) => {
  const launchMode = await getLaunchMode();
  res.json(launchMode);
});
