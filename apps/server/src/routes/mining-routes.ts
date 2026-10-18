import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { miningRateLimit } from "../middleware/economy-rate-limit.js";
import { InsufficientBalanceError } from "../lib/economy-authority.js";
import { MiningAuthority, RIG_PRICING } from "../lib/mining-authority.js";

const router = Router();

const RIG_STATUSES = new Set(["ACTIVE", "PAUSED", "MAINTENANCE"]);

/** True for the "no such rig (or not yours)" errors MiningAuthority throws. */
function isRigNotFound(error: unknown) {
  return error instanceof Error && error.message.includes("not found");
}

/**
 * The full error goes to the server log only. Error messages can carry database details, so the
 * player gets a plain sentence instead (these routes used to send error.message back as is).
 */
function failed(res: import("express").Response, label: string, context: Record<string, unknown>, error: unknown, message: string) {
  console.error(`[${label}]`, { ...context, error });
  res.status(500).json({ error: message });
}

/**
 * @route GET /api/mining/rigs
 * @desc Get all user mining rigs
 */
router.get("/rigs", requireAuth, async (req, res) => {
  try {
    const rigs = await MiningAuthority.getOperationalReport(req.user!.id);
    res.json({ rigs });
  } catch (error) {
    failed(res, "MINING_LIST_ERROR", { userId: req.user!.id }, error, "Your rigs could not be loaded. Please try again.");
  }
});

/**
 * @route POST /api/mining/rigs
 * @desc Create a new mining rig (atomic: balance check → deduct → create)
 * @body { name: string, tier: "BASIC" | "STANDARD" | "ADVANCED" | "ELITE" }
 */
router.post("/rigs", requireAuth, requireCsrf, miningRateLimit, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name : undefined;
  const tier = typeof body.tier === "string" ? body.tier : undefined;

  // Validation
  if (!name || name.length < 3 || name.length > 50) {
    return res.status(400).json({ error: "Rig name must be 3-50 characters" });
  }
  if (!tier || !Object.prototype.hasOwnProperty.call(RIG_PRICING, tier)) {
    return res.status(400).json({
      error: `Invalid tier. Must be one of: ${Object.keys(RIG_PRICING).join(", ")}`
    });
  }

  try {
    const rig = await MiningAuthority.createRig({
      userId: req.user!.id,
      name,
      tier,
    });

    res.status(201).json({ rig });
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      res.status(402).json({ error: "Not enough Nexus Forge Coins.", code: "INSUFFICIENT" });
      return;
    }
    failed(res, "MINING_CREATE_ERROR", { userId: req.user!.id, tier }, error, "The rig could not be bought. No coins were taken.");
  }
});

/**
 * @route PATCH /api/mining/rigs/:id
 * @desc Update a mining rig (name, status)
 * @body { name?: string, status?: "ACTIVE" | "PAUSED" | "MAINTENANCE" }
 */
router.patch("/rigs/:id", requireAuth, requireCsrf, miningRateLimit, async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name : undefined;
  const status = typeof body.status === "string" ? body.status : undefined;
  const rigId = typeof req.params.id === "string" ? req.params.id : "";
  const updates: Record<string, string> = {};

  if (name !== undefined) {
    if (name.length < 3 || name.length > 50) {
      return res.status(400).json({ error: "Rig name must be 3-50 characters" });
    }
    updates.name = name;
  }

  if (status !== undefined) {
    // Checked here so a bad value is a 400, not a server error.
    if (!RIG_STATUSES.has(status)) {
      return res.status(400).json({ error: `Status must be one of: ${[...RIG_STATUSES].join(", ")}` });
    }
    updates.status = status;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid updates provided" });
  }

  try {
    const rig = await MiningAuthority.updateRig({
      rigId,
      userId: req.user!.id,
      updates,
    });

    res.json({ rig });
  } catch (error) {
    if (isRigNotFound(error)) {
      res.status(404).json({ error: "Rig not found" });
      return;
    }
    failed(res, "MINING_UPDATE_ERROR", { userId: req.user!.id, rigId }, error, "The rig could not be updated. Please try again.");
  }
});

/**
 * @route DELETE /api/mining/rigs/:id
 * @desc Decommission a mining rig (harvest pending yield, refund 50%)
 */
router.delete("/rigs/:id", requireAuth, requireCsrf, miningRateLimit, async (req, res) => {
  const rigId = typeof req.params.id === "string" ? req.params.id : "";
  try {
    const result = await MiningAuthority.decommissionRig({
      rigId,
      userId: req.user!.id,
    });

    res.json({
      message: "Rig decommissioned",
      refund: result.refundAmount,
      pendingYield: result.pendingYield,
    });
  } catch (error) {
    if (isRigNotFound(error)) {
      res.status(404).json({ error: "Rig not found" });
      return;
    }
    failed(res, "MINING_DELETE_ERROR", { userId: req.user!.id, rigId }, error, "The rig could not be decommissioned. Nothing was changed.");
  }
});

/**
 * @route GET /api/mining/stats
 * @desc Get aggregate mining statistics
 */
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const stats = await MiningAuthority.getMiningStats(req.user!.id);
    res.json(stats);
  } catch (error) {
    failed(res, "MINING_STATS_ERROR", { userId: req.user!.id }, error, "Mining stats could not be loaded. Please try again.");
  }
});

/**
 * @route POST /api/mining/harvest/:rigId
 * @desc Harvest tokens from a specific rig
 */
router.post("/harvest/:rigId", requireAuth, requireCsrf, miningRateLimit, async (req, res) => {
  try {
    // One transaction that claims the rig first, so two clicks can't both pay out.
    const result = await MiningAuthority.harvestRig(req.user!.id, String(req.params.rigId));
    if (result.status === "not_found") return res.status(404).json({ error: "Rig not found" });
    if (result.status === "inactive") return res.status(400).json({ error: "Rig is not active" });
    if (result.status === "empty") return res.status(400).json({ error: "No yield to harvest yet" });
    res.json({ harvested: result.harvested.toString() });
  } catch (error) {
    failed(res, "MINING_HARVEST_ERROR", { userId: req.user!.id, rigId: String(req.params.rigId) }, error, "The harvest could not be completed. Please try again.");
  }
});

/**
 * @route POST /api/mining/harvest-all
 * @desc Harvest tokens from all active rigs (atomic)
 */
router.post("/harvest-all", requireAuth, requireCsrf, miningRateLimit, async (req, res) => {
  try {
    const totalHarvested = await MiningAuthority.harvestAll(req.user!.id);
    res.json({ harvested: totalHarvested.toString() });
  } catch (error) {
    failed(res, "MINING_HARVEST_ERROR", { userId: req.user!.id }, error, "Atomic harvest failed. System integrity preserved. Please retry.");
  }
});

/**
 * @route GET /api/mining/pricing
 * @desc Get available rig tiers and pricing
 */
router.get("/pricing", (req, res) => {
  res.json(Object.entries(RIG_PRICING).map(([tier, config]) => ({
    tier,
    cost: config.cost.toString(),
    hashRate: config.hashRate,
    efficiency: config.efficiency,
  })));
});

export default router;
