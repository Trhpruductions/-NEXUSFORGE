"use strict";

// Which web permissions the app grants. No Electron here, so the rules can be tested directly.
// Electron grants every permission by default (camera and microphone included, even to embedded third-party frames)
// unless the session has handlers; main.js installs both the request and the check handler with these rules.
//
// Granted only to the app's own windows (the main window and its popouts), only when the window shows a trusted page,
// and only to that page's top frame or a frame of the same origin:
const GRANTABLE = new Set(["media", "display-capture", "fullscreen", "notifications", "clipboard-sanitized-write", "pointerLock"]);

// One exception: full screen may also be used by a frame of another origin embedded in a trusted page, such as a
// video player the page embeds with allow="fullscreen" (clips and live streams). Chromium applies the page's allow
// attribute before the request gets here, so only players the page itself allowed can ask. Nothing else is delegated.
const DELEGABLE_TO_EMBEDS = new Set(["fullscreen"]);

/**
 * { allowed, reason } for a permission request or check.
 *   permission       - Electron's permission name
 *   appWindow        - the request comes from the main window or one of its popouts
 *   topOrigin        - origin of the window's top frame (a popout's about:blank page has its opener's origin)
 *   requestingOrigin - origin of the frame asking (null when unknown)
 *   isMainFrame      - the frame asking is the top frame
 *   policy           - createOriginPolicy(...) from origin-rules.js
 */
function decidePermission({ permission, appWindow, topOrigin, requestingOrigin, isMainFrame }, policy) {
  if (!appWindow) return { allowed: false, reason: "not-an-app-window" };
  if (!GRANTABLE.has(permission)) return { allowed: false, reason: "permission-not-granted-by-app" };
  if (!policy || !policy.isTrustedOrigin(topOrigin)) return { allowed: false, reason: "untrusted-page" };
  if (!isMainFrame && DELEGABLE_TO_EMBEDS.has(permission)) return { allowed: true, reason: "delegated-to-embed" };
  if (!policy.isTrustedOrigin(requestingOrigin)) return { allowed: false, reason: "untrusted-frame" };
  if (isMainFrame) return { allowed: true, reason: "top-frame" };
  if (requestingOrigin === topOrigin) return { allowed: true, reason: "same-origin-frame" };
  return { allowed: false, reason: "cross-origin-frame" };
}

module.exports = { GRANTABLE, DELEGABLE_TO_EMBEDS, decidePermission };
