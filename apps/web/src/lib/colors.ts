/**
 * The app's color palette. Gold stays the brand color; these hues give each part of the
 * app (and each server, member and channel type) its own identity on the dark theme.
 * Every hue is bright enough to read as text on the near-black background.
 */

export type Hue = { name: string; base: string; light: string; deep: string };

export const hues = {
  amber: { name: "amber", base: "#f5b83d", light: "#fcd77f", deep: "#b7791f" },
  orange: { name: "orange", base: "#fb8a3c", light: "#fdba74", deep: "#c2410c" },
  rose: { name: "rose", base: "#fb6f84", light: "#fda4af", deep: "#be123c" },
  pink: { name: "pink", base: "#f472b6", light: "#f9a8d4", deep: "#be185d" },
  fuchsia: { name: "fuchsia", base: "#e879f9", light: "#f0abfc", deep: "#a21caf" },
  violet: { name: "violet", base: "#a78bfa", light: "#c4b5fd", deep: "#6d28d9" },
  indigo: { name: "indigo", base: "#818cf8", light: "#a5b4fc", deep: "#4338ca" },
  sky: { name: "sky", base: "#38bdf8", light: "#7dd3fc", deep: "#0369a1" },
  cyan: { name: "cyan", base: "#22d3ee", light: "#67e8f9", deep: "#0e7490" },
  teal: { name: "teal", base: "#2dd4bf", light: "#5eead4", deep: "#0f766e" },
  emerald: { name: "emerald", base: "#34d399", light: "#6ee7b7", deep: "#047857" },
  lime: { name: "lime", base: "#a3e635", light: "#bef264", deep: "#4d7c0f" },
} satisfies Record<string, Hue>;

export type HueName = keyof typeof hues;

/** Order used when a hue is picked from a name, so neighbours in a list rarely clash. */
const rotation: HueName[] = ["violet", "sky", "pink", "emerald", "orange", "cyan", "fuchsia", "lime", "rose", "indigo", "teal", "amber"];

function hash(text: string) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** A stable hue for any id or name (servers, members without a role color...). */
export function hueFor(key: string | null | undefined): Hue {
  return hues[rotation[hash(key ?? "") % rotation.length]];
}

/** "#rrggbb" + alpha (0-1) as an rgba() string. */
export function alpha(hex: string, amount: number) {
  const clean = hex.replace("#", "");
  const value = parseInt(clean.length === 3 ? clean.replace(/./g, "$&$&") : clean, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${amount})`;
}

/** Background for an avatar/server tile with no image. */
export function tileGradient(hue: Hue) {
  return `linear-gradient(135deg, ${hue.light} 0%, ${hue.base} 45%, ${hue.deep} 100%)`;
}

/** Each main area of the app has its own color. */
export const sectionHue: Record<string, HueName> = {
  "/app": "amber",
  "/app/feed": "sky",
  "/app/avatar": "fuchsia",
  "/app/server": "violet",
  "/app/events": "emerald",
  "/app/store": "orange",
  "/app/settings": "cyan",
  "/app/support": "teal",
  "/app/profile": "pink",
  "/app/wardrobe": "fuchsia",
  "/app/discover": "indigo",
  "/app/chat": "sky",
  "/app/friends": "emerald",
  "/app/live": "rose",
  "/app/rewards": "amber",
};

/** Channel types: text sky, announcements orange, voice emerald, stage pink. */
export const channelHue: Record<string, HueName> = {
  TEXT: "sky",
  ANNOUNCEMENT: "orange",
  VOICE: "emerald",
  STAGE: "pink",
  CATEGORY: "violet",
};
