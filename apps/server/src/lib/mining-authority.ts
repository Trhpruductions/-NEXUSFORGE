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
}

export class MiningAuthority {
  /**
   * Calculates the current pending yield for a specific rig.
   */
  static calculatePendingYield(rig: { hashRate: number; efficiency: number; lastHarvestAt: Date }) {
    const now = new Date();
    const hours = (now.getTime() - rig.lastHarvestAt.getTime()) / (1000 * 60 * 60);
    // Industrial calculation: HashRate * Hours * Efficiency
    return BigInt(Math.floor(rig.hashRate * hours * rig.efficiency));
  }

  /**
   * Harvests all active rigs for a user.
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
            data: { lastHarvestAt: now },
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

      return totalHarvested;
    });
  }

  /**
   * Retrieves detailed operational stats for user rigs.
   */
  static async getOperationalReport(userId: string): Promise<MiningStats[]> {
    const rigs = await prisma.miningRig.findMany({
      where: { userId },
    });

    return rigs.map((rig) => ({
      rigId: rig.id,
      name: rig.name,
      hashRate: rig.hashRate,
      efficiency: rig.efficiency,
      status: rig.status,
      currentYield: this.calculatePendingYield(rig).toString(),
      nextTemperatureRisk: Math.random() * 100, // Placeholder for future heat simulation
    }));
  }
}
