import { EconomyAuthority } from "./economy-authority.js";
import { prisma } from "./prisma.js";

export class JackpotEngine {
  private static timer: NodeJS.Timeout | null = null;

  /**
   * Starts the industrial growth engine for all active jackpots.
   */
  static start() {
    if (this.timer) return;
    
    console.log("💎 [JACKPOT] Growth Engine Engaged.");
    
    this.timer = setInterval(async () => {
      try {
        const jackpots = await prisma.progressiveJackpot.findMany();
        
        for (const jackpot of jackpots) {
          // Industrial growth: Value * GrowthRate + Flat 1-100 NC
          const growth = BigInt(Math.floor(Number(jackpot.currentValue) * jackpot.growthRate / 100)) + BigInt(Math.floor(Math.random() * 100) + 1);
          
          await prisma.progressiveJackpot.update({
            where: { id: jackpot.id },
            data: {
              currentValue: { increment: growth }
            }
          });
        }
      } catch (error) {
        console.error("❌ [JACKPOT_ENGINE_FAILURE]", error);
      }
    }, 10000); // 10s industrial heartbeat
  }

  static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
