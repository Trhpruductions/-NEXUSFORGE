// Run with: npx tsx --test tests/*.test.ts (from apps/web). Pure logic only: no browser or audio needed.
import test from "node:test";
import assert from "node:assert/strict";
import { THEMES, THEME_IDS, DEFAULT_THEME, resolveTheme, isThemeId } from "../src/lib/appearance/themes";
import { seasonFor } from "../src/lib/appearance/seasons";
import { CUES, DEFAULT_SOUND_SETTINGS, normalizeSoundSettings, shouldPlay } from "../src/lib/sound/sound-engine";
import { NEON_SEQUENCE, createBurstCounter, createSequenceMatcher } from "../src/lib/appearance/easter-eggs";

const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);

test("there are eight themes, each defined once, with the default first", () => {
  assert.equal(THEMES.length, 8);
  assert.deepEqual(THEMES.map((t) => t.id), [...THEME_IDS]);
  assert.equal(THEMES[0].id, DEFAULT_THEME);
});

test("an unknown or broken theme falls back to the default", () => {
  assert.equal(resolveTheme("aurora").id, "aurora");
  assert.equal(resolveTheme("not-a-theme").id, DEFAULT_THEME);
  assert.equal(resolveTheme(undefined).id, DEFAULT_THEME);
  assert.equal(resolveTheme({ evil: "css" }).id, DEFAULT_THEME);
  assert.equal(isThemeId("frost"), true);
  assert.equal(isThemeId("FROST"), false);
});

test("seasonal events start and end on their local dates", () => {
  assert.equal(seasonFor(local(2026, 10, 23)), null, "the day before Halloween's window");
  assert.equal(seasonFor(local(2026, 10, 24))?.id, "halloween");
  assert.equal(seasonFor(local(2026, 10, 31, 23))?.id, "halloween", "late on the 31st");
  assert.equal(seasonFor(local(2026, 11, 1, 0)), null, "midnight ends it");
  assert.equal(seasonFor(local(2027, 10, 13))?.id, "nfg-anniversary");
  assert.equal(seasonFor(local(2026, 12, 15))?.id, "winter");
  assert.equal(seasonFor(local(2026, 12, 30))?.id, "winter");
});

test("New Year wraps across the year boundary and wins over winter", () => {
  assert.equal(seasonFor(local(2026, 12, 31))?.id, "new-year");
  assert.equal(seasonFor(local(2027, 1, 1))?.id, "new-year");
  assert.equal(seasonFor(local(2027, 1, 2))?.id, "new-year");
  assert.equal(seasonFor(local(2027, 1, 3)), null);
});

test("most of the year has no event, so the app stays clean", () => {
  let days = 0;
  let seasonal = 0;
  for (let d = new Date(2027, 0, 1); d.getFullYear() === 2027; d.setDate(d.getDate() + 1)) {
    days += 1;
    if (seasonFor(d)) seasonal += 1;
  }
  assert.ok(seasonal < days * 0.15, `${seasonal} of ${days} days are seasonal`);
});

test("a sound plays only when sounds, the volume and its category are on", () => {
  const on = { ...DEFAULT_SOUND_SETTINGS };
  assert.equal(shouldPlay("voiceConnected", on, 1000, undefined).play, true);
  assert.equal(shouldPlay("voiceConnected", { ...on, enabled: false }, 1000, undefined).play, false);
  assert.equal(shouldPlay("voiceConnected", { ...on, volume: 0 }, 1000, undefined).play, false);
  assert.equal(shouldPlay("voiceConnected", { ...on, voice: false }, 1000, undefined).play, false);
  assert.equal(shouldPlay("screenShareStarted", { ...on, voice: false }, 1000, undefined).play, true, "screen share has its own switch");
  assert.equal(shouldPlay("click", on, 1000, undefined).play, false, "UI sounds are off by default");
  assert.equal(shouldPlay("message", { ...on, messages: false }, 1000, undefined).play, false);
});

test("the same cue twice in quick succession plays once", () => {
  const on = { ...DEFAULT_SOUND_SETTINGS };
  const cooldown = CUES.participantJoined.cooldownMs;
  assert.equal(shouldPlay("participantJoined", on, 5000, 5000 - 10).play, false);
  assert.equal(shouldPlay("participantJoined", on, 5000, 5000 - cooldown).play, true);
});

test("sound settings from storage are cleaned up, never trusted", () => {
  assert.deepEqual(normalizeSoundSettings(null), DEFAULT_SOUND_SETTINGS);
  const cleaned = normalizeSoundSettings({ enabled: "yes", volume: 250, pack: "borrowed", ui: true });
  assert.equal(cleaned.enabled, true, "a non-boolean falls back to the default");
  assert.equal(cleaned.volume, 100, "volume is clamped");
  assert.equal(cleaned.pack, "forge");
  assert.equal(cleaned.ui, true);
  assert.equal(normalizeSoundSettings({ volume: Number.NaN }).volume, DEFAULT_SOUND_SETTINGS.volume);
});

test("the neon code matches exactly once, and a wrong key restarts it", () => {
  const matcher = createSequenceMatcher(NEON_SEQUENCE);
  const results = NEON_SEQUENCE.map((key) => matcher.feed(key));
  assert.deepEqual(results, [false, false, false, false, false, false, false, false, false, true]);
  assert.equal(matcher.feed("a"), false, "it does not fire again on its own");
  for (const key of NEON_SEQUENCE.slice(0, 5)) matcher.feed(key);
  matcher.feed("x");
  assert.equal(NEON_SEQUENCE.slice(0, -1).map((key) => matcher.feed(key)).some(Boolean), false);
  assert.equal(matcher.feed("A"), true, "letters are matched case-insensitively");
});

test("the forge spark needs quick repeated hits", () => {
  const counter = createBurstCounter({ count: 5, windowMs: 2500 });
  assert.equal([0, 300, 600, 900].map((t) => counter.hit(t)).some(Boolean), false);
  assert.equal(counter.hit(1200), true);
  const slow = createBurstCounter({ count: 5, windowMs: 2500 });
  assert.equal([0, 1000, 2000, 3000, 4000].map((t) => slow.hit(t)).some(Boolean), false, "slow clicks never trigger it");
});
