"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { CHANNELS, authorizeIpc, describeSender, createIpcGuard } = require("../lib/ipc-policy");
const { createOriginPolicy, classifySender } = require("../lib/origin-rules");

const root = path.join(__dirname, "..");
const splashPath = path.join(root, "splash.html");
const fallbackPath = path.join(root, "fallback.html");
const P = "nexusforge-desktop:";

test("unknown channels and untrusted senders are refused", () => {
  assert.deepEqual(authorizeIpc(`${P}does-not-exist`, "app", { isPackaged: false }), { allowed: false, reason: "unknown-channel" });
  assert.deepEqual(authorizeIpc("__proto__", "app", { isPackaged: false }), { allowed: false, reason: "unknown-channel" });
  assert.deepEqual(authorizeIpc(`${P}get-update-state`, null, { isPackaged: true }), { allowed: false, reason: "untrusted-sender" });
});

test("dev-only channels are refused in the packaged app, whoever asks", () => {
  for (const name of ["start-local-stack", "set-workspace-path", "open-local-stack-log"]) {
    assert.equal(CHANNELS[`${P}${name}`].devOnly, true, `${name} is dev only`);
    for (const page of ["app", "fallback", "splash", null]) {
      assert.equal(authorizeIpc(`${P}${name}`, page, { isPackaged: true }).allowed, false, `${name} from ${page}`);
    }
  }
});

test("running npm or choosing a workspace is never available to a web page, even in a dev build", () => {
  assert.equal(authorizeIpc(`${P}start-local-stack`, "app", { isPackaged: false }).allowed, false);
  assert.equal(authorizeIpc(`${P}set-workspace-path`, "app", { isPackaged: false }).allowed, false);
  assert.equal(authorizeIpc(`${P}start-local-stack`, "fallback", { isPackaged: false }).allowed, true);
  assert.equal(authorizeIpc(`${P}set-workspace-path`, "fallback", { isPackaged: false }).allowed, true);
});

test("each page kind gets only its own channels", () => {
  const packaged = { isPackaged: true };
  // The website's calls.
  for (const name of ["get-update-state", "check-updates-now", "download-update-now", "restart-for-update", "is-fullscreen", "reset-window-layout", "get-local-stack-status"]) {
    assert.equal(authorizeIpc(`${P}${name}`, "app", packaged).allowed, true, `app: ${name}`);
  }
  // The splash page's calls.
  for (const name of ["get-update-state", "download-update-now", "resolve-update-prompt", "restart-for-update", "retry-app-load", "splash-control"]) {
    assert.equal(authorizeIpc(`${P}${name}`, "splash", packaged).allowed, true, `splash: ${name}`);
  }
  assert.equal(authorizeIpc(`${P}splash-control`, "app", packaged).allowed, false, "a web page cannot close the app via the splash control");
  assert.equal(authorizeIpc(`${P}update-desktop-preferences`, "splash", packaged).allowed, false);
  assert.equal(authorizeIpc(`${P}restart-clean-session`, "splash", packaged).allowed, false);
  assert.equal(authorizeIpc(`${P}restart-clean-session`, "fallback", packaged).allowed, false);
});

// ---- describeSender / createIpcGuard with fake Electron events ----

const mainContents = { id: 1 };
const splashContents = { id: 2 };
const popoutContents = { id: 3 };
const roleOf = (contents) => (contents === mainContents ? "main" : contents === splashContents ? "splash" : "other");
const topFrame = (url) => ({ parent: null, url });
const subFrame = (url) => ({ parent: topFrame("https://nfgcord.com/app"), url });
const event = (sender, senderFrame) => ({ sender, senderFrame });

function guardFor(isPackaged, startUrl = "https://nfgcord.com/app") {
  const policy = createOriginPolicy({ isPackaged, startUrl });
  const refusals = [];
  const check = createIpcGuard({
    roleOf,
    classify: (sender) => classifySender(sender, { policy, splashPath, fallbackPath: isPackaged ? null : fallbackPath }),
    isPackaged,
    onRefused: (channel, reason) => refusals.push(`${channel}:${reason}`),
  });
  return { check, refusals };
}

test("a sender is described by window, frame position and address", () => {
  assert.deepEqual(describeSender(event(mainContents, topFrame("https://nfgcord.com/app")), roleOf), {
    windowRole: "main",
    isTopFrame: true,
    url: "https://nfgcord.com/app",
  });
  assert.equal(describeSender(event(mainContents, null), roleOf), null, "the frame is gone");
  assert.equal(describeSender({}, roleOf), null);
  assert.equal(describeSender(null, roleOf), null);
  const throwing = { sender: mainContents, get senderFrame() { throw new Error("destroyed"); } };
  assert.equal(describeSender(throwing, roleOf), null);
});

test("the guard accepts the website's top frame in the main window", () => {
  const { check, refusals } = guardFor(true);
  const result = check(`${P}get-update-state`, event(mainContents, topFrame("https://nfgcord.com/app/settings")));
  assert.equal(result.allowed, true);
  assert.equal(result.page, "app");
  assert.deepEqual(refusals, []);
});

test("the guard refuses subframes, other windows, untrusted pages and vanished frames", () => {
  const { check, refusals } = guardFor(true);
  const cases = [
    event(mainContents, subFrame("https://nfgcord.com/embed")),
    event(mainContents, subFrame("https://www.youtube.com/embed/x")),
    event(popoutContents, topFrame("https://nfgcord.com/app")),
    event(mainContents, topFrame("https://trhpruductions.github.io/-NEXUSFORGE")),
    event(mainContents, topFrame("data:text/html,offline")),
    event(mainContents, topFrame("chrome-error://chromewebdata/")),
    event(mainContents, null),
  ];
  for (const item of cases) {
    assert.equal(check(`${P}check-updates-now`, item).allowed, false);
  }
  assert.equal(refusals.length, cases.length, "every refusal is reported for the log");
});

test("the packaged guard refuses start-local-stack and set-workspace-path even from the trusted website", () => {
  const { check } = guardFor(true);
  const fromSite = event(mainContents, topFrame("https://nfgcord.com/app"));
  assert.equal(check(`${P}start-local-stack`, fromSite).reason, "dev-only");
  assert.equal(check(`${P}set-workspace-path`, fromSite).reason, "dev-only");
  const fromFallback = event(mainContents, topFrame(pathToFileURL(fallbackPath).href));
  assert.equal(check(`${P}start-local-stack`, fromFallback).allowed, false);
});

test("in a dev build the bundled recovery page may start the local stack; the splash may not", () => {
  const { check } = guardFor(false, "http://127.0.0.1:3301/app");
  assert.equal(check(`${P}start-local-stack`, event(mainContents, topFrame(pathToFileURL(fallbackPath).href))).allowed, true);
  assert.equal(check(`${P}start-local-stack`, event(splashContents, topFrame(pathToFileURL(splashPath).href))).allowed, false);
  assert.equal(check(`${P}start-local-stack`, event(mainContents, topFrame("http://127.0.0.1:3301/app"))).allowed, false);
});

test("the splash page is accepted from the splash window only", () => {
  const { check } = guardFor(true);
  const splashUrl = pathToFileURL(splashPath).href;
  assert.equal(check(`${P}splash-control`, event(splashContents, topFrame(splashUrl))).allowed, true);
  assert.equal(check(`${P}splash-control`, event(mainContents, topFrame(splashUrl))).allowed, false);
  assert.equal(check(`${P}splash-control`, event(splashContents, topFrame("https://nfgcord.com/app"))).allowed, false);
});

// ---- Every channel in main.js goes through the guard, and the policy covers every channel ----

const normalizeEol = (text) => text.split("\r\n").join("\n");
const mainSource = normalizeEol(fs.readFileSync(path.join(root, "main.js"), "utf8"));
const preloadSource = normalizeEol(fs.readFileSync(path.join(root, "preload.js"), "utf8"));

test("main.js registers IPC only through handleIpc / onIpc", () => {
  const direct = mainSource.match(/ipcMain\.(handle|on|once|handleOnce|addListener)\(/g) || [];
  assert.deepEqual(direct.sort(), ["ipcMain.handle(", "ipcMain.on("], "only the two guarded helpers call ipcMain directly");
  const helperBodies = mainSource.match(/function (handleIpc|onIpc)\(channel, \w+\) \{\n {2}ipcMain\.(handle|on)\(channel, (async )?\(event, \.\.\.args\) => \{\n {4}const decision = checkIpcSender\(channel, event\);\n {4}if \(!decision\.allowed\) \{/g) || [];
  assert.equal(helperBodies.length, 2, "both helpers check the sender before anything else");
});

test("every registered channel has a policy, and every policy entry is registered", () => {
  const registered = new Set([...mainSource.matchAll(/(?:handleIpc|onIpc)\("([^"]+)"/g)].map((match) => match[1]));
  assert.deepEqual([...registered].sort(), Object.keys(CHANNELS).sort());
});

test("every channel the preload uses has a policy", () => {
  const used = new Set([...preloadSource.matchAll(/ipcRenderer\.(?:invoke|send)\("([^"]+)"/g)].map((match) => match[1]));
  assert.ok(used.size >= 19);
  for (const channel of used) {
    assert.ok(Object.prototype.hasOwnProperty.call(CHANNELS, channel), `policy for ${channel}`);
  }
});
