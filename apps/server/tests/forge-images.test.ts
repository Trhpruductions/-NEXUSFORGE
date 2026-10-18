import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

// Throwaway secrets for this run only; the env schema is read when config/env.ts loads.
process.env.JWT_ACCESS_SECRET ??= randomBytes(32).toString("hex");
process.env.JWT_REFRESH_SECRET ??= randomBytes(32).toString("hex");
process.env.DATABASE_URL ??= "postgresql://localhost/unused";

const { ownedForgeImageKey, forgeImagePrefix } = await import("../src/lib/storage.js");
const { env } = await import("../src/config/env.js");


const FORGE = "11111111-2222-4333-8444-555555555555";
const OTHER = "66666666-7777-4888-8999-aaaaaaaaaaaa";
const base = (env.S3_PUBLIC_BASE_URL ? env.S3_PUBLIC_BASE_URL.replace(/\/$/, "") : null);

// Local uploads are served from the API origin under /uploads/<key>.
function localUrl(key: string) {
  const origin = new URL(env.API_PUBLIC_URL ?? `http://127.0.0.1:${env.PORT}`).origin;
  return `${origin}/uploads/${key.split("/").map(encodeURIComponent).join("/")}`;
}

test("a server's own upload is accepted for that server", () => {
  const key = `${forgeImagePrefix(FORGE)}icon-1700000000000-abc.png`;
  assert.equal(ownedForgeImageKey(localUrl(key), FORGE), key);
});

test("another server's upload is refused", () => {
  const key = `${forgeImagePrefix(OTHER)}banner-1700000000000-abc.png`;
  assert.equal(ownedForgeImageKey(localUrl(key), FORGE), null);
});

test("a profile picture is not a server picture", () => {
  const key = "profiles/someone/avatar-1700000000000-abc.png";
  assert.equal(ownedForgeImageKey(localUrl(key), FORGE), null);
});

test("outside links are refused", () => {
  assert.equal(ownedForgeImageKey("https://example.com/icon.png", FORGE), null);
  assert.equal(ownedForgeImageKey("javascript:alert(1)", FORGE), null);
  assert.equal(ownedForgeImageKey("not a url", FORGE), null);
});

test("path traversal inside the server's prefix is refused", () => {
  const key = `${forgeImagePrefix(FORGE)}../../profiles/someone/avatar.png`;
  assert.equal(ownedForgeImageKey(localUrl(key), FORGE), null);
});

test("an S3 public URL is only accepted when the base is configured", () => {
  const key = `${forgeImagePrefix(FORGE)}icon-1700000000000-abc.png`;
  if (base) assert.equal(ownedForgeImageKey(`${base}/${key}`, FORGE), key);
  else assert.equal(ownedForgeImageKey(`https://bucket.example.com/${key}`, FORGE), null);
});
