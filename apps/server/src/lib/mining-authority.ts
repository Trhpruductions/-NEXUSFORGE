import { prisma } from "./prisma.js";
import { EconomyAuthority } from "./economy-authority.js";

export interface MiningStats {
  rigId: string;
  name: string;
  hashRate: number;
  efficiency: number;
  status: string;
  currentYield: string;
  nextTemperatureRisk: number;
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
    return RIG_PRICING[tier as keyof typeof RIG_PRICING] || null;
  }

  /**
   * Creates a new mining rig for a user (atomic with balance deduction).
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

    // Atomic transaction: check balance → deduct → create rig
    return prisma.$transaction(async (tx) => {
      // 1. Check user balance
      const account = await tx.economyAccount.findUnique({
        where: {
          userId_currencyType: {
            userId: params.userId,
            currencyType: "NC",
          },
        },
      });

      if (!account || account.balance < tierConfig.cost) {
        throw new Error(`Insufficient balance. Required: ${tierConfig.cost}, Available: ${account?.balance || 0n}`);
      }

      // 2. Deduct cost from balance
      await tx.economyAccount.update({
        where: {
          userId_currencyType: {
            userId: params.userId,
            currencyType: "NC",
          },
        },
        data: {
          balance: { decrement: tierConfig.cost },
        },
      });

      // 3. Create transaction log entry
      await tx.economyTransaction.create({
        data: {
          userId: params.userId,
          amount: tierConfig.cost,
          type: "MINING_RIG_PURCHASE",
          reason: `Mining Rig Purchase: ${params.tier}`,
          balanceBefore: account.balance,
          balanceAfter: account.balance - tierConfig.cost,
          referenceId: `RIG_PURCHASE_${Date.now()}`,
        },
      });

      // 4. Create mining rig
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
   * Updates a mining rig (name, power level, status).
   */
  static async updateRig(params: {
    rigId: string;
    userId: string;
    updates: Partial<{ name: string; status: string }>;
  }): Promise<any> {
    // Validate ownership
    const rig = await prisma.miningRig.findUnique({
      where: { id: params.rigId },
    });

    if (!rig || rig.userId !== params.userId) {
      throw new Error("Rig not found or access denied");
    }

    // Validate status if being changed
    const validStatuses = ["ACTIVE", "PAUSED", "MAINTENANCE"];
    if (params.updates.status && !validStatuses.includes(params.updates.status)) {
      throw new Error(`Invalid status: ${params.updates.status}`);
    }

    const updated = await prisma.miningRig.update({
      where: { id: params.rigId },
      data: params.updates,
    });

    console.log(`[MINING] Rig updated: rigId=${params.rigId}, updates=${JSON.stringify(params.updates)}`);
    return updated;
  }

  /**
   * Decommissions a mining rig (refund 50% of cost to user).
   */
  static async decommissionRig(params: {
    rigId: string;
    userId: string;
  }): Promise<any> {
    return prisma.$transaction(async (tx) => {
      // 1. Validate ownership
      const rig = await tx.miningRig.findUnique({
        where: { id: params.rigId },
      });

      if (!rig || rig.userId !== params.userId) {
        throw new Error("Rig not found or access denied");
      }

      // 2. Harvest any pending yield before deletion
      const pendingYield = this.calculatePendingYield(rig);
      if (pendingYield > 0n) {
        await EconomyAuthority.adjustBalance({
          userId: params.userId,
          amount: pendingYield,
          currencyType: "NC",
          reason: `Final Harvest: ${rig.name} (Decommissioning)`,
        });
      }

      // 3. Calculate refund (50% of purchase cost)
      const tierConfig = this.validateRigTier(rig.tier || "BASIC");
      const refundAmount = (tierConfig?.cost || 5000n) / 2n;

      // 4. Refund to user balance
      const account = await tx.economyAccount.findUnique({
        where: {
          userId_currencyType: {
            userId: params.userId,
            currencyType: "NC",
          },
        },
      });

      await tx.economyAccount.update({
        where: {
          userId_currencyType: {
            userId: params.userId,
            currencyType: "NC",
          },
        },
        data: {
          balance: { increment: refundAmount },
        },
      });

      // 5. Log refund transaction
      await tx.economyTransaction.create({
        data: {
          userId: params.userId,
          amount: refundAmount,
          type: "MINING_RIG_REFUND",
          reason: `Mining Rig Decommission Refund: ${rig.name}`,
          balanceBefore: account?.balance || 0n,
          balanceAfter: (account?.balance || 0n) + refundAmount,
          referenceId: `RIG_DECOMMISSION_${rig.id}`,
        },
      });

      // 6. Delete rig
      await tx.miningRig.delete({
        where: { id: params.rigId },
      });

      console.log(`[MINING] Rig decommissioned: rigId=${params.rigId}, refund=${refundAmount}, pendingYield=${pendingYield}`);
      return { rigId: params.rigId, refundAmount: refundAmount.toString(), pendingYield: pendingYield.toString() };
    });
  }

  /**
   * Harvests all active rigs for a user (atomic transaction).
   */
  static async harvestAll(userId: string) {
    return prisma.$transaction(async (tx) => {
      const rigs = await tx.miningRig.findMany({
        where: { userId, status: "ACTIVE" },
      });

      let totalHarvested = 0n;
      const now = new Date();

      for (const rig of rigs) {
        const yieldAmount = this.calculatePendingYield(rig);
        if (yieldAmount > 0n) {
          totalHarvested += yieldAmount;
          await tx.miningRig.update({
            where: { id: rig.id },
            data: { 
              lastHarvestAt: now,
              totalYield: { increment: yieldAmount },
            },
          });
        }
      }

      if (totalHarvested > 0n) {
        await EconomyAuthority.adjustBalance({
          userId,
          amount: totalHarvested,
          currencyType: "NC",
          reason: "Global Mining Harvest",
        });
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
      currentYield: this.calculatePendingYield(rig).toString(),
      nextTemperatureRisk: Math.random() * 100,
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
