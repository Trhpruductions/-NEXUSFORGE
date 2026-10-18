/**
 * Runs a startup task (seeding a catalog, loading suspensions) and retries it if the
 * database isn't reachable yet, e.g. when Postgres is still starting after a reboot.
 * Waits 2s, 4s, 8s ... (capped at 60s) between tries.
 */
export function runStartupTask(name: string, task: () => Promise<unknown>, options: { attempts?: number; firstDelayMs?: number } = {}) {
  const attempts = options.attempts ?? 8;
  const firstDelay = options.firstDelayMs ?? 2000;
  const attempt = async (n: number): Promise<void> => {
    try {
      await task();
      if (n > 1) console.log(`[startup] ${name} succeeded on try ${n}`);
    } catch (error) {
      if (n >= attempts) {
        console.error(`[startup] ${name} failed after ${n} tries`, error);
        return;
      }
      const wait = Math.min(firstDelay * 2 ** (n - 1), 60_000);
      console.warn(`[startup] ${name} failed (try ${n} of ${attempts}), retrying in ${Math.round(wait / 1000)}s: ${error instanceof Error ? error.message : String(error)}`);
      await new Promise((resolve) => setTimeout(resolve, wait));
      return attempt(n + 1);
    }
  };
  return attempt(1);
}
