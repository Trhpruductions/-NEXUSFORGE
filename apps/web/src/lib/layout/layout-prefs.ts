/**
 * Layout choices for this device: sidebar widths and whether they are collapsed, and how the voice room lays out.
 * Pure functions only (the store in store/layout-store.ts keeps them in localStorage), so they are unit-tested.
 */

export type VoiceLayoutChoice = "auto" | "grid" | "focus";

export type LayoutPrefs = {
  /** Channel list (left) and member list (right) widths in CSS pixels. */
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  /** auto: the big screen view when someone else shares, everyone's tiles otherwise. */
  voiceLayout: VoiceLayoutChoice;
  /** Switch to the big view by itself when someone starts sharing. */
  focusNewShares: boolean;
};

export const LAYOUT_LIMITS = {
  left: { min: 200, max: 420, default: 248 },
  right: { min: 200, max: 420, default: 240 },
  /** The server icon rail beside the channel list. */
  rail: 60,
  /** Below this, the middle (chat or voice) is too cramped: sidebars step aside, right first. */
  minCenter: 560,
} as const;

export const DEFAULT_LAYOUT_PREFS: LayoutPrefs = {
  leftWidth: LAYOUT_LIMITS.left.default,
  rightWidth: LAYOUT_LIMITS.right.default,
  leftCollapsed: false,
  rightCollapsed: false,
  voiceLayout: "auto",
  focusNewShares: true,
};

export const LAYOUT_STORAGE_KEY = "nf-layout";

export function clampWidth(side: "left" | "right", width: number): number {
  const { min, max, default: fallback } = LAYOUT_LIMITS[side];
  if (!Number.isFinite(width)) return fallback;
  return Math.round(Math.min(max, Math.max(min, width)));
}

/** Anything read back from storage, made safe: unknown keys dropped, widths clamped, bad values replaced by defaults. */
export function sanitizeLayoutPrefs(value: unknown): LayoutPrefs {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const bool = (key: keyof LayoutPrefs) => (typeof source[key] === "boolean" ? (source[key] as boolean) : (DEFAULT_LAYOUT_PREFS[key] as boolean));
  const voiceLayout = source.voiceLayout === "grid" || source.voiceLayout === "focus" || source.voiceLayout === "auto" ? source.voiceLayout : DEFAULT_LAYOUT_PREFS.voiceLayout;
  return {
    leftWidth: typeof source.leftWidth === "number" ? clampWidth("left", source.leftWidth) : DEFAULT_LAYOUT_PREFS.leftWidth,
    rightWidth: typeof source.rightWidth === "number" ? clampWidth("right", source.rightWidth) : DEFAULT_LAYOUT_PREFS.rightWidth,
    leftCollapsed: bool("leftCollapsed"),
    rightCollapsed: bool("rightCollapsed"),
    voiceLayout,
    focusNewShares: bool("focusNewShares"),
  };
}

export type EffectiveLayout = {
  /** Widths actually shown (0 = hidden). */
  left: number;
  right: number;
  /** Hidden only because the window is too narrow right now; the saved choice is unchanged. */
  leftAutoHidden: boolean;
  rightAutoHidden: boolean;
};

/**
 * What to show at this window width. Saved choices are never changed here: a sidebar that doesn't fit is hidden for
 * now (the member list first, then the channel list) and comes back when the window is wide enough again.
 */
export function effectiveLayout(prefs: LayoutPrefs, viewportWidth: number, options: { hasLeft: boolean; hasRight: boolean }): EffectiveLayout {
  let left = options.hasLeft && !prefs.leftCollapsed ? prefs.leftWidth : 0;
  let right = options.hasRight && !prefs.rightCollapsed ? prefs.rightWidth : 0;
  let leftAutoHidden = false;
  let rightAutoHidden = false;
  const center = () => viewportWidth - LAYOUT_LIMITS.rail - left - right;
  if (right && center() < LAYOUT_LIMITS.minCenter) {
    right = 0;
    rightAutoHidden = true;
  }
  if (left && center() < LAYOUT_LIMITS.minCenter) {
    left = 0;
    leftAutoHidden = true;
  }
  return { left, right, leftAutoHidden, rightAutoHidden };
}

/** The widest a sidebar can be dragged while the other one stays as it is and the middle keeps its minimum. */
export function maxDragWidth(side: "left" | "right", viewportWidth: number, otherWidth: number): number {
  const room = viewportWidth - LAYOUT_LIMITS.rail - otherWidth - LAYOUT_LIMITS.minCenter;
  return Math.max(LAYOUT_LIMITS[side].min, Math.min(LAYOUT_LIMITS[side].max, Math.floor(room)));
}
