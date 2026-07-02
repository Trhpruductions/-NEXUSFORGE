import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { EconomyAuthority } from "../lib/economy-authority.js";
import { MiningAuthority } from "../lib/mining-authority.js";

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
        data: { lastHarvestAt: now },
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
 * @desc Harvest tokens from all active rigs
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


export default router;
