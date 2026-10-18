"use strict";

// Who may call each main-process IPC channel. No Electron here, so the rules can be tested directly.
//
// Every ipcMain.handle / ipcMain.on in main.js goes through createIpcGuard (main.js registers them with handleIpc /
// onIpc, never directly). A request is accepted only from the top frame of one of the app's own windows, showing a
// page of a kind the channel allows (see classifySender in origin-rules.js):
//   app      - a trusted hosted page (nfgcord.com; in a dev build also local dev servers) in the main window
//   fallback - the bundled local-recovery page (fallback.html) in the main window
//   splash   - the bundled splash page (splash.html) in the splash window
// devOnly channels (they run npm in a folder, or open local files) are refused in the packaged app whoever asks.

const CHANNELS = Object.freeze({
  "nexusforge-desktop:get-startup-health": { pages: ["app", "fallback"] },
  "nexusforge-desktop:get-local-stack-status": { pages: ["app", "fallback"] },
  "nexusforge-desktop:get-update-state": { pages: ["app", "splash"] },
  "nexusforge-desktop:get-pricing-catalog": { pages: ["app"] },
  "nexusforge-desktop:get-desktop-preferences": { pages: ["app"] },
  "nexusforge-desktop:update-desktop-preferences": { pages: ["app"] },
  "nexusforge-desktop:is-fullscreen": { pages: ["app"] },
  "nexusforge-desktop:reset-window-layout": { pages: ["app"] },
  "nexusforge-desktop:check-updates-now": { pages: ["app"] },
  "nexusforge-desktop:download-update-now": { pages: ["app", "splash"] },
  "nexusforge-desktop:resolve-update-prompt": { pages: ["app", "splash"] },
  "nexusforge-desktop:restart-for-update": { pages: ["app", "splash"] },
  "nexusforge-desktop:retry-app-load": { pages: ["app", "splash", "fallback"] },
  "nexusforge-desktop:reload-window": { pages: ["app", "fallback"] },
  "nexusforge-desktop:run-maintenance": { pages: ["app"] },
  "nexusforge-desktop:restart-clean-session": { pages: ["app"] },
  "nexusforge-desktop:splash-control": { pages: ["splash"] },
  // Dev only: these run `npm run dev` in a workspace folder, choose that folder, or open a local log file.
  "nexusforge-desktop:start-local-stack": { pages: ["fallback"], devOnly: true },
  "nexusforge-desktop:set-workspace-path": { pages: ["fallback"], devOnly: true },
  "nexusforge-desktop:open-local-stack-log": { pages: ["fallback"], devOnly: true },
});

/** { allowed, reason } for a request on `channel` from a page of kind `page` (null: not a trusted sender). */
function authorizeIpc(channel, page, { isPackaged }) {
  const rule = Object.prototype.hasOwnProperty.call(CHANNELS, channel) ? CHANNELS[channel] : null;
  if (!rule) return { allowed: false, reason: "unknown-channel" };
  if (rule.devOnly && isPackaged) return { allowed: false, reason: "dev-only" };
  if (!page) return { allowed: false, reason: "untrusted-sender" };
  if (!rule.pages.includes(page)) return { allowed: false, reason: "page-not-allowed" };
  return { allowed: true, reason: "ok" };
}

/**
 * The sender of an IPC event as plain data: which of the app's windows (roleOf maps the sender webContents to
 * "main", "splash", or anything else), whether it is the top frame, and the frame's address. Null when the frame
 * is gone (it navigated or closed after sending).
 */
function describeSender(event, roleOf) {
  const sender = event && event.sender;
  let frame = null;
  try {
    frame = event && event.senderFrame;
  } catch {
    frame = null;
  }
  if (!sender || !frame) return null;
  let parent;
  let url;
  try {
    parent = frame.parent;
    url = frame.url;
  } catch {
    return null;
  }
  return {
    windowRole: (typeof roleOf === "function" && roleOf(sender)) || "other",
    isTopFrame: parent === null,
    url: typeof url === "string" ? url : "",
  };
}

/**
 * The one check every IPC channel uses. roleOf(webContents) names the window; classify(sender) is classifySender
 * bound to this run's policy; onRefused(channel, reason, sender) is told about each refusal (for the log).
 * Returns check(channel, event) -> { allowed, reason, page }.
 */
function createIpcGuard({ roleOf, classify, isPackaged, onRefused }) {
  return function check(channel, event) {
    const sender = describeSender(event, roleOf);
    const page = sender ? classify(sender) : null;
    const decision = authorizeIpc(channel, page, { isPackaged });
    if (!decision.allowed && typeof onRefused === "function") onRefused(channel, decision.reason, sender);
    return { ...decision, page };
  };
}

module.exports = { CHANNELS, authorizeIpc, describeSender, createIpcGuard };
