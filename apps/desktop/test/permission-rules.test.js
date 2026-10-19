"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { GRANTABLE, decidePermission } = require("../lib/permission-rules");
const { createOriginPolicy } = require("../lib/origin-rules");

const policy = createOriginPolicy({ isPackaged: true, startUrl: "https://nfgcord.com/app" });
const site = "https://nfgcord.com";
const ask = (overrides) =>
  decidePermission({ permission: "media", appWindow: true, topOrigin: site, requestingOrigin: site, isMainFrame: true, ...overrides }, policy);

test("the app's own top frame gets camera, microphone and the other app permissions", () => {
  for (const permission of ["media", "display-capture", "fullscreen", "notifications", "clipboard-sanitized-write", "pointerLock"]) {
    assert.equal(ask({ permission }).allowed, true, permission);
  }
  assert.equal(GRANTABLE.size, 6);
});

test("everything else is refused, even for the app itself", () => {
  for (const permission of ["geolocation", "clipboard-read", "midi", "midiSysex", "openExternal", "hid", "serial", "usb", "idle-detection", "window-management", "keyboardLock", "storage-access", "top-level-storage-access", "fileSystem", "mediaKeySystem", "speaker-selection", "unknown", "deprecated-sync-clipboard-read"]) {
    const result = ask({ permission });
    assert.equal(result.allowed, false, permission);
    assert.equal(result.reason, "permission-not-granted-by-app");
  }
});

test("a same-origin frame inside the app may use them; a third-party embed may not use the camera or microphone", () => {
  assert.equal(ask({ isMainFrame: false, requestingOrigin: site }).allowed, true);
  const embed = ask({ isMainFrame: false, requestingOrigin: "https://www.youtube.com" });
  assert.equal(embed.allowed, false);
  assert.equal(embed.reason, "untrusted-frame");
  assert.equal(ask({ permission: "notifications", isMainFrame: false, requestingOrigin: "https://player.twitch.tv" }).allowed, false);
  assert.equal(ask({ permission: "pointerLock", isMainFrame: false, requestingOrigin: "https://evil.example" }).allowed, false);
  assert.equal(ask({ isMainFrame: false, requestingOrigin: "https://www.nfgcord.com" }).reason, "cross-origin-frame", "trusted but another origin");
  assert.equal(ask({ isMainFrame: false, requestingOrigin: null }).allowed, false, "unknown frame origin");
});

test("full screen may be used by a video embedded in a trusted page (it needs the page's allow=fullscreen)", () => {
  const result = ask({ permission: "fullscreen", isMainFrame: false, requestingOrigin: "https://www.youtube.com" });
  assert.equal(result.allowed, true);
  assert.equal(result.reason, "delegated-to-embed");
  assert.equal(ask({ permission: "fullscreen", isMainFrame: false, requestingOrigin: "https://www.youtube.com", topOrigin: "https://evil.example" }).allowed, false, "not inside an untrusted page");
});

test("untrusted pages and windows that are not the app get nothing", () => {
  assert.equal(ask({ topOrigin: "https://trhpruductions.github.io", requestingOrigin: "https://trhpruductions.github.io" }).reason, "untrusted-page");
  assert.equal(ask({ topOrigin: "https://nexusforge.app", requestingOrigin: "https://nexusforge.app" }).allowed, false);
  assert.equal(ask({ topOrigin: null, requestingOrigin: null }).allowed, false, "data: offline page or error page");
  assert.equal(ask({ appWindow: false }).reason, "not-an-app-window", "splash, picker or What's New window");
  assert.equal(ask({ topOrigin: "http://127.0.0.1:3300", requestingOrigin: "http://127.0.0.1:3300" }).allowed, false, "local pages in a packaged build");
});

test("a dev build also grants them to local dev servers", () => {
  const dev = createOriginPolicy({ isPackaged: false, startUrl: "http://127.0.0.2:3310/app" });
  const local = "http://127.0.0.2:3310";
  assert.equal(decidePermission({ permission: "media", appWindow: true, topOrigin: local, requestingOrigin: local, isMainFrame: true }, dev).allowed, true);
});

test("a decision without a policy refuses", () => {
  assert.equal(decidePermission({ permission: "media", appWindow: true, topOrigin: site, requestingOrigin: site, isMainFrame: true }, null).allowed, false);
});
