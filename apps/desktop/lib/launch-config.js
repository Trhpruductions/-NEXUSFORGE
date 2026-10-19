"use strict";

// Where the app opens and which environment overrides it honours. No Electron here, so the rules can be tested.
//
// The packaged app always opens the hosted app and always checks certificates: environment variables that change
// the target address, the update manifest, or turn off TLS checks are ignored there (anything that can set an
// environment variable for the user could otherwise point the app, and its bridge, at another site).
// Unpackaged dev builds keep honouring them, so developers can still test against a local or tunnel host.

const DEFAULT_HOSTED_START_URL = "https://nfgcord.com/app";
const DEFAULT_HOSTED_DOWNLOAD_URL = "https://nfgcord.com/download";
const LOCAL_START_URL = "http://127.0.0.1:3300/app";

/** Environment variables that only unpackaged dev builds honour. */
const DEV_ONLY_ENV = Object.freeze([
  "NEXUSFORGE_DESKTOP_URL",
  "NEXUSFORGE_PUBLIC_BASE_URL",
  "NEXUSFORGE_PUBLIC_DOWNLOAD_BASE_URL",
  "NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL",
  "NEXUSFORGE_UPDATE_MANIFEST_URL",
  "NEXUSFORGE_ALLOW_HOSTED_DEV",
  "NEXUSFORGE_ALLOW_HOSTED_CERT_BYPASS",
  "NEXUSFORGE_WORKSPACE_PATH",
]);

/** Chromium switches that weaken certificate checks. The packaged app removes them before it starts loading pages. */
const TLS_WEAKENING_SWITCHES = Object.freeze([
  "ignore-certificate-errors",
  "ignore-certificate-errors-spki-list",
  "ignore-urlfetcher-cert-requests",
  "allow-insecure-localhost",
]);

function normalizeUrl(value) {
  const candidate = String(value ?? "").trim();
  if (!candidate) return null;
  try {
    return new URL(candidate).toString();
  } catch {
    // Host-only values like "localhost:3300/app" or "nfgcord.com/app".
  }
  try {
    return new URL(`http://${candidate}`).toString();
  } catch {
    return null;
  }
}

function parseBooleanFlag(raw, defaultValue = false) {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "") return Boolean(defaultValue);
  return ["1", "true", "yes", "y", "on"].includes(value);
}

const trimSlash = (value) => value.replace(/\/+$/, "");

/**
 * The launch settings for this run. env: process.env. Returns the honoured values plus ignoredEnv, the names (never
 * the values) of overrides that were set but ignored because the app is packaged.
 */
function readLaunchConfig(env, { isPackaged }) {
  const source = env || {};
  const ignoredEnv = [];
  const read = (name) => {
    const raw = source[name];
    const isSet = raw !== undefined && String(raw).trim() !== "";
    if (!isSet) return "";
    if (isPackaged) {
      ignoredEnv.push(name);
      return "";
    }
    return String(raw);
  };
  const desktopUrl = normalizeUrl(read("NEXUSFORGE_DESKTOP_URL")) || "";
  const publicBaseUrl = normalizeUrl(read("NEXUSFORGE_PUBLIC_BASE_URL")) || "";
  const publicDownloadBaseUrl = normalizeUrl(read("NEXUSFORGE_PUBLIC_DOWNLOAD_BASE_URL")) || "";
  const persistentDownloadBaseUrl = normalizeUrl(read("NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL")) || "";
  const manifestOverride = normalizeUrl(read("NEXUSFORGE_UPDATE_MANIFEST_URL")) || "";
  const allowHostedDev = parseBooleanFlag(read("NEXUSFORGE_ALLOW_HOSTED_DEV"), false);
  // Certificate checks stay on unless a dev build deliberately sets NEXUSFORGE_ALLOW_HOSTED_CERT_BYPASS=true.
  const allowCertBypass = parseBooleanFlag(read("NEXUSFORGE_ALLOW_HOSTED_CERT_BYPASS"), false);
  const workspacePath = read("NEXUSFORGE_WORKSPACE_PATH").trim();

  const downloadBaseUrl = persistentDownloadBaseUrl || publicDownloadBaseUrl || publicBaseUrl;
  const downloadPageUrl = downloadBaseUrl ? `${trimSlash(downloadBaseUrl)}/download.html` : "";
  const configuredStartUrl =
    desktopUrl ||
    (publicBaseUrl ? `${trimSlash(publicBaseUrl)}/app` : "") ||
    (downloadBaseUrl ? `${trimSlash(downloadBaseUrl)}/app` : "");

  return {
    isPackaged: Boolean(isPackaged),
    desktopUrl,
    publicBaseUrl,
    downloadBaseUrl,
    downloadPageUrl,
    configuredStartUrl,
    manifestOverride,
    allowHostedDev,
    allowCertBypass,
    workspacePath,
    ignoredEnv,
  };
}

const LOCAL_TARGET_HOST = /^(?:localhost|127\.0\.0\.1|::1)$/i;

/**
 * A "local" target turns on local auto-start in dev builds (which runs `npm run dev`). Only localhost and
 * 127.0.0.1 count: 127.0.0.2 test stacks are deliberately treated as hosted.
 */
function isLocalHostTarget(value) {
  const normalized = normalizeUrl(value ?? "");
  if (!normalized) return false;
  try {
    return LOCAL_TARGET_HOST.test(new URL(normalized).hostname);
  } catch {
    return false;
  }
}

/** The address the main window opens. The packaged app always opens the hosted app. */
function resolveStartUrl(config) {
  if (config.isPackaged) return DEFAULT_HOSTED_START_URL;
  const forceLocal = !config.allowHostedDev;
  if (forceLocal && config.configuredStartUrl && !isLocalHostTarget(config.configuredStartUrl)) return LOCAL_START_URL;
  return config.configuredStartUrl || LOCAL_START_URL;
}

/** The page shown as the last hosted fallback (the download page). */
function resolveHostedFallbackUrl(config) {
  return (!config.isPackaged && config.downloadPageUrl) || DEFAULT_HOSTED_DOWNLOAD_URL;
}

/** Where updates are announced. The packaged app always uses the hosted manifest; dev builds may override it. */
function resolveUpdateManifestUrl(config) {
  if (config.isPackaged) return `${new URL(DEFAULT_HOSTED_DOWNLOAD_URL).origin}/desktop-update.json`;
  if (config.manifestOverride) return config.manifestOverride;
  if (config.downloadBaseUrl) return `${config.downloadBaseUrl.replace(/\/$/, "")}/desktop-update.json`;
  return null;
}

/** Which of the TLS-weakening switches are present (hasSwitch: app.commandLine.hasSwitch). */
function tlsSwitchesPresent(hasSwitch) {
  return TLS_WEAKENING_SWITCHES.filter((name) => {
    try {
      return Boolean(hasSwitch(name));
    } catch {
      return false;
    }
  });
}

module.exports = {
  DEFAULT_HOSTED_START_URL,
  DEFAULT_HOSTED_DOWNLOAD_URL,
  LOCAL_START_URL,
  DEV_ONLY_ENV,
  TLS_WEAKENING_SWITCHES,
  normalizeUrl,
  parseBooleanFlag,
  readLaunchConfig,
  isLocalHostTarget,
  resolveStartUrl,
  resolveHostedFallbackUrl,
  resolveUpdateManifestUrl,
  tlsSwitchesPresent,
};
