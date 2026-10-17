/**
 * Application themes. Each theme is a set of CSS variable overrides (see app/themes.css) applied with
 * <html data-theme="...">. The whole app is drawn from these variables (Tailwind's slate and amber ramps, the surface
 * and border tokens, and the mood glows), so one attribute recolours every screen, including the voice and screen-share
 * views. The list here must match THEME_IDS in apps/server/src/routes/settings.routes.ts.
 */

export const THEME_IDS = ["forge-dark", "midnight-neon", "cyber-grid", "ember-forge", "frost", "aurora", "minimal-dark", "high-contrast"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = "forge-dark";

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  description: string;
  /** Swatches for the theme picker: background, surface, accent, second accent. */
  swatch: [string, string, string, string];
};

export const THEMES: ThemeDefinition[] = [
  { id: "forge-dark", name: "NFG Forge Dark", description: "The default: charcoal and navy with electric-blue accents.", swatch: ["#070a10", "#0b1424", "#2ea4ff", "#00f2ff"] },
  { id: "midnight-neon", name: "Midnight Neon", description: "Deep black with electric blue and violet.", swatch: ["#030308", "#0b0b1a", "#4f7cff", "#a855f7"] },
  { id: "cyber-grid", name: "Cyber Grid", description: "A faint futuristic grid with cool cyan highlights.", swatch: ["#040a10", "#08151f", "#22d3ee", "#38bdf8"] },
  { id: "ember-forge", name: "Ember Forge", description: "Dark warm surfaces with orange ember accents.", swatch: ["#0d0907", "#1a120d", "#ff7a2f", "#f59e0b"] },
  { id: "frost", name: "Frost", description: "Cool blue-grey surfaces with icy accents.", swatch: ["#0b111b", "#152131", "#7dd3fc", "#c7d2fe"] },
  { id: "aurora", name: "Aurora", description: "Dark skies with teal and violet.", swatch: ["#050b10", "#0c1820", "#2dd4bf", "#a78bfa"] },
  { id: "minimal-dark", name: "Minimal Dark", description: "Quiet greys, no glow, maximum readability.", swatch: ["#0e0f11", "#17181b", "#9aa7b8", "#d4d8de"] },
  { id: "high-contrast", name: "High Contrast", description: "Black and white with bright, clearly marked controls.", swatch: ["#000000", "#0a0a0a", "#ffd60a", "#ffffff"] },
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

/** The theme to apply: the saved one when it is known, otherwise the default. Never throws. */
export function resolveTheme(value: unknown): ThemeDefinition {
  const id = isThemeId(value) ? value : DEFAULT_THEME;
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}
