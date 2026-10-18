import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgresql://unused:unused@localhost:5432/unused";
process.env.JWT_ACCESS_SECRET ??= "a".repeat(48);
process.env.JWT_REFRESH_SECRET ??= "b".repeat(48);
const { profileUpdateSchema, parseSocialLink } = await import("../src/routes/profiles.routes.js");

function parsePatch(body: unknown) {
  return profileUpdateSchema.safeParse(body);
}

test("the editor accepts the fields it owns and trims names", () => {
  const result = parsePatch({ displayName: "  Atlas  ", bio: "Gaming.\r\nStreaming.", username: " atlas_ops ", privacy: { showActivity: false } });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.displayName, "Atlas");
  assert.equal(result.data.bio, "Gaming.\nStreaming.");
  assert.equal(result.data.username, "atlas_ops");
});

test("unknown or foreign fields are rejected, so a request cannot touch another account or privileged fields", () => {
  for (const body of [
    { userId: "00000000-0000-4000-8000-000000000001", bio: "hi" },
    { id: "00000000-0000-4000-8000-000000000001" },
    { role: "ADMIN" },
    { appRole: "OWNER" },
    { email: "someone@example.com" },
    { avatar: "https://evil.example/a.png" },
    { privacy: { contentFilter: "off" } },
  ]) {
    assert.equal(parsePatch(body).success, false, JSON.stringify(body));
  }
});

test("an empty patch is refused", () => {
  assert.equal(parsePatch({}).success, false);
});

test("bio is limited to 512 characters (counted as characters, not UTF-16 units) and rejects control characters", () => {
  assert.equal(parsePatch({ bio: "x".repeat(512) }).success, true);
  assert.equal(parsePatch({ bio: "x".repeat(513) }).success, false);
  assert.equal(parsePatch({ bio: "é".repeat(512) }).success, true);
  assert.equal(parsePatch({ bio: "bad\u0007bell" }).success, false);
});

test("display name is limited to 40 characters and rejects control characters", () => {
  assert.equal(parsePatch({ displayName: "x".repeat(40) }).success, true);
  assert.equal(parsePatch({ displayName: "x".repeat(41) }).success, false);
  assert.equal(parsePatch({ displayName: "a\u0000b" }).success, false);
  assert.equal(parsePatch({ displayName: null }).success, true);
});

test("social links must be https links on the platform's own domain", () => {
  const ok = [
    { x: "https://x.com/atlas" },
    { x: "https://twitter.com/atlas" },
    { discord: "https://discord.gg/abc123" },
    { youtube: "https://youtu.be/xyz" },
    { twitch: "https://www.twitch.tv/atlas" },
    { kick: "https://kick.com/atlas" },
    { instagram: "https://instagram.com/atlas" },
    { x: "" },
  ];
  for (const socialLinks of ok) assert.equal(parsePatch({ socialLinks }).success, true, JSON.stringify(socialLinks));

  const bad = [
    { x: "javascript:alert(1)" },
    { x: "http://x.com/atlas" },
    { x: "ftp://x.com/atlas" },
    { x: "https://evil.com/atlas" },
    { x: "https://x.com.evil.com/atlas" },
    { x: "https://notx.com/atlas" },
    { x: "https://user:pass@x.com/atlas" },
    { x: "https://x.com:8443/atlas" },
    { x: "https://x.com/a b" },
    { x: "x.com/atlas" },
    { github: "https://github.com/atlas" },
  ];
  for (const socialLinks of bad) assert.equal(parsePatch({ socialLinks }).success, false, JSON.stringify(socialLinks));
});

test("parseSocialLink returns the normalised address for good links and a plain message for bad ones", () => {
  const good = parseSocialLink("x", "https://X.com/Atlas");
  assert.equal(good.ok, true);
  if (good.ok) assert.equal(good.href, "https://x.com/Atlas");

  const bad = parseSocialLink("twitch", "https://youtube.com/atlas");
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.error, "Twitch links must be on twitch.tv.");
});

test("username input is capped at a length the availability check can answer", () => {
  assert.equal(parsePatch({ username: "x".repeat(65) }).success, false);
});
