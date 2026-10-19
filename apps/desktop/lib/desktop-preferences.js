"use strict";

// The desktop preferences (desktop-preferences.json). No Electron here, so the rules can be tested directly.
//
// Launch at login is OFF unless the user turns it on (tray menu "Start with Windows", or the page's preferences call).
// Versions up to 1.0.16 defaulted it to ON and registered it on first run without asking. The stored file cannot
// tell a value the user chose from a default that was written along with another setting, so stored values are kept
// exactly as they are; only the default for people with no stored value changes. From now on a user's own choice is
// also recorded (launchOnStartupChosen), so a later version can tell the two apart.

const BOOLEAN_KEYS = Object.freeze(["launchOnStartup", "minimizeToTray", "startMinimized"]);

function defaultDesktopPreferences() {
  return { launchOnStartup: false, minimizeToTray: true, startMinimized: true, launchOnStartupChosen: false };
}

/** The preferences to use: the stored booleans where present and valid, defaults for everything else. */
function mergeStoredPreferences(stored) {
  const result = defaultDesktopPreferences();
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return result;
  for (const key of BOOLEAN_KEYS) {
    if (typeof stored[key] === "boolean") result[key] = stored[key];
  }
  result.launchOnStartupChosen = stored.launchOnStartupChosen === true;
  return result;
}

/** Applies a change request; only known boolean keys are taken. Changing launchOnStartup records it as chosen. */
function applyPreferencePatch(current, patch) {
  const next = { ...current };
  if (!patch || typeof patch !== "object") return next;
  for (const key of BOOLEAN_KEYS) {
    if (typeof patch[key] === "boolean") next[key] = patch[key];
  }
  if (typeof patch.launchOnStartup === "boolean") next.launchOnStartupChosen = true;
  return next;
}

/** What the page sees (the bookkeeping flag stays inside the app). */
function publicPreferences(preferences) {
  return { launchOnStartup: Boolean(preferences.launchOnStartup), minimizeToTray: Boolean(preferences.minimizeToTray), startMinimized: Boolean(preferences.startMinimized) };
}

module.exports = { BOOLEAN_KEYS, defaultDesktopPreferences, mergeStoredPreferences, applyPreferencePatch, publicPreferences };
