"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const prefs = require("../lib/desktop-preferences");

test("launch at login is off for new installs", () => {
  assert.equal(prefs.defaultDesktopPreferences().launchOnStartup, false);
  assert.equal(prefs.mergeStoredPreferences(null).launchOnStartup, false, "no stored file");
  assert.equal(prefs.mergeStoredPreferences({ minimizeToTray: false }).launchOnStartup, false, "a file without the setting");
});

test("stored values are kept exactly as stored (a user who turned it on keeps it on)", () => {
  const stored = { launchOnStartup: true, minimizeToTray: false, startMinimized: false };
  assert.deepEqual(prefs.mergeStoredPreferences(stored), { ...stored, launchOnStartupChosen: false });
  assert.equal(prefs.mergeStoredPreferences({ launchOnStartup: false }).launchOnStartup, false);
});

test("junk in the stored file falls back to the defaults", () => {
  assert.deepEqual(prefs.mergeStoredPreferences({ launchOnStartup: "yes", minimizeToTray: 1 }), prefs.defaultDesktopPreferences());
  assert.deepEqual(prefs.mergeStoredPreferences([true]), prefs.defaultDesktopPreferences());
  assert.deepEqual(prefs.mergeStoredPreferences("x"), prefs.defaultDesktopPreferences());
});

test("turning it on records that the user chose it; other changes do not", () => {
  const base = prefs.defaultDesktopPreferences();
  const tray = prefs.applyPreferencePatch(base, { minimizeToTray: false });
  assert.equal(tray.launchOnStartupChosen, false);
  assert.equal(tray.launchOnStartup, false);
  const on = prefs.applyPreferencePatch(base, { launchOnStartup: true });
  assert.equal(on.launchOnStartup, true);
  assert.equal(on.launchOnStartupChosen, true);
  assert.equal(prefs.mergeStoredPreferences(on).launchOnStartupChosen, true, "the record survives a restart");
});

test("only known boolean settings can be changed", () => {
  const base = prefs.defaultDesktopPreferences();
  assert.deepEqual(prefs.applyPreferencePatch(base, { launchOnStartup: "true", evil: true, __proto__: { x: 1 } }), base);
  assert.deepEqual(prefs.applyPreferencePatch(base, null), base);
});

test("the page sees the three settings only", () => {
  assert.deepEqual(Object.keys(prefs.publicPreferences(prefs.defaultDesktopPreferences())).sort(), ["launchOnStartup", "minimizeToTray", "startMinimized"]);
});
