import test from "node:test";
import assert from "node:assert/strict";
import { createShutdown } from "../src/lib/shutdown.js";

// The old SIGINT/SIGTERM handler disconnected the database before closing HTTP and sockets, and the
// process could stay alive afterwards because of running timers.

function quietLog() {
  const lines: string[] = [];
  return { lines, log: { log: (...args: unknown[]) => void lines.push(args.map(String).join(" ")), error: (...args: unknown[]) => void lines.push(args.map(String).join(" ")) } };
}

test("steps run in the order given, then the process exits with 0", async () => {
  const order: string[] = [];
  const exits: number[] = [];
  const { log } = quietLog();
  const shutdown = createShutdown(
    [
      { name: "HTTP and realtime", run: async () => void order.push("http") },
      { name: "background jobs", run: () => void order.push("timers") },
      { name: "database", run: async () => void order.push("database") },
    ],
    { timeoutMs: 1000, exit: (code) => void exits.push(code), log },
  );
  await shutdown("SIGTERM");
  assert.deepEqual(order, ["http", "timers", "database"]);
  assert.deepEqual(exits, [0]);
});

test("a failing step is logged, the rest still run, and the exit code is 1", async () => {
  const order: string[] = [];
  const exits: number[] = [];
  const { log, lines } = quietLog();
  const shutdown = createShutdown(
    [
      {
        name: "Discord bot",
        run: () => {
          throw new Error("discord down");
        },
      },
      { name: "database", run: async () => void order.push("database") },
    ],
    { timeoutMs: 1000, exit: (code) => void exits.push(code), log },
  );
  await shutdown("SIGINT");
  assert.deepEqual(order, ["database"], "the database is still disconnected");
  assert.deepEqual(exits, [1]);
  assert.ok(lines.some((line) => line.includes("Discord bot failed")));
});

test("a step that hangs is cut off by the hard timeout", async () => {
  const exits: number[] = [];
  const { log, lines } = quietLog();
  const shutdown = createShutdown([{ name: "HTTP and realtime", run: () => new Promise(() => undefined) }], {
    timeoutMs: 50,
    exit: (code) => void exits.push(code),
    log,
  });
  void shutdown("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.deepEqual(exits, [1]);
  assert.ok(lines.some((line) => line.includes("not finished after 50 ms")));
});

test("a second signal while shutting down doesn't start another round", async () => {
  let runs = 0;
  const exits: number[] = [];
  const { log } = quietLog();
  const shutdown = createShutdown([{ name: "database", run: async () => void runs++ }], { timeoutMs: 1000, exit: (code) => void exits.push(code), log });
  const first = shutdown("SIGINT");
  const second = shutdown("SIGINT");
  assert.equal(first, second);
  await first;
  assert.equal(runs, 1);
  assert.deepEqual(exits, [0]);
});
