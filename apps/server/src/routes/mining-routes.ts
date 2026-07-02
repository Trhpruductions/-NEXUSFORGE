import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { EconomyAuthority } from "../lib/economy-authority.js";
import { MiningAuthority, RIG_PRICING } from "../lib/mining-authority.js";

const router = Router();

/**
 * @route GET /api/mining/rigs
 * @desc Get all user mining rigs
 */
router.get("/rigs", requireAuth, async (req, res) => {
  try {
    const rigs = await MiningAuthority.getOperationalReport(req.user!.id);
    res.json({ rigs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/mining/rigs
 * @desc Create a new mining rig (atomic: balance check → deduct → create)
 * @body { name: string, tier: "BASIC" | "STANDARD" | "ADVANCED" | "ELITE" }
 */
router.post("/rigs", requireAuth, async (req, res) => {
  try {
    const body = req.body as any;
    const name = typeof body.name === "string" ? body.name : undefined;
    const tier = typeof body.tier === "string" ? body.tier : undefined;

    // Validation
    if (!name || name.length < 3 || name.length > 50) {
      return res.status(400).json({ error: "Rig name must be 3-50 characters" });
    }
    if (!tier || !RIG_PRICING[tier as keyof typeof RIG_PRICING]) {
      return res.status(400).json({ 
        error: `Invalid tier. Must be one of: ${Object.keys(RIG_PRICING).join(", ")}` 
      });
    }

    const rig = await MiningAuthority.createRig({
      userId: req.user!.id,
      name,
      tier,
    });

    res.status(201).json({ rig });
  } catch (error: any) {
    if (error.message.includes("Insufficient balance")) {
      res.status(402).json({ error: error.message });
    } else {
      console.error(`[MINING_CREATE_ERROR] User=${req.user!.id} Error=${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * @route PATCH /api/mining/rigs/:id
 * @desc Update a mining rig (name, status)
 * @body { name?: string, status?: "ACTIVE" | "PAUSED" | "MAINTENANCE" }
 */
router.patch("/rigs/:id", requireAuth, async (req, res) => {
  try {
    const body = req.body as any;
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
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid updates provided" });
    }

    const rig = await MiningAuthority.updateRig({
      rigId,
      userId: req.user!.id,
      updates,
    });

    res.json({ rig });
  } catch (error: any) {
    if (error.message.includes("not found")) {
      res.status(404).json({ error: error.message });
    } else {
      console.error(`[MINING_UPDATE_ERROR] User=${req.user!.id} RigId=${req.params.id} Error=${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * @route DELETE /api/mining/rigs/:id
 * @desc Decommission a mining rig (harvest pending yield, refund 50%)
 */
router.delete("/rigs/:id", requireAuth, async (req, res) => {
  try {
    const rigId = typeof req.params.id === "string" ? req.params.id : "";
    const result = await MiningAuthority.decommissionRig({
      rigId,
      userId: req.user!.id,
    });

    res.json({ 
      message: "Rig decommissioned",
      refund: result.refundAmount,
      pendingYield: result.pendingYield,
    });
  } catch (error: any) {
    if (error.message.includes("not found")) {
      res.status(404).json({ error: error.message });
    } else {
      console.error(`[MINING_DELETE_ERROR] User=${req.user!.id} RigId=${req.params.id} Error=${error.message}`);
      res.status(500).json({ error: error.message });
    }
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/mining/harvest/:rigId
 * @desc Harvest tokens from a specific rig
 */
router.post("/harvest/:rigId", requireAuth, async (req, res) => {
  try {
    const rig = await prisma.miningRig.findUnique({
      where: { id: req.params.rigId, userId: req.user?.id },
    });

    if (!rig) {
      return res.status(404).json({ error: "Rig not found" });
    }

    if (rig.status !== "ACTIVE") {
      return res.status(400).json({ error: "Rig is not active" });
    }

    const yieldAmount = MiningAuthority.calculatePendingYield(rig);

    if (yieldAmount <= 0n) {
      return res.status(400).json({ error: "No yield to harvest yet" });
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.miningRig.update({
        where: { id: rig.id },
        data: { 
          lastHarvestAt: now,
          totalYield: { increment: yieldAmount },
        },
      });

      await EconomyAuthority.adjustBalance({
        userId: req.user!.id,
        amount: yieldAmount,
        currencyType: "NC",
        reason: `Mining Harvest: ${rig.name}`,
      });
    });

    res.json({ harvested: yieldAmount.toString() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/mining/harvest-all
 * @desc Harvest tokens from all active rigs (atomic)
 */
router.post("/harvest-all", requireAuth, async (req, res) => {
  try {
    const totalHarvested = await MiningAuthority.harvestAll(req.user!.id);
    res.json({ harvested: totalHarvested.toString() });
  } catch (error: any) {
    console.error(`[MINING_HARVEST_ERROR] User=${req.user!.id} Error=${error.message}`);
    res.status(500).json({ error: "Atomic harvest failed. System integrity preserved. Please retry." });
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
