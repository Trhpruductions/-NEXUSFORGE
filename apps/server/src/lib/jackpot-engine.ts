import { runJackpotTick } from "./jackpot.js";

/**
 * Drives the hourly jackpot: settles rounds whose time is up and opens the next one.
 *
 * This used to grow a free-floating "progressive jackpot" number by ~0.01% every 10s
 * with nothing paying for it. The pot is now funded by ticket sales (see lib/jackpot.ts).
 */
export class JackpotEngine {
  private static timer: NodeJS.Timeout | null = null;
  private static running = false;

  static start() {
    if (this.timer) return;
    console.log("💎 [JACKPOT] Round engine started.");
    const tick = async () => {
      // A slow tick (big round, busy DB) must not overlap the next one.
      if (this.running) return;
      this.running = true;
      try {
        await runJackpotTick();
      } catch (error) {
        console.error("❌ [JACKPOT_ENGINE_FAILURE]", error);
      } finally {
        this.running = false;
      }
    };
    void tick();
    this.timer = setInterval(() => void tick(), 15_000);
  }

  static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
