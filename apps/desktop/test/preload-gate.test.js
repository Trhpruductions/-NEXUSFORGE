"use strict";

// Runs preload.js in a sandbox with a fake Electron, so the bridge-exposure check can be tested without Electron.
// It must agree with origin-rules.js, which main.js uses for the same decision.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const rules = require("../lib/origin-rules");

const root = path.join(__dirname, "..");
const preloadSource = fs.readFileSync(path.join(root, "preload.js"), "utf8");
const splashPath = path.join(root, "splash.html");
const fallbackPath = path.join(root, "fallback.html");

/** Runs the preload for a page at `href` with the given argv; returns the exposed API (or null). */
function runPreload(href, argv) {
  let exposed = null;
  const fakeElectron = {
    contextBridge: {
      exposeInMainWorld: (name, api) => {
        assert.equal(name, "nexusforgeDesktop");
        exposed = api;
      },
    },
    ipcRenderer: { invoke: async () => undefined, send: () => undefined, on: () => undefined, removeListener: () => undefined },
  };
  const location = new URL(href);
  vm.runInNewContext(preloadSource, {
    require: (name) => {
      assert.equal(name, "electron", "a sandboxed preload can only load electron");
      return fakeElectron;
    },
    process: { argv, platform: "win32" },
    window: { location },
  });
  return exposed;
}

const scopeArgs = (policy, pages) => ["electron.exe", "--type=renderer", rules.bridgeScopeArgument(rules.bridgeScope(policy, pages, true))];

const packagedPolicy = rules.createOriginPolicy({ isPackaged: true, startUrl: "https://nfgcord.com/app" });
const packagedArgv = scopeArgs(packagedPolicy, [splashPath]);
const devPolicy = rules.createOriginPolicy({ isPackaged: false, startUrl: "http://127.0.0.2:3310/app" });
const devArgv = scopeArgs(devPolicy, [splashPath, fallbackPath]);

test("the website and the splash page get the bridge", () => {
  const api = runPreload("https://nfgcord.com/app/channels/1", packagedArgv);
  assert.ok(api, "bridge exposed");
  assert.equal(api.runtime, "electron");
  assert.ok(api.features.includes("fullscreen-state"));
  assert.ok(runPreload(pathToFileURL(splashPath).href, packagedArgv));
});

test("the offline page, error pages, other sites and old domains get no bridge", () => {
  for (const href of [
    "data:text/html,offline",
    "chrome-error://chromewebdata/",
    "about:blank",
    "https://trhpruductions.github.io/-NEXUSFORGE/download.html",
    "https://nexusforge.app/app",
    "https://nfgcord.com.evil.example/app",
    "http://127.0.0.1:3300/app",
    pathToFileURL(fallbackPath).href,
    pathToFileURL(path.join(root, "main.js")).href,
  ]) {
    assert.equal(runPreload(href, packagedArgv), null, href);
  }
});

test("no scope argument means no bridge", () => {
  assert.equal(runPreload("https://nfgcord.com/app", ["electron.exe"]), null);
  assert.equal(runPreload("https://nfgcord.com/app", ["electron.exe", "--nexusforge-bridge-scope=%7Bbroken"]), null);
});

test("dev builds: local dev servers and the recovery page get the bridge", () => {
  assert.ok(runPreload("http://127.0.0.2:3310/app", devArgv));
  assert.ok(runPreload("http://localhost:3000/app", devArgv));
  assert.ok(runPreload(pathToFileURL(fallbackPath).href, devArgv));
  assert.equal(runPreload("https://evil.example/app", devArgv), null);
});

test("the preload's decision matches origin-rules.js for the same pages", () => {
  const samples = [
    "https://nfgcord.com/app",
    "https://www.nfgcord.com/",
    "https://nfgcord.com:8443/app",
    "http://nfgcord.com/app",
    "https://evil.example/",
    "http://127.0.0.2:3310/app",
    "http://[::1]:3000/",
    "http://app.localhost:3000/",
    pathToFileURL(splashPath).href,
    pathToFileURL(fallbackPath).href,
    "data:text/html,x",
  ];
  for (const [policy, argv, pages] of [
    [packagedPolicy, packagedArgv, [splashPath]],
    [devPolicy, devArgv, [splashPath, fallbackPath]],
  ]) {
    for (const href of samples) {
      const expected = policy.isTrustedUrl(href) || pages.some((page) => rules.isBundledPage(href, page, true));
      assert.equal(Boolean(runPreload(href, argv)), expected, `${policy.isPackaged ? "packaged" : "dev"}: ${href}`);
    }
  }
});
