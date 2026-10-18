import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { EconomyAuthority } from "./economy-authority.js";
import { randomUUID } from "node:crypto";
import { rigDecommissionReference, rigPurchaseReference } from "./economy-references.js";

export interface MiningStats {
  rigId: string;
  name: string;
  hashRate: number;
  efficiency: number;
  status: string;
  currentYield: string;
  tier: string;
  purchasedAt: Date;
  totalYield: string;
}

export interface RigConfig {
  name: string;
  hashRate: number;
  efficiency: number;
}

// Mining rig pricing tiers
export const RIG_PRICING = {
  BASIC: { name: "BASIC", cost: 5000n, hashRate: 10, efficiency: 0.85 },
  STANDARD: { name: "STANDARD", cost: 15000n, hashRate: 25, efficiency: 0.90 },
  ADVANCED: { name: "ADVANCED", cost: 50000n, hashRate: 75, efficiency: 0.95 },
  ELITE: { name: "ELITE", cost: 150000n, hashRate: 250, efficiency: 0.98 },
};

export class MiningAuthority {
  /**
   * Calculates the current pending yield for a specific rig.
   */
  static calculatePendingYield(rig: { hashRate: number; efficiency: number; lastHarvestAt: Date }) {
    const now = new Date();
    const hours = (now.getTime() - rig.lastHarvestAt.getTime()) / (1000 * 60 * 60);
    // Industrial calculation: HashRate * Hours * Efficiency
    const yield_amount = Math.floor(rig.hashRate * hours * rig.efficiency);
    return BigInt(Math.max(0, yield_amount)); // Prevent negative yields
  }

  /**
   * Validates rig configuration and tier
   */
  static validateRigTier(tier: string): typeof RIG_PRICING[keyof typeof RIG_PRICING] | null {
    // Own keys only: "constructor" or "toString" would otherwise look like a tier with no price.
    return Object.prototype.hasOwnProperty.call(RIG_PRICING, tier) ? RIG_PRICING[tier as keyof typeof RIG_PRICING] : null;
  }

  /**
   * Buys a rig: the coins are taken and the rig created in one serializable transaction.
   * Throws InsufficientBalanceError if the player can't afford it.
   */
  static async createRig(params: {
    userId: string;
    name: string;
    tier: string;
  }): Promise<any> {
    const tierConfig = this.validateRigTier(params.tier);
    if (!tierConfig) {
      throw new Error(`Invalid rig tier: ${params.tier}`);
    }

    return EconomyAuthority.serializable(async (tx, retryCount) => {
      await EconomyAuthority.applyChange(tx, {
        userId: params.userId,
        amount: -tierConfig.cost,
        currencyType: "NC",
        type: "MINING_RIG_PURCHASE",
        reason: `Mining Rig Purchase: ${params.tier}`,
        referenceId: rigPurchaseReference(params.userId, randomUUID()),
      }, retryCount);

      const rig = await tx.miningRig.create({
        data: {
          userId: params.userId,
          name: params.name,
          hashRate: tierConfig.hashRate,
          efficiency: tierConfig.efficiency,
          status: "ACTIVE",
          lastHarvestAt: new Date(),
          totalYield: 0n,
          tier: params.tier,
        },
      });

      console.log(`[MINING] Rig created: user=${params.userId}, tier=${params.tier}, cost=${tierConfig.cost}`);
      return rig;
    });
  }

  /**
   * Marks a rig harvested, but only if nobody harvested it since we read it. Returns
   * whether this call won; two simultaneous harvests can't both pay out.
   */
  private static async claimHarvest(tx: Prisma.TransactionClient, rig: { id: string; lastHarvestAt: Date }, amount: bigint, now: Date) {
    const claimed = await tx.miningRig.updateMany({
      where: { id: rig.id, lastHarvestAt: rig.lastHarvestAt },
      data: { lastHarvestAt: now, totalYield: { increment: amount } },
    });
    return claimed.count === 1;
  }

  /** Harvests one of the player's active rigs. Returns the coins paid (0 if nothing was due). */
  static async harvestRig(userId: string, rigId: string): Promise<{ status: "ok" | "not_found" | "inactive" | "empty"; harvested: bigint }> {
    return EconomyAuthority.serializable(async (tx, retryCount) => {
      const rig = await tx.miningRig.findFirst({ where: { id: rigId, userId } });
      if (!rig) return { status: "not_found" as const, harvested: 0n };
      if (rig.status !== "ACTIVE") return { status: "inactive" as const, harvested: 0n };
      const amount = this.calculatePendingYield(rig);
      const now = new Date();
      if (amount <= 0n || !(await this.claimHarvest(tx, rig, amount, now))) return { status: "empty" as const, harvested: 0n };
      await EconomyAuthority.applyChange(tx, { userId, amount, currencyType: "NC", reason: `Mining Harvest: ${rig.name}` }, retryCount);
      return { status: "ok" as const, harvested: amount };
    });
  }

  /**
   * Renames a rig or changes its status. Pausing pays out what it earned so far; resuming
   * starts the clock again, so a paused rig really earns nothing.
   */
  static async updateRig(params: {
    rigId: string;
    userId: string;
    updates: Partial<{ name: string; status: string }>;
  }): Promise<any> {
    const validStatuses = ["ACTIVE", "PAUSED", "MAINTENANCE"];
    if (params.updates.status && !validStatuses.includes(params.updates.status)) {
      throw new Error(`Invalid status: ${params.updates.status}`);
    }

    return EconomyAuthority.serializable(async (tx, retryCount) => {
      const rig = await tx.miningRig.findFirst({ where: { id: params.rigId, userId: params.userId } });
      if (!rig) {
        throw new Error("Rig not found or access denied");
      }

      const now = new Date();
      const data: { name?: string; status?: string; lastHarvestAt?: Date } = { ...params.updates };
      const stopping = rig.status === "ACTIVE" && params.updates.status && params.updates.status !== "ACTIVE";
      const starting = rig.status !== "ACTIVE" && params.updates.status === "ACTIVE";

      if (stopping) {
        const amount = this.calculatePendingYield(rig);
        if (amount > 0n && (await this.claimHarvest(tx, rig, amount, now))) {
          await EconomyAuthority.applyChange(tx, { userId: params.userId, amount, currencyType: "NC", reason: `Mining Harvest: ${rig.name} (paused)` }, retryCount);
        }
      }
      if (starting) data.lastHarvestAt = now;

      const updated = await tx.miningRig.update({ where: { id: rig.id }, data });
      console.log(`[MINING] Rig updated: rigId=${params.rigId}, updates=${JSON.stringify(params.updates)}`);
      return updated;
    });
  }

  /**
   * Decommissions a rig: pays out what it earned, refunds half its price and deletes it,
   * all in one transaction (it used to credit in separate transactions).
   */
  static async decommissionRig(params: {
    rigId: string;
    userId: string;
  }): Promise<any> {
    return EconomyAuthority.serializable(async (tx, retryCount) => {
      const rig = await tx.miningRig.findFirst({ where: { id: params.rigId, userId: params.userId } });
      if (!rig) {
        throw new Error("Rig not found or access denied");
      }

      // Delete first: a second, simultaneous decommission finds nothing and gets no refund.
      const removed = await tx.miningRig.deleteMany({ where: { id: rig.id, userId: params.userId } });
      if (removed.count !== 1) {
        throw new Error("Rig not found or access denied");
      }

      const pendingYield = rig.status === "ACTIVE" ? this.calculatePendingYield(rig) : 0n;
      if (pendingYield > 0n) {
        await EconomyAuthority.applyChange(tx, { userId: params.userId, amount: pendingYield, currencyType: "NC", reason: `Final Harvest: ${rig.name} (Decommissioning)` }, retryCount);
      }

      const tierConfig = this.validateRigTier(rig.tier || "BASIC");
      const refundAmount = (tierConfig?.cost || 5000n) / 2n;
      await EconomyAuthority.applyChange(tx, {
        userId: params.userId,
        amount: refundAmount,
        currencyType: "NC",
        type: "MINING_RIG_REFUND",
        reason: `Mining Rig Decommission Refund: ${rig.name}`,
        referenceId: rigDecommissionReference(params.userId, rig.id),
      }, retryCount);

      console.log(`[MINING] Rig decommissioned: rigId=${params.rigId}, refund=${refundAmount}, pendingYield=${pendingYield}`);
      return { rigId: params.rigId, refundAmount: refundAmount.toString(), pendingYield: pendingYield.toString() };
    });
  }

  /** Harvests all of the player's active rigs in one transaction. */
  static async harvestAll(userId: string) {
    return EconomyAuthority.serializable(async (tx, retryCount) => {
      const rigs = await tx.miningRig.findMany({ where: { userId, status: "ACTIVE" } });
      let totalHarvested = 0n;
      const now = new Date();

      for (const rig of rigs) {
        const amount = this.calculatePendingYield(rig);
        if (amount > 0n && (await this.claimHarvest(tx, rig, amount, now))) totalHarvested += amount;
      }

      if (totalHarvested > 0n) {
        await EconomyAuthority.applyChange(tx, { userId, amount: totalHarvested, currencyType: "NC", reason: "Global Mining Harvest" }, retryCount);
      }

      console.log(`[MINING] Harvest complete: userId=${userId}, rigs=${rigs.length}, total=${totalHarvested}`);
      return totalHarvested;
    });
  }

  /**
   * Retrieves detailed operational stats for user rigs.
   */
  static async getOperationalReport(userId: string): Promise<MiningStats[]> {
    const rigs = await prisma.miningRig.findMany({
      where: { userId },
      orderBy: { purchasedAt: "desc" },
    });

    return rigs.map((rig) => ({
      rigId: rig.id,
      name: rig.name,
      hashRate: rig.hashRate,
      efficiency: rig.efficiency,
      status: rig.status,
      currentYield: (rig.status === "ACTIVE" ? this.calculatePendingYield(rig) : 0n).toString(),
      tier: rig.tier,
      purchasedAt: rig.purchasedAt,
      totalYield: rig.totalYield?.toString() || "0",
    }));
  }

  /**
   * Gets aggregate mining stats for a user.
   */
  static async getMiningStats(userId: string): Promise<any> {
    const rigs = await prisma.miningRig.findMany({
      where: { userId },
    });

    const totalHashRate = rigs.reduce((sum, r) => sum + r.hashRate, 0);
    const avgEfficiency = rigs.length > 0 
      ? rigs.reduce((sum, r) => sum + r.efficiency, 0) / rigs.length 
      : 0;
    const activeRigs = rigs.filter(r => r.status === "ACTIVE").length;
    const totalYield = rigs.reduce((sum, r) => sum + (r.totalYield || 0n), 0n);
    const pendingYield = rigs.reduce((sum, r) => sum + this.calculatePendingYield(r), 0n);

    return {
      rigCount: rigs.length,
      activeRigs,
      totalHashRate,
      avgEfficiency: parseFloat(avgEfficiency.toFixed(4)),
      totalYield: totalYield.toString(),
      pendingYield: pendingYield.toString(),
      estimatedHourlyIncome: BigInt(Math.floor(totalHashRate * avgEfficiency)).toString(),
    };
  }
}
