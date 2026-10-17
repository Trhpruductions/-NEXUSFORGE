import { test } from "node:test";
import assert from "node:assert/strict";
import { serverLandingHref } from "../src/lib/server-routes";

test("a server opens on its channel list when no channel is remembered", () => {
  assert.equal(serverLandingHref("forge-1"), "/app/chat?forge=forge-1");
  assert.equal(serverLandingHref("forge-1", null), "/app/chat?forge=forge-1");
  assert.equal(serverLandingHref("forge-1", ""), "/app/chat?forge=forge-1");
});

test("a server reopens on the channel last used there", () => {
  assert.equal(serverLandingHref("forge-1", "chan-9"), "/app/chat?forge=forge-1&channel=chan-9");
});

test("ids are encoded so they cannot add parameters", () => {
  assert.equal(serverLandingHref("a b", "c&d"), "/app/chat?forge=a%20b&channel=c%26d");
});
