import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-at-least-32-characters";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-at-least-32-characters";

const { buildIceServers } = await import("../src/lib/ice-servers.js");

test("without TURN settings only the public STUN servers are returned", () => {
  const servers = buildIceServers("user-1", { turnCredentialTtlSeconds: 3600 });
  assert.equal(servers.length, 1);
  assert.ok(servers[0].urls.every((url) => url.startsWith("stun:")));
  assert.equal(servers[0].credential, undefined);
});

test("a TURN secret without any URLs does not add a relay", () => {
  const servers = buildIceServers("user-1", { turnSharedSecret: "s3cret", turnCredentialTtlSeconds: 3600 });
  assert.equal(servers.length, 1);
});

test("TURN URLs without a secret do not add a relay either", () => {
  const servers = buildIceServers("user-1", { turnUrls: "turn:relay.example.com:3478", turnCredentialTtlSeconds: 3600 });
  assert.equal(servers.length, 1);
});

test("TURN URLs with a secret add a relay with an expiring HMAC credential", () => {
  const now = Date.UTC(2026, 9, 14, 12, 0, 0);
  const servers = buildIceServers(
    "user-1",
    {
      turnUrls: "turn:relay.example.com:3478?transport=udp, turns:relay.example.com:5349",
      turnSharedSecret: "s3cret",
      turnCredentialTtlSeconds: 600,
    },
    now
  );
  assert.equal(servers.length, 2);
  const relay = servers[1];
  assert.deepEqual(relay.urls, ["turn:relay.example.com:3478?transport=udp", "turns:relay.example.com:5349"]);
  const expiry = Math.floor(now / 1000) + 600;
  assert.equal(relay.username, `${expiry}:user-1`);
  assert.equal(relay.credential, createHmac("sha1", "s3cret").update(`${expiry}:user-1`).digest("base64"));
});

test("each user gets their own credential, so one user's name cannot be reused for another", () => {
  const config = { turnUrls: "turn:relay.example.com:3478", turnSharedSecret: "s3cret", turnCredentialTtlSeconds: 600 };
  const now = Date.UTC(2026, 9, 14, 12, 0, 0);
  const alice = buildIceServers("alice", config, now)[1];
  const bob = buildIceServers("bob", config, now)[1];
  assert.notEqual(alice.username, bob.username);
  assert.notEqual(alice.credential, bob.credential);
});
