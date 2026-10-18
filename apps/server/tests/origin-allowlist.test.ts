import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { allowedOriginList, isAllowedOrigin } from "../src/lib/origins.js";
import { ageRouter } from "../src/routes/age.routes.js";

const production = allowedOriginList({ clientOrigin: "https://nfgcord.com", appWebUrl: "https://nfgcord.com", nodeEnv: "production" });
const development = allowedOriginList({ clientOrigin: "http://127.0.0.1:3300", appWebUrl: "https://nfgcord.com", nodeEnv: "development" });

test("production accepts the public web address and nothing that only resembles it", () => {
  assert.equal(isAllowedOrigin("https://nfgcord.com", production, "production"), true);
  assert.equal(isAllowedOrigin("https://nfgcord.com.evil.example", production, "production"), false);
  assert.equal(isAllowedOrigin("https://evil.example/nfgcord.com", production, "production"), false);
  assert.equal(isAllowedOrigin("http://nfgcord.com", production, "production"), false, "plain http is a different origin");
});

test("production refuses local addresses even when they appear in the origin", () => {
  assert.equal(isAllowedOrigin("http://localhost:3300", production, "production"), false);
  assert.equal(isAllowedOrigin("http://127.0.0.1:3300", production, "production"), false);
  assert.equal(isAllowedOrigin("https://evil.example/localhost", production, "production"), false);
});

test("the old substring matches no longer pass", () => {
  for (const origin of ["https://nexusforge.app.evil.example", "https://vexoragaming.com.attacker.test", "https://evilvexoragaming.com", "https://evil.example/?nexusforge.app"]) {
    assert.equal(isAllowedOrigin(origin, development, "development"), false, origin);
  }
});

test("development accepts the configured origins and any local dev port", () => {
  assert.equal(isAllowedOrigin("http://127.0.0.1:3300", development, "development"), true);
  assert.equal(isAllowedOrigin("http://localhost:3300", development, "development"), true);
  assert.equal(isAllowedOrigin("http://localhost:5555", development, "development"), true);
  assert.equal(isAllowedOrigin("https://localhost.evil.example", development, "development"), false);
});

test("a missing origin is allowed, and the literal 'null' origin is refused", () => {
  assert.equal(isAllowedOrigin(undefined, production, "production"), true);
  assert.equal(isAllowedOrigin("null", production, "production"), false);
});

test("the age gate route applies the same exact check to real requests", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/age", ageRouter);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;

  const post = (headers: Record<string, string>) =>
    new Promise<{ status: number }>((resolve, reject) => {
      const req = http.request(
        { host: "127.0.0.1", port, path: "/api/age/verify", method: "POST", headers: { "content-type": "application/json", ...headers } },
        (res) => {
          res.resume();
          resolve({ status: res.statusCode ?? 0 });
        },
      );
      req.on("error", reject);
      req.end(JSON.stringify({ confirmed: true }));
    });

  try {
    assert.equal((await post({ origin: "http://127.0.0.1:3300" })).status, 200, "the app's own origin is accepted");
    assert.equal((await post({})).status, 200, "a request with no origin is accepted");
    assert.equal((await post({ origin: "https://nexusforge.app.evil.example" })).status, 403, "a lookalike domain is refused");
    assert.equal((await post({ origin: "https://evil.example/localhost" })).status, 403, "localhost in the path is refused");
    assert.equal((await post({ referer: "https://evil.example/localhost" })).status, 403, "the referer is checked too");
    assert.equal((await post({ referer: "not a url" })).status, 403, "an unreadable referer is refused");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
