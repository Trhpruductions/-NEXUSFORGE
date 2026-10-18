/**
 * Appearance preferences: fill in defaults, apply them to <html>, and remember them on this device.
 * Each account's preferences live on the server (Settings → Appearance & Sounds). A copy is kept on this device per
 * account so the right theme shows at once on the next visit, and a small device-level copy (theme, loading style and
 * motion choices only, nothing personal) lets the sign-in and loading screens match before anyone has signed in.
 */

import type { AppearancePreferences, Preferences } from "@/lib/api";
import { normalizeSoundSettings, type SoundSettings } from "@/lib/sound/sound-engine";
import { isThemeId, type ThemeId } from "./themes";
import { seasonFor, type Season } from "./seasons";

export type LoadingStyle = "forge" | "pulse" | "minimal";
export type AnimationLevel = "full" | "subtle" | "off";

export type ResolvedAppearance = {
  accent: AppearancePreferences["accent"];
  density: AppearancePreferences["density"];
  fontScale: AppearancePreferences["fontScale"];
  reduceMotion: boolean;
  showAvatarsInChat: boolean;
  theme: ThemeId;
  animation: AnimationLevel;
  decorativeEffects: boolean;
  noFlashing: boolean;
  seasonal: boolean;
  loadingStyle: LoadingStyle;
  easterEggs: boolean;
};

export const DEFAULT_APPEARANCE: ResolvedAppearance = {
  accent: "gold",
  density: "cozy",
  fontScale: "default",
  reduceMotion: false,
  showAvatarsInChat: true,
  theme: "forge-dark",
  animation: "full",
  decorativeEffects: true,
  noFlashing: false,
  seasonal: true,
  loadingStyle: "forge",
  easterEggs: true,
};

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const flag = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

/** Every field filled and checked. Unknown values (an old server, a bad cache) fall back to the defaults. */
export function resolveAppearance(input?: Partial<AppearancePreferences> | null): ResolvedAppearance {
  const a = (input ?? {}) as Record<string, unknown>;
  const d = DEFAULT_APPEARANCE;
  return {
    accent: pick(a.accent, ["gold", "ember", "ice", "violet"] as const, d.accent),
    density: pick(a.density, ["cozy", "compact"] as const, d.density),
    fontScale: pick(a.fontScale, ["small", "default", "large"] as const, d.fontScale),
    reduceMotion: flag(a.reduceMotion, d.reduceMotion),
    showAvatarsInChat: flag(a.showAvatarsInChat, d.showAvatarsInChat),
    theme: isThemeId(a.theme) ? a.theme : d.theme,
    animation: pick(a.animation, ["full", "subtle", "off"] as const, d.animation),
    decorativeEffects: flag(a.decorativeEffects, d.decorativeEffects),
    noFlashing: flag(a.noFlashing, d.noFlashing),
    seasonal: flag(a.seasonal, d.seasonal),
    loadingStyle: pick(a.loadingStyle, ["forge", "pulse", "minimal"] as const, d.loadingStyle),
    easterEggs: flag(a.easterEggs, d.easterEggs),
  };
}

/** Sound settings from the saved preferences. Message sounds follow Notifications → Notification sounds. */
export function soundSettingsFrom(prefs?: Pick<Preferences, "sounds" | "notifications"> | null): SoundSettings {
  return normalizeSoundSettings({ ...(prefs?.sounds ?? {}), messages: prefs?.notifications?.sounds ?? true });
}

/** Animation actually used: reduce motion (here or in the system) always wins. */
export function effectiveAnimation(appearance: ResolvedAppearance): AnimationLevel {
  if (appearance.reduceMotion) return "off";
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return "off";
  return appearance.animation;
}

/** Applies the appearance to <html> and returns the seasonal event shown (if any). */
export function applyAppearance(root: HTMLElement, appearance: ResolvedAppearance, now: Date = new Date()): Season | null {
  root.dataset.theme = appearance.theme;
  root.dataset.accent = appearance.accent;
  root.dataset.density = appearance.density;
  root.dataset.font = appearance.fontScale;
  root.dataset.motion = appearance.reduceMotion ? "reduce" : "";
  root.dataset.chatAvatars = appearance.showAvatarsInChat ? "on" : "off";
  root.dataset.animation = effectiveAnimation(appearance);
  root.dataset.effects = appearance.decorativeEffects ? "on" : "off";
  root.dataset.noFlashing = appearance.noFlashing ? "on" : "off";
  const season = appearance.seasonal ? seasonFor(now) : null;
  if (season) root.dataset.season = season.id;
  else delete root.dataset.season;
  return season;
}

const accountKey = (userId: string) => `nf-appearance:${userId}`;
const DEVICE_KEY = "nf-appearance:device";

export function cacheAppearance(userId: string | null, appearance: ResolvedAppearance) {
  if (typeof window === "undefined") return;
  try {
    if (userId) window.localStorage.setItem(accountKey(userId), JSON.stringify(appearance));
    const { theme, loadingStyle, animation, reduceMotion, seasonal, decorativeEffects, noFlashing } = appearance;
    window.localStorage.setItem(DEVICE_KEY, JSON.stringify({ theme, loadingStyle, animation, reduceMotion, seasonal, decorativeEffects, noFlashing }));
  } catch {
    // Storage blocked: preferences still apply, they just load a moment later next time.
  }
}

/** This account's last appearance on this device, or null. */
export function cachedAppearance(userId: string | null): ResolvedAppearance | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(accountKey(userId));
    return raw ? resolveAppearance(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** For screens shown before sign-in: the device's last theme and motion choices (never anything personal). */
export function deviceAppearance(): ResolvedAppearance {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = window.localStorage.getItem(DEVICE_KEY);
    return raw ? resolveAppearance(JSON.parse(raw)) : DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}
