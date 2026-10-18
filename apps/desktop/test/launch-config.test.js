"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const config = require("../lib/launch-config");

const overrides = {
  NEXUSFORGE_DESKTOP_URL: "https://evil.example/app",
  NEXUSFORGE_PUBLIC_BASE_URL: "https://evil.example",
  NEXUSFORGE_PUBLIC_DOWNLOAD_BASE_URL: "https://evil.example/dl",
  NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL: "https://evil.example/persist",
  NEXUSFORGE_UPDATE_MANIFEST_URL: "https://evil.example/desktop-update.json",
  NEXUSFORGE_ALLOW_HOSTED_DEV: "true",
  NEXUSFORGE_ALLOW_HOSTED_CERT_BYPASS: "true",
  NEXUSFORGE_WORKSPACE_PATH: "C:\\somewhere",
};

test("the packaged app ignores every target, manifest and certificate override", () => {
  const settings = config.readLaunchConfig(overrides, { isPackaged: true });
  assert.equal(config.resolveStartUrl(settings), "https://nfgcord.com/app");
  assert.equal(config.resolveUpdateManifestUrl(settings), "https://nfgcord.com/desktop-update.json");
  assert.equal(config.resolveHostedFallbackUrl(settings), "https://nfgcord.com/download");
  assert.equal(settings.allowCertBypass, false);
  assert.equal(settings.allowHostedDev, false);
  assert.equal(settings.workspacePath, "");
  assert.equal(settings.desktopUrl, "");
  assert.deepEqual(settings.ignoredEnv.sort(), Object.keys(overrides).sort(), "the ignored names are reported (never values)");
  assert.equal(JSON.stringify(settings.ignoredEnv).includes("evil"), false);
});

test("the packaged app with no overrides opens the hosted app and reports nothing ignored", () => {
  const settings = config.readLaunchConfig({ PATH: "x", NEXUSFORGE_DESKTOP_URL: "   " }, { isPackaged: true });
  assert.equal(config.resolveStartUrl(settings), "https://nfgcord.com/app");
  assert.deepEqual(settings.ignoredEnv, []);
});

test("a packaged app never opens a local address, whatever the environment says", () => {
  for (const value of ["http://127.0.0.1:3300/app", "localhost:3300/app", "http://[::1]:3300"]) {
    const settings = config.readLaunchConfig({ NEXUSFORGE_DESKTOP_URL: value, NEXUSFORGE_ALLOW_HOSTED_DEV: "true" }, { isPackaged: true });
    assert.equal(config.resolveStartUrl(settings), "https://nfgcord.com/app", value);
  }
});

test("dev builds keep honouring the overrides", () => {
  const settings = config.readLaunchConfig(overrides, { isPackaged: false });
  assert.equal(config.resolveStartUrl(settings), "https://evil.example/app", "hosted dev allowed by NEXUSFORGE_ALLOW_HOSTED_DEV");
  assert.equal(config.resolveUpdateManifestUrl(settings), "https://evil.example/desktop-update.json");
  assert.equal(settings.allowCertBypass, true);
  assert.equal(settings.workspacePath, "C:\\somewhere");
  assert.deepEqual(settings.ignoredEnv, []);
});

test("dev builds: same start-URL rules as before", () => {
  const start = (env) => config.resolveStartUrl(config.readLaunchConfig(env, { isPackaged: false }));
  assert.equal(start({}), "http://127.0.0.1:3300/app", "no target: local");
  assert.equal(start({ NEXUSFORGE_DESKTOP_URL: "https://nfgcord.com/app" }), "http://127.0.0.1:3300/app", "a hosted target needs NEXUSFORGE_ALLOW_HOSTED_DEV");
  assert.equal(start({ NEXUSFORGE_DESKTOP_URL: "http://127.0.0.1:3301/app" }), "http://127.0.0.1:3301/app");
  assert.equal(start({ NEXUSFORGE_DESKTOP_URL: "http://127.0.0.2:3310/app", NEXUSFORGE_ALLOW_HOSTED_DEV: "yes" }), "http://127.0.0.2:3310/app");
  assert.equal(start({ NEXUSFORGE_PUBLIC_BASE_URL: "https://nfgcord.com/", NEXUSFORGE_ALLOW_HOSTED_DEV: "1" }), "https://nfgcord.com/app");
  const settings = config.readLaunchConfig({ NEXUSFORGE_PUBLIC_DOWNLOAD_BASE_URL: "https://dl.example/" }, { isPackaged: false });
  assert.equal(config.resolveUpdateManifestUrl(settings), "https://dl.example/desktop-update.json");
  assert.equal(config.resolveHostedFallbackUrl(settings), "https://dl.example/download.html");
  assert.equal(config.resolveUpdateManifestUrl(config.readLaunchConfig({}, { isPackaged: false })), null, "dev builds without a manifest do not auto-update");
});

test("only localhost and 127.0.0.1 count as local targets (127.0.0.2 test stacks stay hosted)", () => {
  assert.equal(config.isLocalHostTarget("http://127.0.0.1:3300/app"), true);
  assert.equal(config.isLocalHostTarget("http://localhost:3000"), true);
  assert.equal(config.isLocalHostTarget("http://127.0.0.2:3310/app"), false);
  assert.equal(config.isLocalHostTarget("https://nfgcord.com/app"), false);
  assert.equal(config.isLocalHostTarget(""), false);
  assert.equal(config.isLocalHostTarget(undefined), false);
});

test("TLS-weakening switches are detected for removal", () => {
  const present = new Set(["ignore-certificate-errors", "allow-insecure-localhost", "remote-debugging-port"]);
  assert.deepEqual(config.tlsSwitchesPresent((name) => present.has(name)), ["ignore-certificate-errors", "allow-insecure-localhost"]);
  assert.deepEqual(config.tlsSwitchesPresent(() => false), []);
  assert.deepEqual(config.tlsSwitchesPresent(() => { throw new Error("x"); }), []);
});

test("boolean flags and URL normalising", () => {
  assert.equal(config.parseBooleanFlag("TRUE"), true);
  assert.equal(config.parseBooleanFlag("on"), true);
  assert.equal(config.parseBooleanFlag("0"), false);
  assert.equal(config.parseBooleanFlag("", true), true);
  assert.equal(config.parseBooleanFlag(undefined), false);
  assert.equal(config.normalizeUrl("nfgcord.com/app"), "http://nfgcord.com/app");
  assert.equal(config.normalizeUrl("https://nfgcord.com"), "https://nfgcord.com/");
  assert.equal(config.normalizeUrl("   "), null);
  assert.equal(config.normalizeUrl(undefined), null);
});
