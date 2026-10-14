import test from "node:test";
import assert from "node:assert/strict";
import express from "express";

// The handler records errors through prisma; with no real database it just logs that it couldn't.
process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
const { globalErrorHandler } = await import("../src/middleware/error-handler.js");

async function serve() {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.get("/boom", () => {
    throw new Error("relation \"User\" does not exist at db.internal:5433");
  });
  app.post("/echo", (req, res) => res.json(req.body));
  app.use(globalErrorHandler);
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const port = (server.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() };
}

test("a crash gives a friendly message and reference, never the internal error", async () => {
  const s = await serve();
  try {
    const res = await fetch(`${s.url}/boom`);
    const body = (await res.json()) as { error: unknown; reference?: string };
    assert.equal(res.status, 500);
    assert.equal(typeof body.error, "string");
    assert.match(body.error as string, /Something went wrong on our side/);
    assert.ok(body.reference && (body.error as string).includes(body.reference));
    assert.doesNotMatch(JSON.stringify(body), /relation|db\.internal|5433/);
  } finally {
    s.close();
  }
});

test("bad JSON and oversized bodies keep their 4xx status with a plain message", async () => {
  const s = await serve();
  try {
    const bad = await fetch(`${s.url}/echo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{nope" });
    assert.equal(bad.status, 400);
    assert.equal(((await bad.json()) as { error: string }).error, "The request wasn't valid JSON.");
    const big = await fetch(`${s.url}/echo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ x: "y".repeat(5000) }) });
    assert.equal(big.status, 413);
    assert.equal(((await big.json()) as { error: string }).error, "That's too big to send.");
  } finally {
    s.close();
  }
});
