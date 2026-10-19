"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const rules = require("../lib/origin-rules");

const packaged = rules.createOriginPolicy({ isPackaged: true, startUrl: "https://nfgcord.com/app" });
const dev = rules.createOriginPolicy({ isPackaged: false, startUrl: "http://127.0.0.2:3310/app" });
const splashPath = path.join(__dirname, "..", "splash.html");
const fallbackPath = path.join(__dirname, "..", "fallback.html");

test("the packaged app trusts the hosted app only", () => {
  assert.equal(packaged.isTrustedOrigin("https://nfgcord.com"), true);
  assert.equal(packaged.isTrustedUrl("https://nfgcord.com/app/channels/1?x=1"), true);
  assert.equal(packaged.isTrustedOrigin("https://www.nfgcord.com"), true, "www redirects to nfgcord.com: same site");
  for (const value of [
    "https://nexusforge.app",
    "https://www.nexusforge.app/app",
    "https://trhpruductions.github.io/-NEXUSFORGE/download.html",
    "http://nfgcord.com",
    "https://evil.nfgcord.com",
    "https://nfgcord.com.evil.example",
    "https://nfgcord.com@evil.example/app",
    "http://127.0.0.1:3300/app",
    "http://localhost:3300",
    "http://[::1]:3300",
  ]) {
    assert.equal(packaged.isTrustedUrl(value), false, `not trusted: ${value}`);
  }
});

test("nothing that is not an http(s) address is trusted", () => {
  for (const value of ["null", "", undefined, null, "file:///C:/app/splash.html", "data:text/html,hi", "about:blank", "chrome-error://chromewebdata/", "javascript:alert(1)"]) {
    assert.equal(packaged.isTrustedUrl(value), false, `not trusted: ${String(value)}`);
    assert.equal(dev.isTrustedUrl(value), false, `not trusted in dev: ${String(value)}`);
  }
});

test("dev builds also trust their start URL and loopback dev servers", () => {
  assert.equal(dev.isTrustedUrl("http://127.0.0.2:3310/app"), true);
  assert.equal(dev.isTrustedUrl("http://127.0.0.1:3300/app"), true);
  assert.equal(dev.isTrustedUrl("http://localhost:3000"), true);
  assert.equal(dev.isTrustedUrl("http://[::1]:3301/app"), true);
  assert.equal(dev.isTrustedUrl("https://nfgcord.com/app"), true);
  assert.equal(dev.isTrustedUrl("https://nexusforge.app/app"), false, "the old domain is not trusted in dev either");
  const tunnel = rules.createOriginPolicy({ isPackaged: false, startUrl: "https://example-tunnel.trycloudflare.com/app" });
  assert.equal(tunnel.isTrustedUrl("https://example-tunnel.trycloudflare.com/app"), true, "a dev start URL is trusted in dev");
  const packagedWithOther = rules.createOriginPolicy({ isPackaged: true, startUrl: "https://example-tunnel.trycloudflare.com/app" });
  assert.equal(packagedWithOther.isTrustedUrl("https://example-tunnel.trycloudflare.com/app"), false, "never in a packaged build");
});

test("loopback hostnames", () => {
  for (const host of ["localhost", "app.localhost", "127.0.0.1", "127.0.0.2", "127.1.2.3", "[::1]", "::1"]) {
    assert.equal(rules.isLoopbackHostname(host), true, host);
  }
  for (const host of ["nfgcord.com", "128.0.0.1", "localhost.example", "10.0.0.1", ""]) {
    assert.equal(rules.isLoopbackHostname(host), false, host);
  }
});

test("bundled pages are recognised by their file address only", () => {
  const splashUrl = pathToFileURL(splashPath).href;
  assert.equal(rules.isBundledPage(splashUrl, splashPath), true);
  assert.equal(rules.isBundledPage(`${splashUrl}?x=1#y`, splashPath), true, "query and fragment are ignored");
  assert.equal(rules.isBundledPage(pathToFileURL(fallbackPath).href, splashPath), false);
  assert.equal(rules.isBundledPage("https://nfgcord.com/splash.html", splashPath), false);
  assert.equal(rules.isBundledPage(splashUrl, null), false);
  // Windows compares paths without case.
  assert.equal(rules.isBundledPage(splashUrl.toUpperCase().replace("FILE:", "file:"), splashPath, true), true);
  assert.equal(rules.isBundledPage(splashUrl.toUpperCase().replace("FILE:", "file:"), splashPath, false), false);
});

test("load targets keep trusted addresses only, and never loopback ones in the packaged app", () => {
  const targets = rules.trustedLoadTargets(
    [
      "https://nfgcord.com/app",
      "https://nfgcord.com/app",
      "https://www.nfgcord.com/app",
      "https://trhpruductions.github.io/-NEXUSFORGE/download.html",
      "https://nexusforge.app/app",
      "http://127.0.0.1:3300/app",
      "not a url",
      null,
      "",
    ],
    packaged,
  );
  assert.deepEqual(targets, ["https://nfgcord.com/app", "https://www.nfgcord.com/app"]);
  assert.deepEqual(rules.trustedLoadTargets(["http://127.0.0.1:3300/app", "https://nexusforge.app"], dev), ["http://127.0.0.1:3300/app"]);
});

test("certificate errors are only ignored in a dev build that asked, for trusted pages", () => {
  assert.equal(rules.certificateBypassAllowed("https://nfgcord.com/app", { isPackaged: true, bypassRequested: true, policy: packaged }), false);
  assert.equal(rules.certificateBypassAllowed("https://nfgcord.com/app", { isPackaged: false, bypassRequested: false, policy: dev }), false);
  assert.equal(rules.certificateBypassAllowed("https://nfgcord.com/app", { isPackaged: false, bypassRequested: true, policy: dev }), true);
  assert.equal(rules.certificateBypassAllowed("https://nexusforge.app/app", { isPackaged: false, bypassRequested: true, policy: dev }), false);
  assert.equal(rules.certificateBypassAllowed("https://evil.example/", { isPackaged: false, bypassRequested: true, policy: dev }), false);
});

test("IPC senders: trusted top-frame pages in the right window only", () => {
  const pages = { policy: packaged, splashPath, fallbackPath: null };
  const classify = (sender) => rules.classifySender(sender, pages);
  assert.equal(classify({ windowRole: "main", isTopFrame: true, url: "https://nfgcord.com/app" }), "app");
  assert.equal(classify({ windowRole: "main", isTopFrame: false, url: "https://nfgcord.com/app" }), null, "a subframe");
  assert.equal(classify({ windowRole: "main", isTopFrame: true, url: "https://trhpruductions.github.io/-NEXUSFORGE" }), null);
  assert.equal(classify({ windowRole: "main", isTopFrame: true, url: "data:text/html,offline" }), null, "the offline page");
  assert.equal(classify({ windowRole: "main", isTopFrame: true, url: pathToFileURL(fallbackPath).href }), null, "no fallback page when packaged");
  assert.equal(classify({ windowRole: "main", isTopFrame: true, url: pathToFileURL(splashPath).href }), null, "the splash page in the main window");
  assert.equal(classify({ windowRole: "splash", isTopFrame: true, url: pathToFileURL(splashPath).href }), "splash");
  assert.equal(classify({ windowRole: "splash", isTopFrame: true, url: "https://nfgcord.com/app" }), null, "the splash window on another page");
  assert.equal(classify({ windowRole: "other", isTopFrame: true, url: "https://nfgcord.com/app" }), null, "a popout or any other window");
  assert.equal(classify(null), null);

  const devPages = { policy: dev, splashPath, fallbackPath };
  assert.equal(rules.classifySender({ windowRole: "main", isTopFrame: true, url: pathToFileURL(fallbackPath).href }, devPages), "fallback");
  assert.equal(rules.classifySender({ windowRole: "main", isTopFrame: true, url: "http://127.0.0.1:3301/app" }, devPages), "app");
});

test("the preload scope lists the trusted origins and bundled pages", () => {
  const scope = rules.bridgeScope(packaged, [splashPath, null], true);
  assert.deepEqual(scope.origins.sort(), ["https://nfgcord.com", "https://www.nfgcord.com"]);
  assert.equal(scope.loopback, false);
  assert.equal(scope.pages.length, 1);
  assert.equal(scope.pages[0], rules.fileUrlKey(pathToFileURL(splashPath).href, true));
  const arg = rules.bridgeScopeArgument(scope);
  assert.ok(arg.startsWith(rules.BRIDGE_SCOPE_ARG));
  assert.deepEqual(JSON.parse(decodeURIComponent(arg.slice(rules.BRIDGE_SCOPE_ARG.length))), scope);
  assert.equal(rules.bridgeScope(dev, [], true).loopback, true);
});

test("logs get the origin only, never the full address", () => {
  assert.equal(rules.originForLog("https://nfgcord.com/app?token=secret#x"), "https://nfgcord.com");
  assert.equal(rules.originForLog("file:///C:/Users/me/splash.html"), "file:");
  assert.equal(rules.originForLog("nonsense"), "invalid-url");
});
