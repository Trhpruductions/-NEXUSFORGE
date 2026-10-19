import test from "node:test";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import { accessLogFormat, installConsoleTimestamps, logTimestampsEnabled, REDACTED, redactUrlForLog, withTimestamp } from "../src/lib/log-format.js";
import { createAccessLogger } from "../src/lib/access-log.js";

// The access log used to print full URLs, tokens included, and nothing in the pm2 logs had a time on it.

test("token-bearing query parameters are redacted, everything else is kept", () => {
  assert.equal(redactUrlForLog("/api/uploads/local?token=abc.def.ghi"), `/api/uploads/local?token=${REDACTED}`);
  assert.equal(redactUrlForLog("/api/auth/verify-email?token=secret123"), `/api/auth/verify-email?token=${REDACTED}`);
  assert.equal(redactUrlForLog("/api/email/unsubscribe?token=s3cr3t&lang=en"), `/api/email/unsubscribe?token=${REDACTED}&lang=en`);
  assert.equal(redactUrlForLog("/api/billing/store/google/rtdn?token=play-secret"), `/api/billing/store/google/rtdn?token=${REDACTED}`);
  assert.equal(redactUrlForLog("/api/discord/callback?code=oauth-code&state=xyz"), `/api/discord/callback?code=${REDACTED}&state=${REDACTED}`);
  assert.equal(
    redactUrlForLog("/uploads/a.png?X-Amz-Credential=AKIA&X-Amz-Signature=deadbeef&X-Amz-Security-Token=t&width=64"),
    `/uploads/a.png?X-Amz-Credential=${REDACTED}&X-Amz-Signature=${REDACTED}&X-Amz-Security-Token=${REDACTED}&width=64`,
  );
  assert.equal(redactUrlForLog("/x?access_token=a&refresh_token=b&client_secret=c&sig=d&key=e&apiKey=f&password=g"),
    `/x?access_token=${REDACTED}&refresh_token=${REDACTED}&client_secret=${REDACTED}&sig=${REDACTED}&key=${REDACTED}&apiKey=${REDACTED}&password=${REDACTED}`);
  assert.equal(redactUrlForLog("/api/forges?limit=20&cursor=abc"), "/api/forges?limit=20&cursor=abc");
  assert.equal(redactUrlForLog("/api/x?%74oken=encoded-name"), `/api/x?%74oken=${REDACTED}`, "an encoded name is still recognised");
  assert.equal(redactUrlForLog("/api/x?flag&token"), "/api/x?flag&token", "names without values carry nothing to hide");
});

test("token-bearing path segments are redacted", () => {
  assert.equal(redactUrlForLog("/api/webhooks/abc123/very-secret-token"), `/api/webhooks/abc123/${REDACTED}`);
  assert.equal(redactUrlForLog("/api/webhooks/abc123/very-secret-token?wait=true"), `/api/webhooks/abc123/${REDACTED}?wait=true`);
  assert.equal(redactUrlForLog("/api/x/eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl/y"), `/api/x/${REDACTED}/y`);
  assert.equal(redactUrlForLog("/api/forges/6f1c2a9e-1b2c-4d5e-8f90-1234567890ab/channels"), "/api/forges/6f1c2a9e-1b2c-4d5e-8f90-1234567890ab/channels");
  assert.equal(redactUrlForLog(undefined), "");
});

test("the error log's paths (printed by the error handler and sent to Discord) lose webhook tokens too", async () => {
  // error-log.ts imports prisma, which needs DATABASE_URL; cleanPath itself is pure.
  process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
  const { cleanPath } = await import("../src/lib/error-log.js");
  assert.equal(cleanPath("/api/webhooks/6f1c2a9e-1b2c-4d5e-8f90-1234567890ab/Zk9vYmFyLXNlY3JldC10b2tlbi12YWx1ZQ?wait=1"), `/api/webhooks/:id/${REDACTED}`);
  assert.equal(cleanPath("/api/auth/reset-password?token=secret123"), "/api/auth/reset-password");
});

test("console lines get one ISO timestamp, never two", () => {
  const now = new Date("2026-10-18T15:25:29.285Z");
  assert.deepEqual(withTimestamp(["[db] idle connection lost:", "boom"], now), ["2026-10-18T15:25:29.285Z [db] idle connection lost:", "boom"]);
  assert.deepEqual(withTimestamp(["2026-10-18T15:25:29.285Z already stamped"], now), ["2026-10-18T15:25:29.285Z already stamped"]);
  const error = new Error("x");
  assert.deepEqual(withTimestamp([error], now), ["2026-10-18T15:25:29.285Z", error], "a non-string first argument keeps its formatting");
  assert.deepEqual(withTimestamp([], now), []);
  assert.deepEqual(withTimestamp(["%s users", 3], now), ["2026-10-18T15:25:29.285Z %s users", 3], "format strings still work");
});

test("installConsoleTimestamps wraps log/info/warn/error/debug once, even if installed twice", () => {
  const lines: unknown[][] = [];
  const record = (...args: unknown[]) => void lines.push(args);
  const target = { log: record, info: record, warn: record, error: record, debug: record } as unknown as Console;
  const clock = () => new Date("2026-10-18T10:24:56.725Z");

  assert.equal(installConsoleTimestamps(target, clock), true);
  assert.equal(installConsoleTimestamps(target, clock), false, "second install is refused");
  target.error("[db] connection refused");
  target.log("hello", 1);
  target.warn("2026-01-01T00:00:00.000Z from a library that stamps its own lines");

  assert.deepEqual(lines, [
    ["2026-10-18T10:24:56.725Z [db] connection refused"],
    ["2026-10-18T10:24:56.725Z hello", 1],
    ["2026-01-01T00:00:00.000Z from a library that stamps its own lines"],
  ]);
});

test("LOG_TIMESTAMPS=off turns timestamps off (for a process manager that adds its own)", () => {
  assert.equal(logTimestampsEnabled({}), true);
  assert.equal(logTimestampsEnabled({ LOG_TIMESTAMPS: "off" }), false);
  assert.equal(logTimestampsEnabled({ LOG_TIMESTAMPS: "false" }), false);
  assert.equal(logTimestampsEnabled({ LOG_TIMESTAMPS: "on" }), true);
  assert.ok(accessLogFormat(true).startsWith(":date[iso] :method :safe-url "));
  assert.ok(!accessLogFormat(false).includes(":date"));
  assert.ok(!accessLogFormat(true).includes(":url"), "the raw URL token is never used");
});

test("the access log writes a timestamped line with the token removed", async () => {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  const app = express();
  app.use(createAccessLogger({ stream, withTimestamp: true }));
  app.get("/api/uploads/local", (_req, res) => void res.status(204).end());
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/api/uploads/local?token=super-secret-upload-token&w=1`);
    assert.equal(response.status, 204);
    // morgan writes when the response finishes.
    for (let i = 0; i < 20 && !lines.length; i++) await new Promise((resolve) => setTimeout(resolve, 10));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  assert.equal(lines.length, 1);
  const line = lines[0];
  assert.match(line, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z GET \/api\/uploads\/local\?token=\[redacted\]&w=1 204 /);
  assert.ok(!line.includes("super-secret-upload-token"));
  assert.match(line, /\[GHOST-IP: [0-9a-f]{12}\.\.\.\]/);
});
