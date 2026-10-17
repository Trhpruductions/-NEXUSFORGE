"use strict";

// The console probes only the app's own localhost ports and the public site, with read-only GETs.
// Port 3000 belongs to another bot on this PC and is never probed.

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const https = require("node:https");
const { HEALTH_TARGETS, RESERVED_PORTS } = require("../lib/config");
const { clientFor } = require("../lib/collectors/health");

const ALLOWED_LOCAL_PORTS = new Set([3300, 3400, 4001]);

test("every health target is a localhost app port or the public nfgcord.com site", () => {
  for (const target of HEALTH_TARGETS) {
    const url = new URL(target.url);
    if (url.hostname === "127.0.0.1") {
      assert.ok(ALLOWED_LOCAL_PORTS.has(Number(url.port)), `${target.key} probes an unexpected local port`);
      assert.equal(RESERVED_PORTS.has(3000), true);
      assert.notEqual(Number(url.port), 3000);
    } else {
      assert.equal(url.protocol, "https:", `${target.key} must use https for the public site`);
      assert.equal(url.hostname, "nfgcord.com", `${target.key} probes a host outside the allowlist`);
    }
  }
});

test("the public website and public API readiness are both probed", () => {
  const keys = HEALTH_TARGETS.map((target) => target.key);
  assert.ok(keys.includes("public-site"));
  assert.ok(keys.includes("public-api"));
  const readiness = HEALTH_TARGETS.find((target) => target.key === "public-api");
  assert.equal(new URL(readiness.url).pathname, "/api/health/ready");
});

test("https targets use the https client and localhost targets use the http client", () => {
  assert.equal(clientFor("https://nfgcord.com/"), https);
  assert.equal(clientFor("http://127.0.0.1:4001/api/health"), http);
});

test("probe targets have unique keys and timeouts", () => {
  const keys = HEALTH_TARGETS.map((target) => target.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const target of HEALTH_TARGETS) assert.ok(target.timeoutMs > 0 && target.timeoutMs <= 10000, `${target.key} timeout`);
});
