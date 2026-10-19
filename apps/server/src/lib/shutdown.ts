/**
 * Orderly shutdown for SIGINT/SIGTERM (and pm2's "shutdown" message).
 *
 * The old handler disconnected the database first and closed the HTTP server last, so requests still being
 * answered lost their database half-way, and the background timers (jackpot engine, sweepers) kept the
 * process alive afterwards. The steps now run in the order given (stop taking requests and close live
 * connections, stop the background jobs, then the database), a failing step doesn't stop the rest, and a
 * hard timeout ends the process if anything hangs.
 */
export type ShutdownStep = { name: string; run: () => unknown };

export type ShutdownOptions = {
  /** Exit anyway after this long, whatever is still running. */
  timeoutMs: number;
  exit?: (code: number) => void;
  log?: Pick<Console, "log" | "error">;
};

export function createShutdown(steps: ShutdownStep[], options: ShutdownOptions): (reason: string) => Promise<void> {
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const log = options.log ?? console;
  let running: Promise<void> | null = null;

  return (reason: string) => {
    // A second Ctrl+C or signal while closing doesn't start another round.
    if (running) return running;
    running = (async () => {
      log.log(`[shutdown] ${reason}: closing down`);
      const hardStop = setTimeout(() => {
        log.error(`[shutdown] not finished after ${options.timeoutMs} ms; exiting anyway`);
        exit(1);
      }, options.timeoutMs);

      let failed = false;
      for (const step of steps) {
        try {
          await step.run();
        } catch (error) {
          failed = true;
          log.error(`[shutdown] ${step.name} failed:`, error);
        }
      }
      clearTimeout(hardStop);
      log.log(`[shutdown] finished${failed ? " with errors" : ""}`);
      exit(failed ? 1 : 0);
    })();
    return running;
  };
}
