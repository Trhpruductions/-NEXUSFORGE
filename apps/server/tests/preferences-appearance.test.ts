import test from "node:test";
import assert from "node:assert/strict";
import { THEME_IDS, parsePreferences, preferencesSchema } from "../src/routes/settings.routes.js";

// Pure schema checks: no database rows are written.

test("preferences saved before Appearance & Sounds existed still load, with the new defaults filled in", () => {
  const old = { appearance: { accent: "ember", density: "compact", fontScale: "large", reduceMotion: true, showAvatarsInChat: false } };
  const prefs = parsePreferences(old);
  assert.equal(prefs.appearance.accent, "ember", "existing choices are kept");
  assert.equal(prefs.appearance.reduceMotion, true);
  assert.equal(prefs.appearance.theme, "forge-dark");
  assert.equal(prefs.appearance.animation, "full");
  assert.equal(prefs.appearance.decorativeEffects, true);
  assert.equal(prefs.appearance.seasonal, true);
  assert.equal(prefs.appearance.loadingStyle, "forge");
  assert.equal(prefs.appearance.easterEggs, true);
  assert.deepEqual(prefs.sounds, { enabled: true, volume: 70, pack: "forge", voice: true, screenShare: true, ui: false, seasonal: true, easterEggs: true });
});

test("every theme id is accepted", () => {
  for (const theme of THEME_IDS) {
    assert.equal(preferencesSchema.safeParse({ appearance: { theme } }).success, true, theme);
  }
});

test("unknown themes, loading styles, packs and out-of-range volumes are refused", () => {
  assert.equal(preferencesSchema.safeParse({ appearance: { theme: "rainbow" } }).success, false);
  assert.equal(preferencesSchema.safeParse({ appearance: { loadingStyle: "fireworks" } }).success, false);
  assert.equal(preferencesSchema.safeParse({ appearance: { animation: "max" } }).success, false);
  assert.equal(preferencesSchema.safeParse({ sounds: { pack: "borrowed" } }).success, false);
  assert.equal(preferencesSchema.safeParse({ sounds: { volume: 101 } }).success, false);
  assert.equal(preferencesSchema.safeParse({ sounds: { volume: -1 } }).success, false);
  assert.equal(preferencesSchema.safeParse({ sounds: { volume: 50.5 } }).success, false);
});

test("a broken stored value falls back to the defaults instead of failing the request", () => {
  const prefs = parsePreferences({ appearance: { theme: "not-a-theme" } });
  assert.equal(prefs.appearance.theme, "forge-dark");
});
