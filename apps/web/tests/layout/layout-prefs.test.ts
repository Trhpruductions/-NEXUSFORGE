import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LAYOUT_PREFS, LAYOUT_LIMITS, clampWidth, effectiveLayout, maxDragWidth, sanitizeLayoutPrefs } from "../../src/lib/layout/layout-prefs";

test("sidebar widths stay within their limits", () => {
  assert.equal(clampWidth("left", 100), LAYOUT_LIMITS.left.min);
  assert.equal(clampWidth("left", 9999), LAYOUT_LIMITS.left.max);
  assert.equal(clampWidth("right", 300.6), 301);
  assert.equal(clampWidth("right", Number.NaN), LAYOUT_LIMITS.right.default);
});

test("saved layout is cleaned up: bad or unknown values fall back to the defaults", () => {
  assert.deepEqual(sanitizeLayoutPrefs(null), DEFAULT_LAYOUT_PREFS);
  assert.deepEqual(sanitizeLayoutPrefs("junk"), DEFAULT_LAYOUT_PREFS);
  const cleaned = sanitizeLayoutPrefs({ leftWidth: 5000, rightWidth: "wide", leftCollapsed: "yes", rightCollapsed: true, voiceLayout: "cinema", focusNewShares: false, extra: 1 });
  assert.deepEqual(cleaned, { leftWidth: LAYOUT_LIMITS.left.max, rightWidth: LAYOUT_LIMITS.right.default, leftCollapsed: false, rightCollapsed: true, voiceLayout: "auto", focusNewShares: false });
  assert.equal(sanitizeLayoutPrefs({ voiceLayout: "grid" }).voiceLayout, "grid");
});

test("on a wide window both sidebars show at their saved widths", () => {
  const prefs = { ...DEFAULT_LAYOUT_PREFS, leftWidth: 300, rightWidth: 280 };
  assert.deepEqual(effectiveLayout(prefs, 1920, { hasLeft: true, hasRight: true }), { left: 300, right: 280, leftAutoHidden: false, rightAutoHidden: false });
});

test("collapsed sidebars stay hidden and are not counted as auto-hidden", () => {
  const prefs = { ...DEFAULT_LAYOUT_PREFS, leftCollapsed: true, rightCollapsed: true };
  assert.deepEqual(effectiveLayout(prefs, 1920, { hasLeft: true, hasRight: true }), { left: 0, right: 0, leftAutoHidden: false, rightAutoHidden: false });
});

test("a narrow window hides the member list first, then the channel list, without changing the saved choice", () => {
  const prefs = { ...DEFAULT_LAYOUT_PREFS, leftWidth: 248, rightWidth: 240 };
  // 60 rail + 248 + 240 + 560 middle = 1108: just fits.
  assert.deepEqual(effectiveLayout(prefs, 1108, { hasLeft: true, hasRight: true }), { left: 248, right: 240, leftAutoHidden: false, rightAutoHidden: false });
  // A bit narrower: the member list steps aside.
  assert.deepEqual(effectiveLayout(prefs, 1000, { hasLeft: true, hasRight: true }), { left: 248, right: 0, leftAutoHidden: false, rightAutoHidden: true });
  // Narrower still: the channel list too.
  assert.deepEqual(effectiveLayout(prefs, 800, { hasLeft: true, hasRight: true }), { left: 0, right: 0, leftAutoHidden: true, rightAutoHidden: true });
  assert.equal(prefs.rightCollapsed, false);
  // No member list on this page (direct messages): the channel list keeps its room.
  assert.deepEqual(effectiveLayout(prefs, 1000, { hasLeft: true, hasRight: false }), { left: 248, right: 0, leftAutoHidden: false, rightAutoHidden: false });
});

test("dragging a sidebar can't squeeze the middle below its minimum", () => {
  assert.equal(maxDragWidth("left", 1920, 240), LAYOUT_LIMITS.left.max);
  // 1200 - 60 - 240 - 560 = 340
  assert.equal(maxDragWidth("left", 1200, 240), 340);
  // Never below the sidebar's own minimum.
  assert.equal(maxDragWidth("right", 900, 248), LAYOUT_LIMITS.right.min);
});
