// Utility: fetch with timeout (prevents indefinite hangs)
async function fetchWithTimeout(resource, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}
const { app, BrowserWindow, shell, session, ipcMain, dialog, Tray, Menu, screen } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const https = require("node:https");
const net = require("node:net");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawn } = require("node:child_process");

const localStartUrl = "http://127.0.0.1:3000/app";
const localHostPattern = /^(?:localhost|127\.0\.0\.1|::1)$/i;
function isLocalHostTarget(value) {
  try {
    const normalized = normalizeUrl(value);
    if (!normalized) {
      return false;
    }
    const hostname = new URL(normalized).hostname;
    return localHostPattern.test(hostname);
  } catch {
    return false;
  }
}
function normalizeUrl(value) {
  const candidate = String(value).trim();
  if (!candidate) {
    return null;
  }

  try {
    return new URL(candidate).toString();
  } catch {
    // Support host-only values like "localhost:3000/app" or "nexusforge.app/app".
  }

  try {
    return new URL(`http://${candidate}`).toString();
  } catch {
    // Best effort only.
  }

  return null;
}
function parseBooleanEnv(name, defaultValue = false) {
  const raw = String(process.env[name] ?? "").trim().toLowerCase();
  if (raw === "" || raw === undefined) {
    return Boolean(defaultValue);
  }
  return ["1", "true", "yes", "y", "on"].includes(raw);
}
const configuredDesktopUrl = normalizeUrl(process.env.NEXUSFORGE_DESKTOP_URL || "") || "";
const configuredPublicBaseUrl = normalizeUrl(process.env.NEXUSFORGE_PUBLIC_BASE_URL || "") || "";
const configuredPublicDownloadBaseUrl = normalizeUrl(process.env.NEXUSFORGE_PUBLIC_DOWNLOAD_BASE_URL || "") || "";
const configuredPersistentDownloadBaseUrl = normalizeUrl(process.env.NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL || "") || "";
const effectiveDownloadBaseUrl = configuredPersistentDownloadBaseUrl || configuredPublicDownloadBaseUrl || configuredPublicBaseUrl;
const configuredDownloadPageUrl = effectiveDownloadBaseUrl ? `${effectiveDownloadBaseUrl.replace(/\/+$/, "")}/download.html` : "";
const configuredStartUrl =
  configuredDesktopUrl ||
  (configuredPublicBaseUrl ? `${configuredPublicBaseUrl.replace(/\/+$/, "")}/app` : "") ||
  (effectiveDownloadBaseUrl ? `${effectiveDownloadBaseUrl.replace(/\/+$/, "")}/app` : "");
const defaultPackagedHostedStartUrl = "https://www.nexusforge.app/app";
const defaultPackagedHostedFallbackUrl = "https://www.nexusforge.app/download.html";
const packagedHostedFallbackUrl = configuredDownloadPageUrl || defaultPackagedHostedFallbackUrl;
const allowHostedDevLaunch = parseBooleanEnv("NEXUSFORGE_ALLOW_HOSTED_DEV", false);
const defaultHostedCertBypass = app.isPackaged || /(^|\.)nexusforge\.app$/i.test(new URL(configuredStartUrl || "https://www.nexusforge.app/app").hostname);
const allowHostedCertBypass = parseBooleanEnv("NEXUSFORGE_ALLOW_HOSTED_CERT_BYPASS", defaultHostedCertBypass);
if (allowHostedCertBypass) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  app.commandLine.appendSwitch("ignore-certificate-errors");
}
const shouldForceLocalInDev = !app.isPackaged && !allowHostedDevLaunch;
const startUrl =
  shouldForceLocalInDev && configuredStartUrl && !isLocalHostTarget(configuredStartUrl)
    ? localStartUrl
    : configuredStartUrl || (app.isPackaged ? defaultPackagedHostedStartUrl : localStartUrl);
const isLocalStartTarget = isLocalHostTarget(startUrl);
const desktopLaunchMode = isLocalStartTarget ? "local-dev" : "hosted";
const appIconPath =
  process.platform === "win32"
    ? path.join(__dirname, "assets", "app-icon.ico")
    : path.join(__dirname, "..", "web", "public", "brand", "nexusforge-main-logo.png");
const fallbackPath = path.join(__dirname, "fallback.html");
const splashPath = path.join(__dirname, "splash.html");
const startupWaitTimeoutMs = 90000;
const localStartUrlProbeTimeoutMs = 120000;
const startupQuickRecoveryTimeoutMs = 15000;
const startupProbeDelayMs = 1250;
const startupSplashHoldMs = 2200;
const startupUpdateCheckHoldMs = 12000;
const startupUpdatePromptTimeoutMs = 18000;
const desktopUaToken = "NexusForgeDesktop";
const desktopUserAgentSuffix = ` ${desktopUaToken}/${app.getVersion()}`;
const stableCacheDir = path.join(app.getPath("temp"), "nexusforge-desktop-cache");
const stableCodeCacheDir = path.join(app.getPath("temp"), "nexusforge-desktop-code-cache");
const manifestOverride = normalizeUrl(process.env.NEXUSFORGE_UPDATE_MANIFEST_URL || "");
const updateManifestUrl = manifestOverride
  ? manifestOverride
  : effectiveDownloadBaseUrl
  ? `${effectiveDownloadBaseUrl.replace(/\/$/, "")}/desktop-update.json`
  : app.isPackaged
  ? `${new URL(packagedHostedFallbackUrl).origin}/desktop-update.json`
  : null;
const updateCheckIntervalMs = 15 * 60 * 1000;
const remindLaterDelayMs = 60 * 60 * 1000;
const viewChangesSnoozeDelayMs = 15 * 60 * 1000;
const updateDownloadDir = path.join(app.getPath("userData"), "updates");
const startupLogPath = path.join(app.getPath("userData"), "startup.log");
const windowStatePath = path.join(app.getPath("userData"), "window-state.json");
const desktopPreferencesPath = path.join(app.getPath("userData"), "desktop-preferences.json");
const startupBootEpochMs = Date.now();
const startupTimingMarks = new Set();
const autoInstallOnClose =
  String(process.env.NEXUSFORGE_AUTO_INSTALL_ON_CLOSE || "true").toLowerCase() !== "false";
const forceUpdateByDefault =
  String(process.env.NEXUSFORGE_FORCE_UPDATE || "false").toLowerCase() === "true";
let mainWindow = null;
let splashWindow = null;
let isolatedSessionPath = null;
let bootRecoveryInFlight = false;
let localStackProcess = null;
let localStackLogPath = path.join(app.getPath("userData"), "local-stack.log");
let updateCheckTimer = null;
let startupRevealTimer = null;
let startupUpdateCheckPromise = null;
let startupUpdatePromptPromise = null;
let startupUpdatePromptResolver = null;
let installInProgress = false;
let skipAutoInstallOnQuit = false;
let isQuitting = false;
let appTray = null;
let shouldStartHiddenOnLaunch = false;
const updateStatePath = path.join(app.getPath("userData"), "update-state.json");

const launchedFromStartupArg = process.argv.some((arg) => /^(--|\/)startup$/i.test(String(arg || "").trim()));
const requestedHiddenArg = process.argv.some((arg) => /^(--|\/)(hidden|minimized)$/i.test(String(arg || "").trim()));

let desktopPreferences = {
  launchOnStartup: process.platform === "win32" && app.isPackaged,
  minimizeToTray: true,
  startMinimized: true,
};

let startupRuntime = {
  stage: "Booting desktop shell",
  detail: "Preparing the launch environment.",
  progress: 8,
  accent: "warmup",
  launchMode: desktopLaunchMode,
  currentVersion: app.getVersion(),
  timestamp: new Date().toISOString(),
};

let updateRuntime = {
  checking: false,
  available: false,
  forceRequired: false,
  downloading: false,
  downloaded: false,
  downloadedVersion: null,
  downloadPercent: 0,
  currentVersion: app.getVersion(),
  latestVersion: null,
  notes: [],
  downloadUrl: null,
  downloadUrls: [],
  sha256: null,
  installerPath: null,
  remindLaterUntil: 0,
  lastCheckedAt: null,
  lastError: null,
};

let startupHealth = {
  mode: "web",
  storageResetAttempted: false,
  storageResetSuccess: false,
  message: "Desktop startup health is not active.",
  sessionDataPath: app.getPath("sessionData"),
  lastMaintenanceAction: "none",
  maintenanceHistory: [],
  timestamp: new Date().toISOString(),
};

let localStackStatus = {
  launchMode: desktopLaunchMode,
  startUrl,
  workspacePath: null,
  attempted: false,
  started: false,
  running: false,
  autoStartEnabled: isLocalStartTarget,
  localRecoveryEnabled: isLocalStartTarget || Boolean(process.env.NEXUSFORGE_WORKSPACE_PATH),
  port3000Open: false,
  port4000Open: false,
  port4001Open: false,
  port4000Bound: false,
  port4001Bound: false,
  portApiOpen: false,
  apiPortCandidates: [4000, 4001],
  preferredApiPort: 4000,
  processPid: null,
  lastError: null,
  message: isLocalStartTarget ? "Local stack not started yet." : "Desktop is running in hosted mode.",
  history: [],
  logPath: localStackLogPath,
  timestamp: new Date().toISOString(),
};

try {
  fs.mkdirSync(stableCacheDir, { recursive: true });
  fs.mkdirSync(stableCodeCacheDir, { recursive: true });
} catch (error) {
  console.warn("[NexusForge Desktop] Unable to initialize stable cache directories:", error);
}

app.commandLine.appendSwitch("disk-cache-dir", stableCacheDir);
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch("disable-gpu-program-cache");
app.commandLine.appendSwitch("disable-features", "CodeCache");

function appendMaintenanceHistory(entry) {
  const nextHistory = [entry, ...(startupHealth.maintenanceHistory ?? [])].slice(0, 8);
  startupHealth = {
    ...startupHealth,
    maintenanceHistory: nextHistory,
  };
}

function appendLocalStackHistory(message) {
  const line = `${new Date().toISOString()} - ${message}`;
  const nextHistory = [line, ...(localStackStatus.history ?? [])].slice(0, 12);
  localStackStatus = {
    ...localStackStatus,
    history: nextHistory,
    timestamp: new Date().toISOString(),
  };
}

function appendStartupLog(message) {
  try {
    fs.mkdirSync(path.dirname(startupLogPath), { recursive: true });
    fs.appendFileSync(startupLogPath, `${new Date().toISOString()} ${message}\n`, "utf8");
  } catch {
    // Best-effort diagnostics logging only.
  }
}

function markStartupTiming(label, detail = "", once = true) {
  if (once && startupTimingMarks.has(label)) {
    return;
  }
  startupTimingMarks.add(label);
  const elapsedMs = Date.now() - startupBootEpochMs;
  const suffix = detail ? ` ${detail}` : "";
  appendStartupLog(`[startup-timing] t+${elapsedMs}ms ${label}${suffix}`);
}

function updateLocalStackStatus(next) {
  localStackStatus = {
    ...localStackStatus,
    ...next,
    timestamp: new Date().toISOString(),
  };
}

function readPersistedUpdateState() {
  try {
    if (!fs.existsSync(updateStatePath)) {
      return;
    }
    const parsed = JSON.parse(fs.readFileSync(updateStatePath, "utf8"));
    updateRuntime = {
      ...updateRuntime,
      remindLaterUntil: Number(parsed.remindLaterUntil) || 0,
      latestVersion: typeof parsed.latestVersion === "string" ? parsed.latestVersion : null,
    };
  } catch (error) {
    console.warn("[NexusForge Desktop] Unable to read update state:", error);
  }
}

function readDesktopPreferences() {
  try {
    if (!fs.existsSync(desktopPreferencesPath)) {
      return;
    }
    const parsed = JSON.parse(fs.readFileSync(desktopPreferencesPath, "utf8"));
    desktopPreferences = {
      ...desktopPreferences,
      launchOnStartup:
        typeof parsed?.launchOnStartup === "boolean"
          ? parsed.launchOnStartup
          : desktopPreferences.launchOnStartup,
      minimizeToTray:
        typeof parsed?.minimizeToTray === "boolean"
          ? parsed.minimizeToTray
          : desktopPreferences.minimizeToTray,
      startMinimized:
        typeof parsed?.startMinimized === "boolean"
          ? parsed.startMinimized
          : desktopPreferences.startMinimized,
    };
  } catch (error) {
    console.warn("[NexusForge Desktop] Unable to read desktop preferences:", error);
  }
}

function persistDesktopPreferences() {
  try {
    fs.mkdirSync(path.dirname(desktopPreferencesPath), { recursive: true });
    fs.writeFileSync(desktopPreferencesPath, JSON.stringify(desktopPreferences, null, 2), "utf8");
  } catch (error) {
    console.warn("[NexusForge Desktop] Unable to persist desktop preferences:", error);
  }
}

function applyLaunchOnStartupPreference() {
  try {
    if (process.platform === "win32") {
      app.setLoginItemSettings({
        openAtLogin: Boolean(desktopPreferences.launchOnStartup),
        openAsHidden: Boolean(desktopPreferences.startMinimized),
        args: ["--startup"],
      });
      return;
    }

    if (process.platform === "darwin") {
      app.setLoginItemSettings({
        openAtLogin: Boolean(desktopPreferences.launchOnStartup),
        openAsHidden: Boolean(desktopPreferences.startMinimized),
      });
    }
  } catch (error) {
    console.warn("[NexusForge Desktop] Unable to apply launch-on-startup preference:", error);
  }
}

function readWindowState() {
  try {
    if (!fs.existsSync(windowStatePath)) {
      return null;
    }
    const parsed = JSON.parse(fs.readFileSync(windowStatePath, "utf8"));
    const width = Number(parsed?.width);
    const height = Number(parsed?.height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      return null;
    }

    return {
      width: Math.max(1100, Math.round(width)),
      height: Math.max(760, Math.round(height)),
      x: Number.isFinite(Number(parsed?.x)) ? Math.round(Number(parsed.x)) : undefined,
      y: Number.isFinite(Number(parsed?.y)) ? Math.round(Number(parsed.y)) : undefined,
      isMaximized: Boolean(parsed?.isMaximized),
    };
  } catch {
    return null;
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  try {
    const bounds = mainWindow.getBounds();
    const payload = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: mainWindow.isMaximized(),
    };
    fs.mkdirSync(path.dirname(windowStatePath), { recursive: true });
    fs.writeFileSync(windowStatePath, JSON.stringify(payload, null, 2), "utf8");
  } catch {
    // Best-effort persistence only.
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    void ensureAppReachable("tray-show");
    return;
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
}

function hideMainWindowToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (!mainWindow.isVisible()) {
    return;
  }

  mainWindow.hide();
  appendStartupLog("[tray] Main window hidden to system tray.");
}

function createAppTray() {
  if (appTray) {
    return;
  }

  try {
    appTray = new Tray(appIconPath);
    appTray.setToolTip("NexusForge Desktop");
    appTray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Open NexusForge",
          click: () => {
            showMainWindow();
          },
        },
        {
          type: "separator",
        },
        {
          label: "Quit",
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ]),
    );

    appTray.on("click", () => {
      if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) {
        showMainWindow();
        return;
      }

      if (mainWindow.isFocused()) {
        hideMainWindowToTray();
      } else {
        showMainWindow();
      }
    });
  } catch (error) {
    console.warn("[NexusForge Desktop] Unable to create tray icon:", error);
  }
}

function persistUpdateState() {
  try {
    fs.mkdirSync(path.dirname(updateStatePath), { recursive: true });
    fs.writeFileSync(
      updateStatePath,
      JSON.stringify(
        {
          remindLaterUntil: updateRuntime.remindLaterUntil,
          latestVersion: updateRuntime.latestVersion,
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch (error) {
    console.warn("[NexusForge Desktop] Unable to persist update state:", error);
  }
}

function emitUpdateRuntime() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("nexusforge-desktop:update-state", updateRuntime);
  }
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send("nexusforge-desktop:update-state", updateRuntime);
  }
}

function emitStartupRuntime() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send("nexusforge-desktop:startup-state", startupRuntime);
  }
}

function updateStartupRuntime(patch) {
  startupRuntime = {
    ...startupRuntime,
    ...patch,
    timestamp: new Date().toISOString(),
  };
  appendStartupLog(
    `[startup] stage="${startupRuntime.stage}" progress=${Number(startupRuntime.progress) || 0} accent=${startupRuntime.accent || "n/a"} detail="${startupRuntime.detail || ""}"`,
  );
  emitStartupRuntime();
}

function parseVersionSegments(version) {
  return String(version)
    .split(".")
    .map((segment) => Number.parseInt(segment, 10) || 0)
    .slice(0, 3);
}

function isVersionGreater(nextVersion, currentVersion) {
  const next = parseVersionSegments(nextVersion);
  const current = parseVersionSegments(currentVersion);
  const length = Math.max(next.length, current.length);

  for (let i = 0; i < length; i += 1) {
    const nextPart = next[i] ?? 0;
    const currentPart = current[i] ?? 0;
    if (nextPart > currentPart) return true;
    if (nextPart < currentPart) return false;
  }

  return false;
}

function sanitizeReleaseNotes(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

function snoozeUpdateReminder(delayMs = remindLaterDelayMs) {
  updateRuntime = {
    ...updateRuntime,
    remindLaterUntil: Date.now() + Math.max(0, Number(delayMs) || 0),
  };
  persistUpdateState();
  emitUpdateRuntime();
}

async function showChangelogWindow() {
  const notes = updateRuntime.notes.length
    ? updateRuntime.notes
    : ["Performance optimizations", "Stability improvements", "Quality-of-life updates"];
  const list = notes.map((note) => `<li>${note.replace(/[<>]/g, "")}</li>`).join("");
  const changelogWindow = new BrowserWindow({
    width: 760,
    height: 560,
    title: "NexusForge - What's New",
    autoHideMenuBar: true,
    backgroundColor: "#020617",
    icon: appIconPath,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>What's New</title>
  <style>
  :root{color-scheme:dark;--text:#e6edf7;--muted:#9fb3cc;--line:rgba(125,211,252,.24);--panel:rgba(13,20,36,.76);--accent:#f97316;--accent-strong:#fb923c}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;padding:24px;background:radial-gradient(circle at 12% 14%,rgba(249,115,22,.24),transparent 31%),radial-gradient(circle at 84% 16%,rgba(125,211,252,.2),transparent 35%),linear-gradient(145deg,#0b1220 0%,#131c2f 52%,#1f1234 100%);color:var(--text);font-family:Bahnschrift,"Segoe UI Variable","Trebuchet MS",sans-serif;display:grid;place-items:center}
  .panel{width:min(760px,100%);border:1px solid var(--line);border-radius:22px;background:linear-gradient(180deg,rgba(15,23,42,.86),rgba(15,23,42,.7)),var(--panel);padding:22px;box-shadow:0 24px 62px rgba(5,9,18,.56),inset 0 1px 0 rgba(255,255,255,.08)}
  .eyebrow{margin:0;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#7dd3fc}
  h1{margin:10px 0 8px;font-size:34px;line-height:.95;letter-spacing:-.02em}
  .meta{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
  .version-chip{padding:8px 12px;border-radius:999px;background:rgba(15,23,42,.7);border:1px solid rgba(148,163,184,.2);font-size:12px;color:#d8e5f7}
  .subtitle{margin:0;color:var(--muted);line-height:1.55}
  ul{margin:16px 0 0;padding-left:20px;display:grid;gap:10px}
  li{padding:10px 12px;border:1px solid rgba(148,163,184,.22);border-radius:10px;background:rgba(2,6,23,.52)}
  .footer{margin-top:18px;display:flex;justify-content:flex-end}
  .close-btn{border:0;border-radius:11px;padding:10px 14px;background:linear-gradient(135deg,var(--accent),var(--accent-strong));color:#1b1207;font-weight:700;cursor:pointer}
  .close-btn:hover{filter:saturate(1.07)}
  </style></head>
  <body><main class="panel"><p class="eyebrow">NexusForge Desktop Update</p><h1>What is New</h1>
  <div class="meta"><p class="subtitle">Review the latest desktop improvements before you continue.</p><span class="version-chip">Version ${String(updateRuntime.latestVersion || app.getVersion())}</span></div>
  <ul>${list}</ul><div class="footer"><button class="close-btn" onclick="window.close()">Close</button></div></main></body></html>`;
  await changelogWindow.loadURL(`data:text/html,${encodeURIComponent(html)}`);
}

async function showUpdateReadyDialog() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const result = await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "Desktop Update Ready",
    message: `NexusForge Desktop update is ready to install (v${updateRuntime.latestVersion || "latest"}).`,
    detail: "Restart now to apply this update, or continue using the current session and install later.",
    buttons: ["Restart To Install", "Install Later"],
    defaultId: 0,
    cancelId: 1,
  });

  if (result.response === 0) {
    await installDownloadedUpdate();
  }
}

function normalizeUpdateFilename(latestVersion, sourceUrl) {
  const parsedPath = sourceUrl ? path.basename(new URL(sourceUrl).pathname) : "";
  const filename = parsedPath && parsedPath.toLowerCase().endsWith(".exe") ? parsedPath : `NexusForge Desktop Setup ${latestVersion}.exe`;
  return filename.replace(/[^a-zA-Z0-9._\- ()]/g, "_");
}

async function computeSha256(filePath) {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function downloadUpdateInstaller(downloadUrl, latestVersion) {
  fs.mkdirSync(updateDownloadDir, { recursive: true });
  const installerName = normalizeUpdateFilename(latestVersion, downloadUrl);
  const destinationPath = path.join(updateDownloadDir, installerName);
  const tempPath = `${destinationPath}.download`;

  const response = await fetchWithTimeout(downloadUrl, { cache: "no-store" }, 10000);
  if (!response.ok || !response.body) {
    throw new Error(`Installer download failed (${response.status}).`);
  }

  const totalBytes = Number.parseInt(response.headers.get("content-length") || "0", 10) || 0;
  const reader = response.body.getReader();
  const fileHandle = fs.openSync(tempPath, "w");
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        fs.writeSync(fileHandle, value);
        receivedBytes += value.length;
        const downloadPercent = totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : 0;
        updateRuntime = {
          ...updateRuntime,
          downloadPercent,
        };
        emitUpdateRuntime();
      }
    }
  } finally {
    fs.closeSync(fileHandle);
  }

  fs.renameSync(tempPath, destinationPath);
  return destinationPath;
}

function normalizeDownloadCandidates(primaryUrl, secondaryUrls) {
  const candidates = [primaryUrl, ...(Array.isArray(secondaryUrls) ? secondaryUrls : [])]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return Array.from(new Set(candidates));
}

function resolveManifestUrlCandidate(candidateUrl, manifestUrl) {
  const raw = String(candidateUrl || "").trim();
  if (!raw) {
    return null;
  }

  try {
    return new URL(raw, manifestUrl).toString();
  } catch {
    return null;
  }
}

async function verifyInstallerIntegrity(installerPath, expectedSha256) {
  if (!expectedSha256) {
    return true;
  }
  const actual = await computeSha256(installerPath);
  return actual.toLowerCase() === String(expectedSha256).toLowerCase();
}

async function installDownloadedUpdate() {
  if (installInProgress) {
    return;
  }

  const installerPath = updateRuntime.installerPath;
  const installerMatchesLatest =
    Boolean(updateRuntime.latestVersion) &&
    Boolean(updateRuntime.downloadedVersion) &&
    updateRuntime.latestVersion === updateRuntime.downloadedVersion;
  if (!installerPath || !fs.existsSync(installerPath)) {
    throw new Error("Downloaded installer is unavailable.");
  }
  if (!installerMatchesLatest) {
    throw new Error("Downloaded installer does not match the latest available version.");
  }

  installInProgress = true;

  const launchArgs = process.platform === "win32" ? ["/S"] : [];
  const child = spawn(installerPath, launchArgs, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();

  setTimeout(() => {
    app.quit();
  }, 150);
}

function canAutoInstallOnClose() {
  const installerMatchesLatest =
    Boolean(updateRuntime.latestVersion) &&
    Boolean(updateRuntime.downloadedVersion) &&
    updateRuntime.latestVersion === updateRuntime.downloadedVersion;

  return (
    !skipAutoInstallOnQuit &&
    autoInstallOnClose &&
    process.platform === "win32" &&
    updateRuntime.downloaded &&
    installerMatchesLatest &&
    Boolean(updateRuntime.installerPath) &&
    fs.existsSync(updateRuntime.installerPath)
  );
}

async function beginBackgroundUpdateDownload(forceInstallAfterDownload = false) {
  if (updateRuntime.downloading) {
    return;
  }

  const hasCurrentInstaller =
    updateRuntime.downloaded &&
    updateRuntime.downloadedVersion &&
    updateRuntime.latestVersion &&
    updateRuntime.downloadedVersion === updateRuntime.latestVersion &&
    Boolean(updateRuntime.installerPath) &&
    fs.existsSync(updateRuntime.installerPath);

  if (hasCurrentInstaller) {
    if (forceInstallAfterDownload || updateRuntime.forceRequired) {
      await installDownloadedUpdate();
    }
    return;
  }

  if (updateRuntime.downloaded && !hasCurrentInstaller) {
    updateRuntime = {
      ...updateRuntime,
      downloaded: false,
      downloadedVersion: null,
      downloadPercent: 0,
      installerPath: null,
    };
  }

  if (!updateRuntime.downloadUrl || !updateRuntime.latestVersion) {
    updateRuntime = {
      ...updateRuntime,
      lastError: "Update metadata is incomplete. Please check again shortly.",
    };
    emitUpdateRuntime();
    return;
  }

  updateRuntime = {
    ...updateRuntime,
    downloading: true,
    downloadPercent: 0,
    lastError: null,
  };
  emitUpdateRuntime();

  try {
    const candidateUrls = normalizeDownloadCandidates(updateRuntime.downloadUrl, updateRuntime.downloadUrls);
    if (!candidateUrls.length) {
      throw new Error("No update download URL is available in the update manifest.");
    }

    let installerPath = null;
    let lastDownloadError = null;
    for (const candidateUrl of candidateUrls) {
      try {
        installerPath = await downloadUpdateInstaller(candidateUrl, updateRuntime.latestVersion);
        break;
      } catch (error) {
        lastDownloadError = error;
      }
    }

    if (!installerPath) {
      throw lastDownloadError || new Error("Unable to download installer from any configured URL.");
    }

    const integrityOk = await verifyInstallerIntegrity(installerPath, updateRuntime.sha256);
    if (!integrityOk) {
      fs.rmSync(installerPath, { force: true });
      throw new Error("Downloaded update failed integrity verification.");
    }

    updateRuntime = {
      ...updateRuntime,
      downloading: false,
      downloaded: true,
      downloadedVersion: updateRuntime.latestVersion,
      downloadPercent: 100,
      installerPath,
    };
    emitUpdateRuntime();
    if (forceInstallAfterDownload || updateRuntime.forceRequired) {
      await installDownloadedUpdate();
      return;
    }
    await showUpdateReadyDialog();
  } catch (error) {
    updateRuntime = {
      ...updateRuntime,
      downloading: false,
      downloaded: false,
      downloadedVersion: null,
      downloadPercent: 0,
      installerPath: null,
      lastError: `Background update failed: ${String(error)}`,
    };
    emitUpdateRuntime();
  }
}

async function showUpdateAvailableDialog() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const result = await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "Desktop Update Available",
    message: `A NexusForge Desktop update is available (v${updateRuntime.latestVersion || "latest"}).`,
    detail: "Choose how to proceed. You can review changes, start the background download, or postpone this reminder.",
    buttons: ["Start Background Download", "Remind Me Later", "View What Is New"],
    defaultId: 0,
    cancelId: 1,
  });

  if (result.response === 0) {
    await beginBackgroundUpdateDownload();
    return;
  }

  if (result.response === 1) {
    snoozeUpdateReminder();
    return;
  }

  await showChangelogWindow();
  snoozeUpdateReminder(viewChangesSnoozeDelayMs);
}

async function checkForUpdates(trigger = "manual") {
  if (!updateManifestUrl) {
    return updateRuntime;
  }

  if (updateRuntime.checking) {
    return updateRuntime;
  }

  updateRuntime = {
    ...updateRuntime,
    checking: true,
    lastError: null,
  };
  emitUpdateRuntime();

  try {
    const response = await fetchWithTimeout(updateManifestUrl, { cache: "no-store" }, 10000);
    if (!response.ok) {
      throw new Error(`Update manifest request failed (${response.status}).`);
    }

    const payload = await response.json();
    const latestVersion = String(payload?.version || "").trim();
    const notes = sanitizeReleaseNotes(payload?.notes);
    const downloadUrl = resolveManifestUrlCandidate(payload?.downloadUrl, updateManifestUrl);
    const downloadUrls = Array.isArray(payload?.downloadUrls)
      ? payload.downloadUrls
          .map((value) => resolveManifestUrlCandidate(value, updateManifestUrl))
          .filter(Boolean)
      : [];
    const sha256 = typeof payload?.sha256 === "string" ? payload.sha256.trim() : null;
    const hasUpdate = Boolean(latestVersion) && isVersionGreater(latestVersion, app.getVersion());
    const payloadForceUpdate =
      payload?.forceUpdate === true ||
      payload?.required === true ||
      payload?.mandatory === true ||
      payload?.forceRequired === true;
    const forceRequired = hasUpdate && (payloadForceUpdate || forceUpdateByDefault);
    const sameAvailableVersion = hasUpdate && updateRuntime.latestVersion === latestVersion;

    const promptPending = trigger === "startup" && hasUpdate && !forceRequired;
    updateRuntime = {
      ...updateRuntime,
      checking: false,
      available: hasUpdate,
      forceRequired,
      latestVersion: hasUpdate ? latestVersion : null,
      notes,
      downloadUrl,
      downloadUrls,
      sha256,
      downloaded: hasUpdate ? (sameAvailableVersion ? updateRuntime.downloaded : false) : false,
      downloadedVersion: hasUpdate ? (sameAvailableVersion ? updateRuntime.downloadedVersion : null) : null,
      downloadPercent: hasUpdate ? (sameAvailableVersion ? updateRuntime.downloadPercent : 0) : 0,
      installerPath: hasUpdate ? (sameAvailableVersion ? updateRuntime.installerPath : null) : null,
      updatePromptPending: promptPending,
      lastCheckedAt: new Date().toISOString(),
      lastError: null,
    };
    if (promptPending && !startupUpdatePromptPromise) {
      createStartupUpdatePromptPromise();
    }
    emitUpdateRuntime();

    if (hasUpdate && !updateRuntime.downloading && !updateRuntime.downloaded) {
      if (forceRequired || trigger !== "startup") {
        void beginBackgroundUpdateDownload(forceRequired);
      }
    }

    if (
      hasUpdate &&
      forceRequired &&
      updateRuntime.downloaded &&
      updateRuntime.downloadedVersion === updateRuntime.latestVersion
    ) {
      await installDownloadedUpdate();
      return updateRuntime;
    }

    if (
      hasUpdate &&
      !forceRequired &&
      (updateRuntime.remindLaterUntil || 0) <= Date.now() &&
      trigger !== "silent" &&
      trigger !== "startup"
    ) {
      await showUpdateAvailableDialog();
    }
  } catch (error) {
    updateRuntime = {
      ...updateRuntime,
      checking: false,
      updatePromptPending: false,
      lastCheckedAt: new Date().toISOString(),
      lastError: `Update check failed: ${String(error)}`,
    };
    emitUpdateRuntime();
  } finally {
    if (trigger === "startup") {
      startupUpdateCheckPromise = null;
    }
  }

  return updateRuntime;
}

function createSplashWindow() {
  markStartupTiming("splash-window-create");
  const { workArea } = screen.getPrimaryDisplay();
  splashWindow = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    frame: false,
    show: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: true,
    fullscreen: true,
    backgroundColor: "#020617",
    icon: appIconPath,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  void splashWindow.loadFile(splashPath);
  splashWindow.webContents.once("did-finish-load", () => {
    markStartupTiming("splash-did-finish-load");
    emitStartupRuntime();
    emitUpdateRuntime();
  });
  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}

async function revealMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (startupUpdateCheckPromise) {
    await Promise.race([startupUpdateCheckPromise, wait(startupUpdateCheckHoldMs)]);
  }

  if (startupUpdatePromptPromise) {
    await Promise.race([startupUpdatePromptPromise, wait(startupUpdatePromptTimeoutMs)]);
  }

  if (shouldStartHiddenOnLaunch) {
    if (startupRevealTimer) {
      clearTimeout(startupRevealTimer);
      startupRevealTimer = null;
    }
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      markStartupTiming("splash-window-close-hidden-start");
    }
    markStartupTiming("startup-hidden-on-launch");
    return;
  }

  if (startupRevealTimer) {
    clearTimeout(startupRevealTimer);
    startupRevealTimer = null;
  }

  startupRevealTimer = setTimeout(() => {
    markStartupTiming("handoff-reveal-fire", "from-splash-to-main");
    updateStartupRuntime({
      stage: "Opening NexusForge Desktop",
      detail: "The workspace is ready. Bringing the app forward.",
      progress: 100,
      accent: "ready",
    });
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      const savedState = readWindowState();
      if (savedState?.isMaximized) {
        mainWindow.maximize();
      }
      mainWindow.show();
      mainWindow.focus();
      markStartupTiming("main-window-show");
    }
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      markStartupTiming("splash-window-close");
    }
    markStartupTiming("startup-handoff-complete");
  }, startupSplashHoldMs);
  markStartupTiming("handoff-reveal-scheduled", `hold=${startupSplashHoldMs}ms`, false);
}

function isWorkspaceRoot(candidatePath) {
  if (!candidatePath) {
    return false;
  }

  const packageJsonPath = path.join(candidatePath, "package.json");
  const hasServer = fs.existsSync(path.join(candidatePath, "apps", "server"));
  const hasWeb = fs.existsSync(path.join(candidatePath, "apps", "web"));
  return fs.existsSync(packageJsonPath) && hasServer && hasWeb;
}

function getDiscoveredWorkspaceCandidates() {
  const discovered = [];
  const cwdWorkspace = path.resolve(process.cwd());
  const executableDir = path.dirname(process.execPath);

  const seedPaths = [
    cwdWorkspace,
    __dirname,
    executableDir,
    path.resolve(cwdWorkspace, ".."),
    path.resolve(cwdWorkspace, "..", ".."),
    path.resolve(__dirname, ".."),
    path.resolve(__dirname, "..", ".."),
    path.resolve(executableDir, ".."),
    path.resolve(executableDir, "..", ".."),
    path.resolve(executableDir, "..", "..", ".."),
    path.resolve(executableDir, "..", "..", "..", ".."),
  ];

  for (const seed of seedPaths) {
    if (!seed) {
      continue;
    }
    discovered.push(seed);
    discovered.push(path.resolve(seed, ".."));
    discovered.push(path.resolve(seed, "..", ".."));
  }

  // Last-resort scan on the current drive for likely NexusForge workspace folders.
  const driveRoot = path.parse(cwdWorkspace).root || "";
  if (driveRoot && fs.existsSync(driveRoot)) {
    try {
      const entries = fs.readdirSync(driveRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        if (!/nexusforge/i.test(entry.name)) {
          continue;
        }
        discovered.push(path.join(driveRoot, entry.name));
      }
    } catch {
      // Best-effort discovery only.
    }
  }

  return discovered;
}

function resolveWorkspacePath() {
  if (localStackStatus.workspacePath && isWorkspaceRoot(localStackStatus.workspacePath)) {
    return localStackStatus.workspacePath;
  }

  const envWorkspace = process.env.NEXUSFORGE_WORKSPACE_PATH;
  const defaultWorkspace = path.resolve(__dirname, "..", "..");
  const candidates = [envWorkspace, defaultWorkspace, ...getDiscoveredWorkspaceCandidates()].filter(Boolean);
  const seen = new Set();
  for (const candidate of candidates) {
    const normalizedCandidate = path.resolve(String(candidate));
    const dedupeKey = process.platform === "win32" ? normalizedCandidate.toLowerCase() : normalizedCandidate;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    if (isWorkspaceRoot(normalizedCandidate)) {
      updateLocalStackStatus({ workspacePath: normalizedCandidate });
      return normalizedCandidate;
    }
  }

  return null;
}

function parseEnvFile(filePath) {
  try {
    const contents = fs.readFileSync(filePath, "utf8");
    return contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .reduce((env, line) => {
        const match = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
        if (!match) {
          return env;
        }

        const key = match[1];
        let value = match[2] || "";
        if (/^'.*'$/.test(value) || /^".*"$/.test(value)) {
          value = value.slice(1, -1);
        }
        env[key] = value;
        return env;
      }, {});
  } catch {
    return {};
  }
}

function resolveLocalApiPortCandidates(workspacePath) {
  const candidates = [];
  if (workspacePath) {
    const envPath = path.join(workspacePath, "apps", "server", ".env");
    const envValues = parseEnvFile(envPath);
    const portValue = Number.parseInt(String(envValues.PORT || "").trim(), 10);
    if (Number.isFinite(portValue) && portValue > 0 && portValue < 65536) {
      candidates.push(portValue);
    }
  }

  for (const fallbackPort of [4000, 4001]) {
    if (!candidates.includes(fallbackPort)) {
      candidates.push(fallbackPort);
    }
  }

  return candidates;
}

function probePort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finalize = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(800);
    socket.once("connect", () => finalize(true));
    socket.once("error", () => finalize(false));
    socket.once("timeout", () => finalize(false));
    socket.connect(port, "127.0.0.1");
  });
}

async function probeApiHealth(port) {
  try {
    const url = `http://127.0.0.1:${port}/api/health`;
    const response = await fetchWithTimeout(url, { method: "GET", cache: "no-store", redirect: "manual" }, 1200);
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

async function refreshLocalPortStatus() {
  const workspacePath = localStackStatus.workspacePath || resolveWorkspacePath();
  const apiPortCandidates = resolveLocalApiPortCandidates(workspacePath);
  const apiPortLabel = apiPortCandidates.join(", ");

  updateStartupRuntime({
    stage: "Checking local services",
    detail: `Verifying the app stack is reachable on ports 3000 and ${apiPortLabel}.`,
    progress: 34,
    accent: "checking",
  });

  const [port3000Open, ...apiHealthResults] = await Promise.all([
    probePort(3000),
    ...apiPortCandidates.map((port) => probeApiHealth(port)),
  ]);

  const [port4000Bound, port4001Bound] = await Promise.all([
    probePort(4000),
    probePort(4001),
  ]);

  const port4000Healthy = apiPortCandidates.includes(4000)
    ? apiHealthResults[apiPortCandidates.indexOf(4000)]
    : false;
  const port4001Healthy = apiPortCandidates.includes(4001)
    ? apiHealthResults[apiPortCandidates.indexOf(4001)]
    : false;
  const port4000Open = port4000Healthy;
  const port4001Open = port4001Healthy;
  const portApiOpen = apiHealthResults.some(Boolean);
  const preferredApiPort = apiPortCandidates[0] || 4000;

  updateLocalStackStatus({
    port3000Open,
    port4000Open,
    port4001Open,
    port4000Bound,
    port4001Bound,
    portApiOpen,
    apiPortCandidates,
    preferredApiPort,
  });

  updateStartupRuntime({
    stage: port3000Open && portApiOpen ? "Local services ready" : "Preparing recovery path",
    detail: port3000Open && portApiOpen ? "The desktop stack answered on the expected ports." : "Waiting on the local stack to finish coming online.",
    progress: port3000Open && portApiOpen ? 66 : 46,
    accent: port3000Open && portApiOpen ? "ready" : "checking",
  });

  return { port3000Open, port4000Open, port4001Open, port4000Bound, port4001Bound, portApiOpen, apiPortCandidates, preferredApiPort };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createStartupUpdatePromptPromise() {
  if (startupUpdatePromptPromise) {
    return startupUpdatePromptPromise;
  }

  startupUpdatePromptPromise = new Promise((resolve) => {
    startupUpdatePromptResolver = resolve;
  });

  return startupUpdatePromptPromise;
}

function resolveStartupUpdatePrompt(choice) {
  if (!startupUpdatePromptResolver) {
    return;
  }

  startupUpdatePromptResolver(String(choice || "skip"));
  startupUpdatePromptResolver = null;
  startupUpdatePromptPromise = null;

  updateRuntime = {
    ...updateRuntime,
    updatePromptPending: false,
  };
  emitUpdateRuntime();
}

function isTransientLoadError(error) {
  const detail = String(error || "");
  return /ERR_CONNECTION_RESET|ERR_CONNECTION_REFUSED|ERR_CONNECTION_ABORTED|ERR_ABORTED|ERR_TIMED_OUT|ERR_NETWORK_CHANGED/i.test(
    detail,
  );
}

async function loadMainWindowUrlWithRetry(url, options = {}) {
  const attempts = Number(options.attempts || 1);
  const delayMs = Number(options.delayMs || 700);
  const probeTimeoutMs = Number(options.probeTimeoutMs || 5000);

  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error("Main window is unavailable during URL load.");
    }

    try {
      if (url.startsWith("http://") || url.startsWith("https://")) {
        const reachable = await waitForUrlReachable(url, {
          timeoutMs: probeTimeoutMs,
          intervalMs: 500,
        });
        if (!reachable) {
          throw new Error(`URL not reachable or returned bad status: ${url}`);
        }
      }

      await mainWindow.loadURL(url);
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isTransientLoadError(error)) {
        throw error;
      }
      await wait(delayMs);
    }
  }

  throw lastError || new Error("Main window URL load failed.");
}

async function waitForUrlReachable(url, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 15000);
  const intervalMs = Number(options.intervalMs || 500);
  const startedAt = Date.now();

  const agent = (() => {
    try {
      const parsed = new URL(url);
      if (allowHostedCertBypass && parsed.protocol === "https:" && /(^|\.)nexusforge\.app$/i.test(parsed.hostname)) {
        return new https.Agent({ rejectUnauthorized: false });
      }
    } catch {
      // Ignore malformed URL.
    }
    return undefined;
  })();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        agent,
      });

      if (response.status >= 200 && response.status < 400) {
        return true;
      }
    } catch {
      // Probe retries until timeout.
    }

    await wait(intervalMs);
  }

  return false;
}

function resolveHostedStartTargets() {
  const candidates = [
    startUrl,
    configuredDesktopUrl,
    configuredStartUrl !== startUrl ? configuredStartUrl : null,
    packagedHostedFallbackUrl,
    "https://www.nexusforge.app/app",
    "https://www.nexusforge.app",
    "https://www.nexusforge.app/download.html",
    "https://nexusforge.app/app",
    "https://nexusforge.app",
    "https://nexusforge.app/download.html",
    "https://trhpruductions.github.io/-NEXUSFORGE/download.html",
    "https://trhpruductions.github.io/-NEXUSFORGE",
  ];

  const appendOriginTargets = (value) => {
    try {
      const origin = new URL(value).origin;
      candidates.push(`${origin}/app`, origin);
    } catch {
      // Ignore malformed target values.
    }
  };

  appendOriginTargets(startUrl);
  appendOriginTargets(packagedHostedFallbackUrl);
  if (configuredDownloadPageUrl) {
    candidates.push(configuredDownloadPageUrl);
    appendOriginTargets(configuredDownloadPageUrl);
  }

  try {
    const manifestOrigin = new URL(updateManifestUrl).origin;
    candidates.push(`${manifestOrigin}/app`);
    candidates.push(manifestOrigin);
    candidates.push(`${manifestOrigin}/download.html`);
  } catch {
    // Ignore malformed manifest URLs in target resolution.
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function resolveHostedRecoveryTargets() {
  const recoveryTargets = [
    ...resolveHostedStartTargets(),
    "https://www.nexusforge.app/login?redirect=/app",
    "https://nexusforge.app/login?redirect=/app",
    "https://www.nexusforge.app/download.html",
    "https://trhpruductions.github.io/-NEXUSFORGE/download.html",
  ];

  return Array.from(new Set(recoveryTargets.filter(Boolean)));
}

function isTrustedHostedDomain(candidateUrl) {
  try {
    const { hostname } = new URL(candidateUrl);
    return /(^|\.)nexusforge\.app$/i.test(hostname);
  } catch {
    return false;
  }
}

async function waitForLocalStackReady(timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const { port3000Open, port4000Open, port4001Open, portApiOpen } = await refreshLocalPortStatus();
    if (port3000Open && portApiOpen) {
      const appReady = await waitForUrlReachable(localStartUrl, {
        timeoutMs: Math.min(6000, timeoutMs - (Date.now() - startedAt)),
        intervalMs: 500,
      });
      if (appReady) {
        return true;
      }
    }
    await wait(startupProbeDelayMs);
  }
  return false;
}

async function tryLocalFallbackFromHosted() {
  const port3000Open = await probePort(3000);
  if (!port3000Open) {
    return false;
  }

  const reachable = await waitForUrlReachable(localStartUrl, {
    timeoutMs: 7000,
    intervalMs: 500,
  });
  if (!reachable) {
    return false;
  }

  await loadMainWindowUrlWithRetry(localStartUrl, { attempts: 3, delayMs: 700 });
  markStartupTiming("hosted-fallback-local-connected", `target=${localStartUrl}`, false);
  revealMainWindow();
  updateLocalStackStatus({
    launchMode: "local-dev",
    startUrl: localStartUrl,
    message: "Hosted target was unreachable. Desktop switched to local services.",
    lastError: null,
    running: true,
    port3000Open: true,
  });
  updateStartupRuntime({
    launchMode: "local-dev",
  });
  appendLocalStackHistory("Hosted load failed; recovered by loading local target.");
  return true;
}

async function tryHostedFallbackFromLocal() {
  const hostedTargets = resolveHostedStartTargets();
  let connectedTarget = null;
  let lastError = null;

  for (const target of hostedTargets) {
    if (isLocalHostTarget(target)) {
      continue;
    }

    try {
      await loadMainWindowUrlWithRetry(target, { attempts: 3, delayMs: 800 });
      connectedTarget = target;
      markStartupTiming("local-fallback-hosted-connected", `target=${target}`, false);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!connectedTarget) {
    if (lastError) {
      appendStartupLog(`[recovery] Local->hosted fallback failed: ${String(lastError)}`);
    }
    return false;
  }

  revealMainWindow();
  updateLocalStackStatus({
    launchMode: "hosted",
    startUrl: connectedTarget,
    message: `Local services unavailable. Desktop switched to hosted services (${connectedTarget}).`,
    lastError: null,
    running: false,
    port3000Open: false,
    port4000Open: false,
  });
  updateStartupRuntime({
    launchMode: "hosted",
  });
  appendLocalStackHistory(`Local load failed; recovered by loading hosted target: ${connectedTarget}`);
  return true;
}

function isDestroyedWindowError(error) {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  const detail = `${message} ${String(error || "")}`;
  return /object has been destroyed/i.test(detail) || /ERR_INVALID_STATE/i.test(detail);
}

function loadFallbackPage(message) {
  updateLocalStackStatus({ message });
  appendLocalStackHistory(message);
  appendStartupLog(`[fallback] ${message}`);

  const targetWindow = mainWindow;
  if (!targetWindow || targetWindow.isDestroyed()) {
    return;
  }

  if (!fs.existsSync(fallbackPath)) {
    console.warn("[NexusForge Desktop] Fallback file missing:", fallbackPath);
    return;
  }

  try {
    void targetWindow.loadFile(fallbackPath).catch((error) => {
      if (!isDestroyedWindowError(error)) {
        console.warn("[NexusForge Desktop] Unable to load fallback page:", error);
      }
    });
  } catch (error) {
    if (!isDestroyedWindowError(error)) {
      console.warn("[NexusForge Desktop] Fallback load aborted because window was destroyed:", error);
    }
    return;
  }

  if (!targetWindow.isDestroyed()) {
    revealMainWindow();
  }
}

async function startLocalStack(reason) {
  updateStartupRuntime({
    stage: "Starting local services",
    detail: "Launching the workspace recovery process.",
    progress: 48,
    accent: "starting",
  });
  const workspacePath = resolveWorkspacePath();
  if (!workspacePath) {
    const message = "Local workspace was not found for desktop recovery.";
    try {
      fs.mkdirSync(path.dirname(localStackLogPath), { recursive: true });
      fs.appendFileSync(
        localStackLogPath,
        `\n===== ${new Date().toISOString()} [${reason}] =====\n${message}\n` +
          `cwd=${process.cwd()}\nexecPath=${process.execPath}\n`,
      );
    } catch {
      // Best-effort logging only.
    }
    updateLocalStackStatus({
      attempted: true,
      started: false,
      running: false,
      lastError: message,
      message,
    });
    appendLocalStackHistory(message);
    return localStackStatus;
  }

  const existingPorts = await refreshLocalPortStatus();
  const apiAlreadyRunning = existingPorts.port4000Open || existingPorts.port4001Open;
  const apiConflict = existingPorts.port4000Open === false && existingPorts.port4000Bound && !existingPorts.port4001Open;
  if (apiConflict) {
    const message = "Local API port 4000 is occupied by a non-NexusForge process and cannot be used. Close the conflicting process or disable the port 4000 listener and retry.";
    updateLocalStackStatus({
      attempted: true,
      started: false,
      running: false,
      lastError: message,
      message,
    });
    appendLocalStackHistory(message);
    return localStackStatus;
  }

  if (existingPorts.port3000Open && apiAlreadyRunning) {
    updateLocalStackStatus({
      attempted: true,
      started: false,
      running: true,
      message: `Local stack is already running on ports 3000 and ${existingPorts.port4000Open ? 4000 : 4001}.`,
      lastError: null,
    });
    appendLocalStackHistory("Stack already running; launch command skipped.");
    return localStackStatus;
  }

  if (localStackProcess && !localStackProcess.killed) {
    updateLocalStackStatus({
      attempted: true,
      started: true,
      running: true,
      message: "Local stack process is already active.",
      lastError: null,
    });
    return localStackStatus;
  }

  try {
    fs.mkdirSync(path.dirname(localStackLogPath), { recursive: true });
  } catch (error) {
    console.warn("[NexusForge Desktop] Unable to create log directory:", error);
  }

  const logStream = fs.createWriteStream(localStackLogPath, { flags: "a" });
  logStream.write(`\n===== ${new Date().toISOString()} [${reason}] =====\n`);

  const npmExecPath = String(process.env.npm_execpath || "").trim();
  const isWin = process.platform === "win32";
  let spawnCommand;
  let spawnArgs;

  if (isWin) {
    if (npmExecPath && (npmExecPath.toLowerCase().endsWith(".js") || npmExecPath.toLowerCase().endsWith(".mjs"))) {
      spawnCommand = process.execPath;
      spawnArgs = [npmExecPath, "run", "dev"];
    } else {
      spawnCommand = "npm.cmd";
      spawnArgs = ["run", "dev"];
    }
  } else {
    spawnCommand = "npm";
    spawnArgs = ["run", "dev"];
    if (npmExecPath && !npmExecPath.toLowerCase().endsWith(".js") && !npmExecPath.toLowerCase().endsWith(".mjs")) {
      spawnCommand = npmExecPath;
    }
  }

  const apiPortCandidates = resolveLocalApiPortCandidates(workspacePath);
  logStream.write(
    `workspace=${workspacePath}\ncommand=${spawnCommand} ${spawnArgs.join(" ")}\nnpm_execpath=${npmExecPath || "(none)"}\nprocess.execPath=${process.execPath}\ncomspec=${process.env.ComSpec || "(none)"}\nshell=${isWin}\napiPortCandidates=${apiPortCandidates.join(",")}\n`,
  );

  const workspaceBinPath = path.join(workspacePath, "node_modules", ".bin");
  const spawnEnv = {
    ...process.env,
    PATH: [workspaceBinPath, process.env.PATH || ""].filter(Boolean).join(path.delimiter),
    NEXUSFORGE_DESKTOP_BOOTSTRAPPED: "true",
  };

  const child = spawn(spawnCommand, spawnArgs, {
    cwd: workspacePath,
    windowsHide: true,
    shell: false,
    env: spawnEnv,
  });

  localStackProcess = child;
  updateLocalStackStatus({
    attempted: true,
    started: true,
    running: true,
    processPid: child.pid ?? null,
    lastError: null,
    message: `Local stack startup command launched. Waiting for ports 3000 and ${apiPortCandidates.join("/")}.`,
    workspacePath,
    apiPortCandidates,
    preferredApiPort: apiPortCandidates[0] ?? 4000,
  });
  appendLocalStackHistory(`Started local stack process (PID ${child.pid ?? "n/a"}).`);

  child.stdout.on("data", (chunk) => {
    logStream.write(chunk.toString());
  });
  child.stderr.on("data", (chunk) => {
    logStream.write(chunk.toString());
  });

  child.on("exit", (code) => {
    const message = `Local stack process exited with code ${code ?? "unknown"}.`;
    updateLocalStackStatus({
      started: false,
      running: false,
      processPid: null,
      message,
      lastError: code === 0 ? null : message,
    });
    appendLocalStackHistory(message);
    logStream.write(`\n${message}\n`);
    logStream.end();
    localStackProcess = null;
  });

  child.on("error", (error) => {
    const message = `Local stack failed to spawn: ${String(error)}`;
    updateLocalStackStatus({
      started: false,
      running: false,
      processPid: null,
      message,
      lastError: message,
    });
    appendLocalStackHistory(message);
    logStream.write(`\n${message}\n`);
    logStream.end();
    localStackProcess = null;
  });

  void (async () => {
    try {
      const ready = await waitForLocalStackReady(localStartUrlProbeTimeoutMs);
      if (ready) {
        appendLocalStackHistory("Local stack became available; retrying desktop connection automatically.");
        await ensureAppReachable("auto-retry-after-local-stack-start");
      }
    } catch (error) {
      appendLocalStackHistory(`Local stack readiness monitor failed: ${String(error)}`);
    }
  })();

  return localStackStatus;
}

async function ensureAppReachable(trigger) {
  markStartupTiming("ensure-app-reachable-start", `trigger=${trigger}`, false);
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  async function tryHostedLoginFallback() {
    const recoveryTargets = resolveHostedRecoveryTargets();
    let connectedTarget = null;
    let lastError = null;

    for (const target of recoveryTargets) {
      try {
        await loadMainWindowUrlWithRetry(target, { attempts: 3, delayMs: 900 });
        connectedTarget = target;
        markStartupTiming("hosted-login-fallback-connected", `target=${target}`, false);
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!connectedTarget) {
      if (lastError) {
        appendStartupLog(`[recovery] Hosted login fallback failed: ${String(lastError)}`);
      }
      return false;
    }

    revealMainWindow();
    updateLocalStackStatus({
      launchMode: "hosted",
      startUrl: connectedTarget,
      message: `Desktop is connected to hosted services via recovery target (${connectedTarget}).`,
      lastError: null,
    });
    updateStartupRuntime({ launchMode: "hosted" });
    appendLocalStackHistory(`Desktop connected to hosted recovery target: ${connectedTarget}`);
    return true;
  }

  if (!isLocalStartTarget) {
    updateStartupRuntime({
      stage: "Connecting hosted workspace",
      detail: "Opening the remote NexusForge experience.",
      progress: 78,
      accent: "opening",
    });
    try {
      const hostedTargets = resolveHostedStartTargets();
      let connectedTarget = null;
      let lastError = null;

      for (const target of hostedTargets) {
        try {
          await loadMainWindowUrlWithRetry(target, { attempts: 4, delayMs: 900 });
          connectedTarget = target;
          markStartupTiming("hosted-target-connected", `target=${target}`, false);
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!connectedTarget) {
        throw lastError || new Error("No hosted start target could be loaded.");
      }

      revealMainWindow();
      updateLocalStackStatus({
        launchMode: "hosted",
        startUrl: connectedTarget,
        message: `Desktop is connected to hosted services (${connectedTarget}).`,
        lastError: null,
      });
      updateStartupRuntime({
        launchMode: "hosted",
      });
      appendLocalStackHistory(`Desktop connected to hosted target: ${connectedTarget}`);
    } catch (error) {
      const message = `Hosted target unreachable: ${String(error)}`;
      updateLocalStackStatus({
        lastError: message,
        message,
      });

      updateStartupRuntime({
        stage: "Hosted target unavailable",
        detail: "Attempting local fallback before showing recovery options.",
        progress: 60,
        accent: "checking",
      });

      try {
        const recoveredLocally = await tryLocalFallbackFromHosted();
        if (recoveredLocally) {
          return;
        }
      } catch (fallbackError) {
        appendStartupLog(`[recovery] Hosted->local fallback failed: ${String(fallbackError)}`);
      }

      try {
        const recoveredHosted = await tryHostedLoginFallback();
        if (recoveredHosted) {
          return;
        }
      } catch (recoveryError) {
        appendStartupLog(`[recovery] Hosted login fallback failed: ${String(recoveryError)}`);
      }

      loadFallbackPage(
        "Hosted app is unreachable. Retry in a moment, set NEXUSFORGE_DESKTOP_URL to a live target such as https://www.nexusforge.app/app, or start local services on http://127.0.0.1:3000/app. If the public production host is not yet published, use your available beta or tunnel URL.",
      );
    }
    return;
  }

  updateStartupRuntime({
    stage: "Opening app",
    detail: "Connecting the desktop shell to NexusForge.",
    progress: 78,
    accent: "opening",
  });

  if (bootRecoveryInFlight) {
    return;
  }

  bootRecoveryInFlight = true;
  try {
    const ports = await refreshLocalPortStatus();
    if (!ports.port3000Open || !ports.portApiOpen) {
      if (localStackStatus.autoStartEnabled && !localStackStatus.running) {
        appendLocalStackHistory("Local services are offline at startup; attempting automatic stack launch.");
        await startLocalStack("auto-startup");
        const ready = await waitForLocalStackReady(localStartUrlProbeTimeoutMs);
        if (ready) {
          await loadMainWindowUrlWithRetry(startUrl, { attempts: 6, delayMs: 900 });
          markStartupTiming("local-target-connected", `target=${startUrl}`, false);
          revealMainWindow();
          updateLocalStackStatus({
            launchMode: "local-dev",
            startUrl,
            message: "Desktop is connected to local services.",
            lastError: null,
            running: true,
          });
          updateStartupRuntime({
            launchMode: "local-dev",
          });
          appendLocalStackHistory("Desktop reconnected to local services after auto-starting the local stack.");
          return;
        }
      }

      try {
        const recoveredHosted = await tryHostedFallbackFromLocal();
        if (recoveredHosted) {
          return;
        }
      } catch (fallbackError) {
        appendStartupLog(`[recovery] Local->hosted fallback failed after local services were unavailable: ${String(fallbackError)}`);
      }

      loadFallbackPage(
        "Local services are not available. Start the web and API servers on http://127.0.0.1:3000 and reopen NexusForge Desktop.",
      );
      return;
    }

    const reachable = await waitForUrlReachable(startUrl, { timeoutMs: localStartUrlProbeTimeoutMs, intervalMs: 600 });
    if (!reachable) {
      try {
        const recoveredHosted = await tryHostedFallbackFromLocal();
        if (recoveredHosted) {
          return;
        }
      } catch (fallbackError) {
        appendStartupLog(`[recovery] Local->hosted fallback failed after local URL probe: ${String(fallbackError)}`);
      }

      loadFallbackPage(
        "Local app URL is unreachable. Verify localhost:3000 is running and retry.",
      );
      return;
    }

    await loadMainWindowUrlWithRetry(startUrl, { attempts: 6, delayMs: 900 });
    markStartupTiming("local-target-connected", `target=${startUrl}`, false);
    revealMainWindow();
    updateLocalStackStatus({
      launchMode: "local-dev",
      startUrl,
      message: "Desktop is connected to local services.",
      lastError: null,
      running: true,
    });
    updateStartupRuntime({
      launchMode: "local-dev",
    });
    appendLocalStackHistory("Desktop reconnected to local services.");
  } catch (error) {
    const message = `Recovery failed: ${String(error)}`;
    updateLocalStackStatus({
      lastError: message,
      message,
    });

    if (!shouldForceLocalInDev) {
      const recoveredHosted = await tryHostedFallbackFromLocal();
      if (!recoveredHosted) {
        loadFallbackPage("Recovery encountered an error and hosted fallback was unavailable. Open stack log for details.");
      }
    } else {
      loadFallbackPage("Recovery encountered an error while connecting to local services. Start the local web and API servers on http://127.0.0.1:3000 and reopen NexusForge Desktop.");
    }
  } finally {
    bootRecoveryInFlight = false;
  }
}

function resetDevQuotaDatabase() {
  if (!isLocalStartTarget) {
    return;
  }

  const sessionDataPath = app.getPath("sessionData");
  const quotaDbArtifacts = [
    "QuotaManager",
    "QuotaManager-journal",
    "QuotaManager-wal",
    "QuotaManager-shm",
  ];

  for (const artifact of quotaDbArtifacts) {
    const artifactPath = path.join(sessionDataPath, artifact);
    try {
      if (fs.existsSync(artifactPath)) {
        fs.rmSync(artifactPath, { force: true });
      }
    } catch (error) {
      console.warn(`[NexusForge Desktop] Unable to remove ${artifact}:`, error);
    }
  }
}

function resetIsolatedDevSession() {
  if (!isolatedSessionPath) {
    return;
  }

  try {
    fs.rmSync(isolatedSessionPath, { recursive: true, force: true });
    fs.mkdirSync(isolatedSessionPath, { recursive: true });
    app.setPath("sessionData", isolatedSessionPath);
  } catch (error) {
    console.warn("[NexusForge Desktop] Unable to reset isolated dev session:", error);
  }
}

async function prepareDevSessionStorage() {
  updateStartupRuntime({
    stage: "Preparing secure session",
    detail: "Resetting desktop storage before launch.",
    progress: 18,
    accent: "warmup",
  });
  if (!isLocalStartTarget) {
    startupHealth = {
      mode: "web",
      storageResetAttempted: false,
      storageResetSuccess: true,
      message: "Desktop is using a non-local origin. No dev storage reset needed.",
      sessionDataPath: app.getPath("sessionData"),
      lastMaintenanceAction: startupHealth.lastMaintenanceAction,
      maintenanceHistory: startupHealth.maintenanceHistory,
      timestamp: new Date().toISOString(),
    };
    return;
  }

  const origin = new URL(startUrl).origin;
  startupHealth = {
    mode: "desktop-dev",
    storageResetAttempted: true,
    storageResetSuccess: false,
    message: `Resetting Chromium dev storage for ${origin}`,
    sessionDataPath: app.getPath("sessionData"),
    lastMaintenanceAction: startupHealth.lastMaintenanceAction,
    maintenanceHistory: startupHealth.maintenanceHistory,
    timestamp: new Date().toISOString(),
  };

  try {
    await session.defaultSession.clearStorageData({
      origin,
      storages: ["serviceworkers", "cachestorage", "indexdb"],
    });

    updateStartupRuntime({
      stage: "Preparing secure session",
      detail: "Desktop storage reset completed.",
      progress: 26,
      accent: "ready",
    });

    startupHealth = {
      mode: "desktop-dev",
      storageResetAttempted: true,
      storageResetSuccess: true,
      message: "Desktop dev storage reset completed before launch.",
      sessionDataPath: app.getPath("sessionData"),
      lastMaintenanceAction: startupHealth.lastMaintenanceAction,
      maintenanceHistory: startupHealth.maintenanceHistory,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.warn("[NexusForge Desktop] Unable to clear dev session storage:", error);
    updateStartupRuntime({
      stage: "Preparing secure session",
      detail: "Storage reset warning detected. Continuing launch.",
      progress: 26,
      accent: "warning",
    });
    startupHealth = {
      mode: "desktop-dev",
      storageResetAttempted: true,
      storageResetSuccess: false,
      message: "Desktop launched with storage reset warning. Review Electron console for details.",
      sessionDataPath: app.getPath("sessionData"),
      lastMaintenanceAction: startupHealth.lastMaintenanceAction,
      maintenanceHistory: startupHealth.maintenanceHistory,
      timestamp: new Date().toISOString(),
    };
  }
}

if (isLocalStartTarget) {
  isolatedSessionPath = path.join(app.getPath("temp"), "nexusforge-desktop-dev-session");
  try {
    fs.mkdirSync(isolatedSessionPath, { recursive: true });
    app.setPath("sessionData", isolatedSessionPath);
  } catch (error) {
    console.warn("[NexusForge Desktop] Unable to set isolated dev session path:", error);
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

if (process.platform === "win32") {
  app.setAppUserModelId("com.nexusforge.desktop");
}

app.on("certificate-error", (event, _webContents, url, error, _certificate, callback) => {
  const allowBypass = allowHostedCertBypass && isTrustedHostedDomain(url);
  if (!allowBypass) {
    callback(false);
    return;
  }

  event.preventDefault();
  appendStartupLog(`[tls] certificate bypass accepted for ${url} (${error})`);
  callback(true);
});

function createWindow() {
  markStartupTiming("main-window-create");
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
    return;
  }

  const savedState = readWindowState();
  mainWindow = new BrowserWindow({
    width: savedState?.width ?? 1480,
    height: savedState?.height ?? 920,
    x: savedState?.x,
    y: savedState?.y,
    minWidth: 1100,
    minHeight: 760,
    fullscreen: true,
    show: false,
    icon: appIconPath,
    backgroundColor: "#020617",
    title: "NexusForge Desktop",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    appendStartupLog(`[renderer-console] level=${level} line=${line} source=${sourceId} msg=${message}`);
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    appendStartupLog(`[renderer-gone] reason=${details.reason} exitCode=${details.exitCode} exitStatus=${details.exitStatus}`);
  });
  mainWindow.webContents.on("crashed", () => {
    appendStartupLog("[renderer-crashed] Renderer process crashed.");
  });

  // Desktop-only launch guard: append token while preserving Chromium UA compatibility.
  const baseUserAgent = mainWindow.webContents.getUserAgent();
  if (!baseUserAgent.includes(desktopUaToken)) {
    mainWindow.webContents.setUserAgent(`${baseUserAgent}${desktopUserAgentSuffix}`);
  }

  mainWindow.on("closed", () => {
    saveWindowState();
    mainWindow = null;
  });

  mainWindow.on("close", (event) => {
    saveWindowState();
    if (isQuitting) {
      return;
    }

    if (desktopPreferences.minimizeToTray) {
      event.preventDefault();
      hideMainWindowToTray();
      return;
    }

    isQuitting = true;
  });

  mainWindow.on("resize", () => {
    saveWindowState();
  });

  mainWindow.on("move", () => {
    saveWindowState();
  });

  if (savedState?.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.once("ready-to-show", () => {
    markStartupTiming("main-ready-to-show");
    revealMainWindow();
  });

  mainWindow.webContents.once("did-finish-load", () => {
    markStartupTiming("main-did-finish-load");
    revealMainWindow();
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode) => {
    markStartupTiming("main-did-fail-load", `errorCode=${errorCode}`, false);
    appendStartupLog(`[did-fail-load] errorCode=${errorCode}`);
    if (!isLocalStartTarget || errorCode === -3) {
      return;
    }
    void ensureAppReachable("did-fail-load");
  });
}

function stopSpawnedLocalStack() {
  if (!localStackProcess || localStackProcess.killed) {
    return;
  }

  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(localStackProcess.pid), "/t", "/f"], {
        windowsHide: true,
      });
    } else {
      localStackProcess.kill("SIGTERM");
    }
    appendLocalStackHistory("Spawned local stack process terminated at app shutdown.");
  } catch (error) {
    console.warn("[NexusForge Desktop] Unable to stop local stack process:", error);
  }
}

app.on("second-instance", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
    void ensureAppReachable("second-instance");
    return;
  }

  createWindow();
  void ensureAppReachable("second-instance-create");
});

app.whenReady().then(async () => {
  markStartupTiming("app-when-ready");
  appendStartupLog(`[startup-timing] log-path="${startupLogPath}"`);
  appendStartupLog(
    updateManifestUrl
      ? `[startup] updateManifestUrl=${updateManifestUrl}`
      : "[startup] updateManifestUrl is not configured; auto-update is disabled."
  );
  updateStartupRuntime({
    stage: "Booting desktop shell",
    detail: "Starting NexusForge Desktop.",
    progress: 4,
    accent: "warmup",
  });
  readPersistedUpdateState();
  readDesktopPreferences();

  if (!app.isPackaged) {
    desktopPreferences.minimizeToTray = false;
    desktopPreferences.startMinimized = false;
    desktopPreferences.launchOnStartup = false;
    appendStartupLog("[startup] Dev mode detected: overriding tray/minimize preferences.");
  }

  applyLaunchOnStartupPreference();
  shouldStartHiddenOnLaunch =
    requestedHiddenArg || (desktopPreferences.startMinimized && launchedFromStartupArg);

  if (shouldStartHiddenOnLaunch) {
    appendStartupLog("[startup] Launching in hidden mode due to startup preferences.");
  }
  resetDevQuotaDatabase();
  await prepareDevSessionStorage();
  if (isLocalStartTarget) {
    await refreshLocalPortStatus();
  } else {
    updateStartupRuntime({
      stage: "Connecting hosted workspace",
      detail: "Opening the remote NexusForge experience.",
      progress: 32,
      accent: "opening",
    });
  }

  startupHealth = {
    ...startupHealth,
    lastMaintenanceAction: "startup",
    timestamp: new Date().toISOString(),
  };

  ipcMain.handle("nexusforge-desktop:get-startup-health", () => startupHealth);
  ipcMain.handle("nexusforge-desktop:get-local-stack-status", async () => {
    await refreshLocalPortStatus();
    return localStackStatus;
  });
  ipcMain.handle("nexusforge-desktop:get-update-state", async () => updateRuntime);
  ipcMain.handle("nexusforge-desktop:get-desktop-preferences", async () => ({ ...desktopPreferences }));
  ipcMain.handle("nexusforge-desktop:update-desktop-preferences", async (_event, patch = {}) => {
    const next = {
      ...desktopPreferences,
      ...(typeof patch?.launchOnStartup === "boolean" ? { launchOnStartup: patch.launchOnStartup } : null),
      ...(typeof patch?.minimizeToTray === "boolean" ? { minimizeToTray: patch.minimizeToTray } : null),
      ...(typeof patch?.startMinimized === "boolean" ? { startMinimized: patch.startMinimized } : null),
    };

    desktopPreferences = next;
    persistDesktopPreferences();
    applyLaunchOnStartupPreference();
    return { ...desktopPreferences };
  });
  ipcMain.handle("nexusforge-desktop:check-updates-now", async () => checkForUpdates("manual"));
  ipcMain.handle("nexusforge-desktop:download-update-now", async () => {
    resolveStartupUpdatePrompt("accept");
    await beginBackgroundUpdateDownload(false);
    return updateRuntime;
  });
  ipcMain.handle("nexusforge-desktop:resolve-update-prompt", async (_event, choice) => {
    resolveStartupUpdatePrompt(String(choice || "skip"));
    return {
      success: true,
      choice: String(choice || "skip"),
    };
  });
  ipcMain.handle("nexusforge-desktop:restart-for-update", async () => {
    if (updateRuntime.downloaded && updateRuntime.installerPath) {
      await installDownloadedUpdate();
      return { restarting: true };
    }
    app.relaunch();
    app.exit(0);
    return { restarting: true };
  });
  ipcMain.handle("nexusforge-desktop:start-local-stack", async () => startLocalStack("manual-ui"));
  ipcMain.handle("nexusforge-desktop:set-workspace-path", async (_event, candidatePath) => {
    const normalizedCandidate = String(candidatePath || "").trim();
    if (!normalizedCandidate) {
      return { success: false, reason: "Workspace path is empty." };
    }

    const resolvedPath = path.resolve(normalizedCandidate);
    if (!isWorkspaceRoot(resolvedPath)) {
      return { success: false, reason: "Provided path is not a valid NexusForge workspace root." };
    }

    updateLocalStackStatus({
      workspacePath: resolvedPath,
      autoStartEnabled: true,
      localRecoveryEnabled: true,
      message: `Local workspace path set to ${resolvedPath}`,
      lastError: null,
    });
    appendLocalStackHistory(`Workspace path configured: ${resolvedPath}`);
    return { success: true, workspacePath: resolvedPath };
  });
  ipcMain.handle("nexusforge-desktop:retry-app-load", async () => {
    await ensureAppReachable("manual-retry");
    return localStackStatus;
  });
  ipcMain.handle("nexusforge-desktop:open-local-stack-log", async () => {
    if (!isLocalStartTarget) {
      const message = "No local stack log is available in hosted mode.";
      updateLocalStackStatus({ message, lastError: null });
      appendLocalStackHistory(message);
      return { opened: false, logPath: null, reason: "hosted-mode" };
    }
    if (fs.existsSync(localStackLogPath)) {
      await shell.openPath(localStackLogPath);
      return { opened: true, logPath: localStackLogPath };
    }
    const message = "Local stack log does not exist yet.";
    updateLocalStackStatus({ message });
    appendLocalStackHistory(message);
    return { opened: false, logPath: localStackLogPath };
  });
  ipcMain.handle("nexusforge-desktop:run-maintenance", async () => {
    resetDevQuotaDatabase();
    await prepareDevSessionStorage();

    appendMaintenanceHistory({
      action: "run-maintenance",
      message: "Manual cleanup completed.",
      timestamp: new Date().toISOString(),
    });

    startupHealth = {
      ...startupHealth,
      lastMaintenanceAction: "manual-maintenance",
      timestamp: new Date().toISOString(),
    };

    if (mainWindow && !mainWindow.isDestroyed()) {
      await ensureAppReachable("maintenance");
    }

    return startupHealth;
  });
  ipcMain.handle("nexusforge-desktop:reload-window", async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reloadIgnoringCache();
      mainWindow.focus();
    }

    startupHealth = {
      ...startupHealth,
      lastMaintenanceAction: "reload-window",
      timestamp: new Date().toISOString(),
    };

    appendMaintenanceHistory({
      action: "reload-window",
      message: "Window reloaded from diagnostics.",
      timestamp: new Date().toISOString(),
    });

    return startupHealth;
  });
  ipcMain.handle("nexusforge-desktop:restart-clean-session", async () => {
    resetDevQuotaDatabase();
    resetIsolatedDevSession();
    await prepareDevSessionStorage();

    appendMaintenanceHistory({
      action: "restart-clean-session",
      message: "Isolated session rebuilt and app relaunched.",
      timestamp: new Date().toISOString(),
    });

    startupHealth = {
      ...startupHealth,
      lastMaintenanceAction: "restart-clean-session",
      timestamp: new Date().toISOString(),
    };

    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 150);

    return startupHealth;
  });

  if (app.isPackaged && desktopPreferences.minimizeToTray) {
    createAppTray();
  } else {
    appendStartupLog("[startup] Tray icon disabled for non-packaged dev mode or because minimizeToTray is off.");
  }
  createSplashWindow();
  createWindow();
  updateStartupRuntime({
    stage: "Preparing launch",
    detail: "Checking updates and final startup tasks.",
    progress: 72,
    accent: "checking",
  });
  startupUpdateCheckPromise = checkForUpdates("startup");
  void ensureAppReachable("startup");

  if (updateManifestUrl) {
    updateCheckTimer = setInterval(() => {
      void checkForUpdates("silent");
    }, updateCheckIntervalMs);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      void ensureAppReachable("activate");
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && isQuitting) {
    app.quit();
  }
});

app.on("before-quit", (event) => {
  isQuitting = true;
  if (!canAutoInstallOnClose() || installInProgress) {
    return;
  }

  event.preventDefault();
  void installDownloadedUpdate().catch((error) => {
    installInProgress = false;
    skipAutoInstallOnQuit = true;
    updateRuntime = {
      ...updateRuntime,
      lastError: `Auto-install on close failed: ${String(error)}`,
    };
    emitUpdateRuntime();
    app.quit();
  });
});

app.on("will-quit", () => {
  if (appTray) {
    appTray.destroy();
    appTray = null;
  }
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }
  if (startupRevealTimer) {
    clearTimeout(startupRevealTimer);
    startupRevealTimer = null;
  }
  stopSpawnedLocalStack();
  ipcMain.removeHandler("nexusforge-desktop:get-startup-health");
  ipcMain.removeHandler("nexusforge-desktop:get-local-stack-status");
  ipcMain.removeHandler("nexusforge-desktop:get-update-state");
  ipcMain.removeHandler("nexusforge-desktop:get-desktop-preferences");
  ipcMain.removeHandler("nexusforge-desktop:update-desktop-preferences");
  ipcMain.removeHandler("nexusforge-desktop:check-updates-now");
  ipcMain.removeHandler("nexusforge-desktop:restart-for-update");
  ipcMain.removeHandler("nexusforge-desktop:start-local-stack");
  ipcMain.removeHandler("nexusforge-desktop:retry-app-load");
  ipcMain.removeHandler("nexusforge-desktop:open-local-stack-log");
  ipcMain.removeHandler("nexusforge-desktop:run-maintenance");
  ipcMain.removeHandler("nexusforge-desktop:reload-window");
  ipcMain.removeHandler("nexusforge-desktop:restart-clean-session");
});
