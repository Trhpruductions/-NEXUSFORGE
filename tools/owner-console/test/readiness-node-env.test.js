"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { effectiveNodeEnv } = require("../lib/readiness");

test("the running backend's NODE_ENV is used when pm2 reports one, even if the env file says otherwise", () => {
  assert.deepEqual(effectiveNodeEnv({ runningValue: "production", fileValue: "development" }), { value: "production", source: "running backend" });
});

test("the env file is the fallback when no backend is running", () => {
  assert.deepEqual(effectiveNodeEnv({ runningValue: null, fileValue: "development" }), { value: "development", source: "env file" });
  assert.deepEqual(effectiveNodeEnv({ runningValue: undefined, fileValue: "" }), { value: "", source: "env file" });
});

test("an empty running value does not count as a value", () => {
  assert.deepEqual(effectiveNodeEnv({ runningValue: "", fileValue: "production" }), { value: "production", source: "env file" });
});
