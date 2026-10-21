import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { signAccessToken } from "../src/lib/jwt.js";
import { prisma } from "../src/lib/prisma.js";
import { hasRoomForNewGroup, MAX_GROUPS, MAX_WEB_GROUPS } from "../src/lib/error-log.js";
import { cspReportBodyParser, reportBodyParser } from "../src/middleware/anonymous-limit.js";
import { ANONYMOUS_ERROR_REPORTS_PER_15_MIN, CSP_REPORTS_PER_15_MIN, errorsRouter } from "../src/routes/errors.routes.js";
import { ANONYMOUS_PROBLEM_REPORTS_PER_HOUR, problemReportsRouter } from "../src/routes/problem-reports.routes.js";
import { globalErrorHandler } from "../src/middleware/error-handler.js";
import { assertNotLiveDatabase } from "./helpers/live-database-guard.js";

// Anyone (signed out too) can send crash reports and problem reports. A script could fill the error log, after
// which real server errors were dropped. Writes report rows and one user (removed afterwards), so it must never
// run against the live database.
assertNotLiveDatabase();

test("browser reports can only use part of the error log, so server errors always have room", () => {
  assert.ok(MAX_WEB_GROUPS < MAX_GROUPS);
  assert.equal(hasRoomForNewGroup("web", { total: 10, web: MAX_WEB_GROUPS }), false, "browser reports are full");
  assert.equal(hasRoomForNewGroup("server", { total: MAX_WEB_GROUPS, web: MAX_WEB_GROUPS }), true, "server errors still go in");
  assert.equal(hasRoomForNewGroup("web", { total: 10, web: 9 }), true);
  assert.equal(hasRoomForNewGroup("server", { total: MAX_GROUPS, web: 0 }), false, "the overall cap still holds");
  // Content-policy reports also come from browsers and share the browser part.
  assert.equal(hasRoomForNewGroup("csp", { total: 10, web: MAX_WEB_GROUPS }), false, "content-policy reports share the browser cap");
  assert.equal(hasRoomForNewGroup("csp", { total: 10, web: 9 }), true);
});

const RUN = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const userId = randomUUID();
const app = express();
// Mounted the way index.ts mounts them: the small parser first, then the app-wide one.
app.use(["/api/errors/client", "/api/problem-reports"], reportBodyParser);
app.use("/api/errors/csp", cspReportBodyParser);
app.use(express.json({ limit: "10mb" }));
app.use("/api/errors", errorsRouter);
app.use("/api/problem-reports", problemReportsRouter);
app.use(globalErrorHandler);
const server = app.listen(0, "127.0.0.1");
let token = "";

before(async () => {
  await once(server, "listening");
  await prisma.user.create({
    data: {
      id: userId,
      username: `rl_${RUN}`.slice(0, 32),
      email: `rl_${RUN}@example.com`,
      password: "not-a-login-in-this-test",
      birthdate: new Date("1990-01-01"),
    },
  });
  token = signAccessToken({ sub: userId, username: `rl_${RUN}`.slice(0, 32), email: `rl_${RUN}@example.com`, jti: randomUUID() });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.errorEvent.deleteMany({ where: { OR: [{ message: { contains: RUN } }, { path: { contains: RUN } }] } });
  await prisma.problemReport.deleteMany({ where: { message: { contains: RUN } } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

async function post(path: string, body: unknown, signedIn: boolean, contentType = "application/json") {
  const { port } = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "Content-Type": contentType, ...(signedIn ? { Authorization: `Bearer ${token}` } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  await response.arrayBuffer();
  return response.status;
}

test("signed-out crash reports are limited per address; signed-in ones are not held back by that limit", async () => {
  for (let n = 1; n <= ANONYMOUS_ERROR_REPORTS_PER_15_MIN; n++) {
    assert.equal(await post("/api/errors/client", { message: `anon crash ${n} ${RUN}`, path: "/app" }, false), 204, `anonymous report ${n}`);
  }
  assert.equal(await post("/api/errors/client", { message: `anon crash over ${RUN}` }, false), 429);
  // From the same address, a signed-in person can still report.
  for (let n = 1; n <= ANONYMOUS_ERROR_REPORTS_PER_15_MIN + 2; n++) {
    assert.equal(await post("/api/errors/client", { message: `user crash ${n} ${RUN}` }, true), 204, `signed-in report ${n}`);
  }
  // Repeats of the same problem are grouped (numbers don't count), so add up the group counters.
  const stored = await prisma.errorEvent.aggregate({ where: { message: { contains: RUN } }, _sum: { count: true } });
  assert.equal(stored._sum.count, ANONYMOUS_ERROR_REPORTS_PER_15_MIN * 2 + 2, "every accepted report was recorded, the refused one wasn't");
});

test("report bodies over 16 KB are refused before they are parsed", async () => {
  const big = JSON.stringify({ message: `big ${RUN}`, stack: "x".repeat(20 * 1024) });
  assert.equal(await post("/api/errors/client", big, true), 413);
  assert.equal(await post("/api/problem-reports", JSON.stringify({ kind: "BUG", message: `big ${RUN} ${"y".repeat(20 * 1024)}` }), true), 413);
  // A normal-sized report with a full stack trace still fits.
  assert.equal(await post("/api/errors/client", { message: `normal ${RUN}`, stack: "s".repeat(8000), path: "/app/chat" }, true), 204);
});

test("signed-out problem reports are limited per address; signed-in ones keep their own budget", async () => {
  for (let n = 1; n <= ANONYMOUS_PROBLEM_REPORTS_PER_HOUR; n++) {
    assert.equal(await post("/api/problem-reports", { kind: "SIGN_IN", message: `anonymous problem ${n} ${RUN}` }, false), 201, `anonymous report ${n}`);
  }
  assert.equal(await post("/api/problem-reports", { kind: "SIGN_IN", message: `anonymous problem over ${RUN}` }, false), 429);
  for (let n = 1; n <= ANONYMOUS_PROBLEM_REPORTS_PER_HOUR + 1; n++) {
    assert.equal(await post("/api/problem-reports", { kind: "BUG", message: `signed-in problem ${n} ${RUN}` }, true), 201, `signed-in report ${n}`);
  }
});

test("content-policy reports in both browser formats are recorded, grouped, and limited per address", async () => {
  const page = `https://nfgcord.com/csp-test-${RUN}?invite=SECRET`;
  const legacy = { "csp-report": { "document-uri": page, "effective-directive": "img-src", "blocked-uri": "https://cdn.example.com/a.png?t=1", disposition: "report" } };
  const batch = [{ type: "csp-violation", body: { documentURL: page, effectiveDirective: "frame-src", blockedURL: "https://player.example.tv/x", disposition: "report" } }];
  assert.equal(await post("/api/errors/csp", legacy, false, "application/csp-report"), 204);
  assert.equal(await post("/api/errors/csp", batch, false, "application/reports+json"), 204);
  const rows = await prisma.errorEvent.findMany({ where: { path: { contains: RUN } }, orderBy: { message: "asc" } });
  assert.deepEqual(rows.map((row) => [row.source, row.message, row.path]), [
    ["csp", "Content policy: frame-src would block https://player.example.tv", `/csp-test-${RUN}`],
    ["csp", "Content policy: img-src would block https://cdn.example.com", `/csp-test-${RUN}`],
  ]);
  assert.ok(!JSON.stringify(rows).includes("SECRET"), "the invite code in the page address must not be stored");

  for (let n = 3; n <= CSP_REPORTS_PER_15_MIN; n++) assert.equal(await post("/api/errors/csp", legacy, false, "application/csp-report"), 204, `report ${n}`);
  assert.equal(await post("/api/errors/csp", legacy, false, "application/csp-report"), 429);
  const grouped = await prisma.errorEvent.findFirst({ where: { path: { contains: RUN }, message: { contains: "img-src" } } });
  assert.equal(grouped?.count, CSP_REPORTS_PER_15_MIN - 1, "repeats of one violation are one row with a count");
});
