"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { titleBarReachable, restoreBounds, isPopoutRequest, popoutSize } = require("../lib/window-rules");

const limits = { minWidth: 960, minHeight: 600, defaultWidth: 1480, defaultHeight: 920 };
// Two monitors side by side; the taskbar takes the bottom 40px of each.
const left = { x: 0, y: 0, width: 1920, height: 1040 };
const right = { x: 1920, y: 0, width: 2560, height: 1400 };

test("a window whose title bar is on a screen is reachable", () => {
  assert.equal(titleBarReachable({ x: 100, y: 100, width: 1200, height: 800 }, [left]), true);
  // Mostly off the right edge, but enough of the bar is still on screen to grab it.
  assert.equal(titleBarReachable({ x: 1700, y: 100, width: 1200, height: 800 }, [left]), true);
});

test("a window with its title bar off every screen is not reachable", () => {
  // On a monitor that is no longer connected.
  assert.equal(titleBarReachable({ x: 2200, y: 100, width: 1200, height: 800 }, [left]), false);
  // Title bar above the top of the screen.
  assert.equal(titleBarReachable({ x: 100, y: -200, width: 1200, height: 800 }, [left]), false);
  // Only the caption buttons are on screen: you can't drag by them.
  assert.equal(titleBarReachable({ x: -1090, y: 100, width: 1200, height: 800 }, [left]), false);
});

test("restoring: a saved position on a connected screen is kept", () => {
  const bounds = restoreBounds({ x: 2000, y: 50, width: 1400, height: 900, isMaximized: false }, [left, right], left, limits);
  assert.deepEqual(bounds, { x: 2000, y: 50, width: 1400, height: 900, isMaximized: false });
});

test("restoring: a position on an unplugged monitor is dropped so the window opens centred", () => {
  const bounds = restoreBounds({ x: 2000, y: 50, width: 1400, height: 900, isMaximized: false }, [left], left, limits);
  assert.equal(bounds.x, undefined);
  assert.equal(bounds.y, undefined);
  assert.equal(bounds.width, 1400);
});

test("restoring: a window bigger than its screen shrinks to fit, and a full-screen-sized one opens maximized", () => {
  const big = restoreBounds({ x: 0, y: 0, width: 1900, height: 1200, isMaximized: false }, [left], left, limits);
  assert.equal(big.height, 1040);
  assert.equal(big.width, 1900);
  const full = restoreBounds({ x: 0, y: 0, width: 1920, height: 1080, isMaximized: false }, [left], left, limits);
  assert.equal(full.isMaximized, true);
  assert.equal(full.x, undefined);
});

test("restoring: nothing saved, or junk, opens maximized at the default size", () => {
  assert.deepEqual(restoreBounds(null, [left], left, limits), { width: 1480, height: 920, x: undefined, y: undefined, isMaximized: true });
  assert.equal(restoreBounds({ width: "wide" }, [left], left, limits).isMaximized, true);
  // Below the minimum size: raised to it.
  const small = restoreBounds({ x: 10, y: 10, width: 300, height: 200 }, [left], left, limits);
  assert.equal(small.width, 960);
  assert.equal(small.height, 600);
});

test("only blank windows with a popout name are allowed to open inside the app", () => {
  assert.equal(isPopoutRequest("about:blank", "nf-popout-voice"), true);
  assert.equal(isPopoutRequest("about:blank", "nf-popout-share"), true);
  assert.equal(isPopoutRequest("about:blank", "nf-popout-members"), true);
  assert.equal(isPopoutRequest("about:blank", "nf-popout-anything"), false);
  assert.equal(isPopoutRequest("https://example.com", "nf-popout-voice"), false);
  assert.equal(isPopoutRequest("about:blank", ""), false);
  assert.equal(isPopoutRequest("about:blank", undefined), false);
});

test("popout sizes come from the request, within limits", () => {
  assert.deepEqual(popoutSize("popup=yes,width=1120,height=740,left=10,top=10"), { width: 1120, height: 740 });
  assert.deepEqual(popoutSize("width=50,height=99999"), { width: 320, height: 2160 });
  assert.deepEqual(popoutSize(""), { width: 960, height: 640 });
});
