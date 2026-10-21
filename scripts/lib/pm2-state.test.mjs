// node --test scripts/lib/pm2-state.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { appState, parseJlist } from "./pm2-state.mjs";

const list = [
  { name: "nexusforge-backend-workspace", pm2_env: { status: "online", shutdown_with_message: true } },
  { name: "nexusforge-web-workspace", pm2_env: { status: "online" } },
  { name: "vexora-tunnel", pm2_env: { status: "errored" } },
];

test("the process list is found even when pm2 prints warnings before it", () => {
  const output = [">>>> In-memory PM2 is out-of-date, do:", ">>>> $ pm2 update", JSON.stringify(list), ""].join("\r\n");
  assert.deepEqual(parseJlist(output), list);
  assert.deepEqual(parseJlist(JSON.stringify(list)), list);
});

test("output without a list is reported as unreadable (null), never guessed", () => {
  for (const output of ["", "[PM2] Spawning PM2 daemon with pm2_home=C:\\x", "[not json", null, undefined, "{}"]) {
    assert.equal(parseJlist(output), null, String(output));
  }
});

test("app states: online, missing, a pm2 status, and an API without graceful-shutdown settings", () => {
  assert.equal(appState(list, "nexusforge-backend-workspace"), "online");
  assert.equal(appState(list, "nexusforge-web-workspace"), "online", "only the API needs the shutdown settings");
  assert.equal(appState(list, "vexora-gateway"), "missing");
  assert.equal(appState(list, "vexora-tunnel"), "errored");
  const resurrected = [{ name: "nexusforge-backend-workspace", pm2_env: { status: "online" } }];
  assert.equal(appState(resurrected, "nexusforge-backend-workspace"), "stale-settings");
});
