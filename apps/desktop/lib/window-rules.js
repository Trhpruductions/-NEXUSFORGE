"use strict";

// Pure rules for the main window and popout windows, kept out of main.js so they can be tested without Electron.

const TITLE_BAR_HEIGHT = 32;
/** Room taken by the minimize, maximize and close buttons at the right of the title bar. */
const CAPTION_BUTTONS_WIDTH = 140;
/** How much of the title bar must be on a screen for the window to count as reachable (you can grab and move it). */
const GRAB_WIDTH = 120;
const GRAB_HEIGHT = 20;

function overlap(a, b) {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return { width: Math.max(0, width), height: Math.max(0, height) };
}

/**
 * A saved window position is only used when part of its title bar (where you drag it) is still on a connected
 * screen's usable area. A monitor that was unplugged, or a position under the taskbar, would otherwise open the app
 * where nobody can reach it.
 */
function titleBarReachable(bounds, workAreas) {
  const grab = { x: bounds.x, y: bounds.y, width: Math.max(0, bounds.width - CAPTION_BUTTONS_WIDTH), height: TITLE_BAR_HEIGHT };
  return workAreas.some((area) => {
    const seen = overlap(grab, area);
    return seen.width >= GRAB_WIDTH && seen.height >= GRAB_HEIGHT;
  });
}

/**
 * The size and place to open the window at. saved: what window-state.json held (or null); workAreas: every screen's
 * usable area; primary: the main screen's usable area. Too-big sizes shrink to the screen, unreachable positions are
 * dropped (Electron then centres the window), and a saved full-screen-sized window opens maximized instead.
 */
function restoreBounds(saved, workAreas, primary, limits) {
  const { minWidth, minHeight, defaultWidth, defaultHeight } = limits;
  const fallback = { width: Math.min(defaultWidth, primary.width), height: Math.min(defaultHeight, primary.height), x: undefined, y: undefined, isMaximized: true };
  if (!saved || !Number.isFinite(saved.width) || !Number.isFinite(saved.height)) return fallback;
  const hasPosition = Number.isFinite(saved.x) && Number.isFinite(saved.y);
  const bounds = {
    width: Math.round(Math.max(minWidth, saved.width)),
    height: Math.round(Math.max(minHeight, saved.height)),
    x: hasPosition ? Math.round(saved.x) : undefined,
    y: hasPosition ? Math.round(saved.y) : undefined,
    isMaximized: Boolean(saved.isMaximized),
  };
  // The screen the window was on, or the main one when it is gone.
  const onArea = (area) => {
    const seen = overlap(bounds, area);
    return seen.width > 0 && seen.height > 0;
  };
  const home = (hasPosition && workAreas.find(onArea)) || primary;
  // 1.0.14 and older opened full screen and saved that size: not a real window size, so open maximized.
  if (bounds.width >= home.width && bounds.height >= home.height) return { ...fallback, isMaximized: true };
  bounds.width = Math.min(bounds.width, home.width);
  bounds.height = Math.min(bounds.height, home.height);
  if (hasPosition && !titleBarReachable(bounds, workAreas)) {
    bounds.x = undefined;
    bounds.y = undefined;
  }
  return bounds;
}

/** Popout windows the page may open: blank windows with one of these names. Anything else opens in the browser. */
const POPOUT_NAME = /^nf-popout-(voice|share|members)$/;

function isPopoutRequest(url, frameName) {
  return url === "about:blank" && typeof frameName === "string" && POPOUT_NAME.test(frameName);
}

/** The popout's size from the page's request, kept within sensible limits. */
function popoutSize(features) {
  const read = (key) => {
    const match = new RegExp(`(?:^|,)\\s*${key}\\s*=\\s*(\\d+)`).exec(String(features || ""));
    return match ? Number(match[1]) : null;
  };
  const clamp = (value, min, max, fallback) => (value === null ? fallback : Math.min(max, Math.max(min, value)));
  return { width: clamp(read("width"), 320, 3840, 960), height: clamp(read("height"), 240, 2160, 640) };
}

module.exports = { TITLE_BAR_HEIGHT, titleBarReachable, restoreBounds, isPopoutRequest, popoutSize };
