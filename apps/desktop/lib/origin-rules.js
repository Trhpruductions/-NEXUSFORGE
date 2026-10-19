"use strict";

// Which pages the desktop app trusts. No Electron here, so the rules can be tested directly.
// Only a trusted page may load inside the app window, receive the desktop bridge (preload), call the main process
// over IPC, or be granted camera, microphone, notification and similar permissions.
//
// Packaged app: the hosted app only. www.nfgcord.com redirects to nfgcord.com; both are the owner's same site.
// Unpackaged dev builds also trust the configured start URL's origin and loopback origins (local dev servers).
// Obsolete domains (nexusforge.app, the old GitHub Pages site) are not trusted anywhere.

const { pathToFileURL } = require("node:url");

const HOSTED_APP_ORIGINS = Object.freeze(["https://nfgcord.com", "https://www.nfgcord.com"]);

function parseUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** The origin of an http(s) address, or null for anything else (file:, data:, about:blank, junk). */
function originOf(value) {
  const url = parseUrl(value);
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) return null;
  return url.origin;
}

/** localhost, *.localhost, 127.0.0.0/8 and ::1. */
function isLoopbackHostname(hostname) {
  const host = String(hostname || "")
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  return host === "localhost" || host.endsWith(".localhost") || host === "::1" || /^127(?:\.\d{1,3}){3}$/.test(host);
}

function isLoopbackUrl(value) {
  const url = parseUrl(value);
  return Boolean(url && (url.protocol === "http:" || url.protocol === "https:") && isLoopbackHostname(url.hostname));
}

/**
 * The trust policy for this run. isPackaged: app.isPackaged. startUrl: the address the app opens (only used by
 * unpackaged dev builds, where a developer may point it at a test host).
 */
function createOriginPolicy({ isPackaged, startUrl } = {}) {
  const packaged = Boolean(isPackaged);
  const origins = new Set(HOSTED_APP_ORIGINS);
  if (!packaged) {
    const devStart = originOf(startUrl);
    if (devStart) origins.add(devStart);
  }
  const isTrustedOrigin = (value) => {
    const origin = originOf(value);
    if (!origin) return false;
    if (origins.has(origin)) return true;
    return !packaged && isLoopbackUrl(origin);
  };
  return {
    isPackaged: packaged,
    /** Accepts an origin ("https://nfgcord.com") or a full address; both are reduced to the origin first. */
    isTrustedOrigin,
    isTrustedUrl: isTrustedOrigin,
    /** Listed origins, for the preload. Dev builds also trust any loopback origin (allowLoopback). */
    origins: () => Array.from(origins),
    allowLoopback: !packaged,
  };
}

/**
 * A comparable key for a file: address ("host|/decoded/path"), or null. Windows paths compare without case.
 * The query and fragment are ignored.
 */
function fileUrlKey(value, caseInsensitive = process.platform === "win32") {
  const url = parseUrl(value);
  if (!url || url.protocol !== "file:") return null;
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  const key = `${url.host}|${pathname}`;
  return caseInsensitive ? key.toLowerCase() : key;
}

/** True when `value` is the file: address of the bundled file at `filePath`. */
function isBundledPage(value, filePath, caseInsensitive = process.platform === "win32") {
  if (!filePath) return false;
  const actual = fileUrlKey(value, caseInsensitive);
  return actual !== null && actual === fileUrlKey(pathToFileURL(filePath).href, caseInsensitive);
}

/**
 * What the preload needs to decide whether a page gets the bridge: the trusted origins, whether loopback origins are
 * trusted (dev builds only), and the bundled pages (as fileUrlKey keys) that use the bridge.
 */
function bridgeScope(policy, bundledPagePaths, caseInsensitive = process.platform === "win32") {
  return {
    origins: policy.origins(),
    loopback: Boolean(policy.allowLoopback),
    caseInsensitive: Boolean(caseInsensitive),
    pages: (bundledPagePaths || [])
      .filter(Boolean)
      .map((filePath) => fileUrlKey(pathToFileURL(filePath).href, caseInsensitive))
      .filter(Boolean),
  };
}

const BRIDGE_SCOPE_ARG = "--nexusforge-bridge-scope=";

/** The additionalArguments entry main.js hands to windows that use preload.js. */
function bridgeScopeArgument(scope) {
  return `${BRIDGE_SCOPE_ARG}${encodeURIComponent(JSON.stringify(scope))}`;
}

/**
 * The addresses the app window may be sent to when starting or recovering: deduplicated, trusted only. A packaged
 * build never gets a loopback address here, and an untrusted fallback page is never loaded (it would get the bridge).
 */
function trustedLoadTargets(candidates, policy) {
  const seen = new Set();
  const result = [];
  for (const candidate of candidates || []) {
    if (typeof candidate !== "string" || !candidate) continue;
    const url = parseUrl(candidate);
    if (!url) continue;
    const href = url.toString();
    if (seen.has(href)) continue;
    seen.add(href);
    if (!policy.isTrustedUrl(href)) continue;
    if (policy.isPackaged && isLoopbackUrl(href)) continue;
    result.push(href);
  }
  return result;
}

/** A certificate error may only be ignored in an unpackaged dev build that asked for it, and only for trusted pages. */
function certificateBypassAllowed(url, { isPackaged, bypassRequested, policy }) {
  if (isPackaged || !bypassRequested || !policy) return false;
  return policy.isTrustedUrl(url);
}

/**
 * The kind of page that sent an IPC message: "app" (a trusted page in the main window), "fallback" (the bundled
 * local-recovery page in the main window), "splash" (the bundled splash page in the splash window), or null.
 * Only the top frame counts; subframes and every other window are never trusted.
 */
function classifySender(sender, { policy, splashPath, fallbackPath }) {
  if (!sender || !sender.isTopFrame) return null;
  if (sender.windowRole === "main") {
    if (policy.isTrustedUrl(sender.url)) return "app";
    if (fallbackPath && isBundledPage(sender.url, fallbackPath)) return "fallback";
    return null;
  }
  if (sender.windowRole === "splash") {
    return splashPath && isBundledPage(sender.url, splashPath) ? "splash" : null;
  }
  return null;
}

/** Origin only, for logs: a full address can carry tokens in its query. */
function originForLog(value) {
  const url = parseUrl(value);
  if (!url) return "invalid-url";
  if (url.protocol === "http:" || url.protocol === "https:") return url.origin;
  return `${url.protocol}`;
}

module.exports = {
  HOSTED_APP_ORIGINS,
  BRIDGE_SCOPE_ARG,
  originOf,
  isLoopbackHostname,
  isLoopbackUrl,
  createOriginPolicy,
  fileUrlKey,
  isBundledPage,
  bridgeScope,
  bridgeScopeArgument,
  trustedLoadTargets,
  certificateBypassAllowed,
  classifySender,
  originForLog,
};
