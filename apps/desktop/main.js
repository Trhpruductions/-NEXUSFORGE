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
const { app, BrowserWindow, shell, session, ipcMain, dialog, Tray, Menu } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const localStartUrl = "http://localhost:3000/app";
const packagedHostedFallbackUrl = "https://www.nexusforge.app/app";
const configuredStartUrl = String(process.env.NEXUSFORGE_DESKTOP_URL || "").trim();
const allowHostedDevLaunch =
  String(process.env.NEXUSFORGE_ALLOW_HOSTED_DEV || "false").toLowerCase() === "true";
const allowHostedCertBypass =
  String(process.env.NEXUSFORGE_ALLOW_HOSTED_CERT_BYPASS || "true").toLowerCase() !== "false";
const shouldForceLocalInDev = !app.isPackaged && !allowHostedDevLaunch;
const startUrl =
  shouldForceLocalInDev && configuredStartUrl && !/localhost|127\.0\.0\.1/i.test(configuredStartUrl)
    ? localStartUrl
    : configuredStartUrl || (app.isPackaged ? packagedHostedFallbackUrl : localStartUrl);
const isLocalStartTarget = /localhost|127\.0\.0\.1/i.test(startUrl);
const desktopLaunchMode = isLocalStartTarget ? "local-dev" : "hosted";
const appIconPath =
  process.platform === "win32"
    ? path.join(__dirname, "assets", "app-icon.ico")
    : path.join(__dirname, "..", "web", "public", "brand", "nexusforge-main-logo.png");
const fallbackPath = path.join(__dirname, "fallback.html");
const splashPath = path.join(__dirname, "splash.html");
const startupWaitTimeoutMs = 90000;
const startupQuickRecoveryTimeoutMs = 15000;
const startupProbeDelayMs = 1250;
const startupSplashHoldMs = 2200;
const desktopUaToken = "NexusForgeDesktop";
const desktopUserAgentSuffix = ` ${desktopUaToken}/${app.getVersion()}`;
const stableCacheDir = path.join(app.getPath("temp"), "nexusforge-desktop-cache");
const stableCodeCacheDir = path.join(app.getPath("temp"), "nexusforge-desktop-code-cache");
const updateManifestUrl =
  process.env.NEXUSFORGE_UPDATE_MANIFEST_URL || `${new URL(startUrl).origin}/desktop-update.json`;
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
  localRecoveryEnabled: isLocalStartTarget,
  port3000Open: false,
  port4000Open: false,
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
      lastCheckedAt: new Date().toISOString(),
      lastError: null,
    };
    emitUpdateRuntime();

    if (hasUpdate && !updateRuntime.downloading && !updateRuntime.downloaded) {
      void beginBackgroundUpdateDownload(forceRequired);
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
      trigger !== "silent"
    ) {
      await showUpdateAvailableDialog();
    }
  } catch (error) {
    updateRuntime = {
      ...updateRuntime,
      checking: false,
      lastCheckedAt: new Date().toISOString(),
      lastError: `Update check failed: ${String(error)}`,
    };
    emitUpdateRuntime();
  }

  return updateRuntime;
}

function createSplashWindow() {
  markStartupTiming("splash-window-create");
  splashWindow = new BrowserWindow({
    width: 980,
    height: 560,
    frame: false,
    show: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
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

function revealMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
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

function resolveWorkspacePath() {
  if (localStackStatus.workspacePath && isWorkspaceRoot(localStackStatus.workspacePath)) {
    return localStackStatus.workspacePath;
  }

  const envWorkspace = process.env.NEXUSFORGE_WORKSPACE_PATH;
  const cwdWorkspace = path.resolve(process.cwd());
  const parentWorkspace = path.resolve(cwdWorkspace, "..", "..");
  const executableWorkspace = path.resolve(path.dirname(process.execPath), "..", "..", "..", "..");
  const hardcodedWorkspace = "D:\\NEXUSFORGE GAMGING APP";

  const candidates = [envWorkspace, cwdWorkspace, parentWorkspace, executableWorkspace, hardcodedWorkspace].filter(Boolean);
  for (const candidate of candidates) {
    if (isWorkspaceRoot(candidate)) {
      updateLocalStackStatus({ workspacePath: candidate });
      return candidate;
    }
  }

  return null;
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

async function refreshLocalPortStatus() {
  if (!isLocalStartTarget) {
    return { port3000Open: false, port4000Open: false };
  }

  updateStartupRuntime({
    stage: "Checking local services",
    detail: "Verifying the app stack is reachable on ports 3000 and 4000.",
    progress: 34,
    accent: "checking",
  });
  const [port3000Open, port4000Open] = await Promise.all([probePort(3000), probePort(4000)]);
  updateLocalStackStatus({ port3000Open, port4000Open });
  updateStartupRuntime({
    stage: port3000Open && port4000Open ? "Local services ready" : "Preparing recovery path",
    detail: port3000Open && port4000Open ? "The desktop stack answered on both ports." : "Waiting on the local stack to finish coming online.",
    progress: port3000Open && port4000Open ? 66 : 46,
    accent: port3000Open && port4000Open ? "ready" : "checking",
  });
  return { port3000Open, port4000Open };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error("Main window is unavailable during URL load.");
    }

    try {
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

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
      });

      if (response.status >= 200 && response.status < 500) {
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
  const candidates = [startUrl, packagedHostedFallbackUrl, "https://nexusforge.app", "https://www.nexusforge.app/app", "https://www.nexusforge.app"];

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

  try {
    const manifestOrigin = new URL(updateManifestUrl).origin;
    candidates.push(`${manifestOrigin}/app`);
    candidates.push(manifestOrigin);
  } catch {
    // Ignore malformed manifest URLs in target resolution.
  }

  return Array.from(new Set(candidates.filter(Boolean)));
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
    const { port3000Open, port4000Open } = await refreshLocalPortStatus();
    if (port3000Open && port4000Open) {
      return true;
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
    if (/localhost|127\.0\.0\.1/i.test(target)) {
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
  if (!isLocalStartTarget) {
    const hostedMessage = "Local stack controls are disabled in hosted mode.";
    updateLocalStackStatus({
      message: hostedMessage,
      attempted: true,
      started: false,
      running: false,
      lastError: null,
    });
    appendLocalStackHistory(hostedMessage);
    return localStackStatus;
  }

  const workspacePath = resolveWorkspacePath();
  if (!workspacePath) {
    const message = "Local workspace was not found for desktop dev recovery.";
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
  if (existingPorts.port3000Open && existingPorts.port4000Open) {
    updateLocalStackStatus({
      attempted: true,
      started: false,
      running: true,
      message: "Local stack is already running on ports 3000 and 4000.",
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

  const spawnCommand = process.platform === "win32" ? "cmd.exe" : "npm";
  const spawnArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npm run dev"] : ["run", "dev"];
  logStream.write(
    `workspace=${workspacePath}\ncommand=${spawnCommand} ${spawnArgs.join(" ")}\n`,
  );

  const child = spawn(spawnCommand, spawnArgs, {
    cwd: workspacePath,
    windowsHide: true,
    env: {
      ...process.env,
      NEXUSFORGE_DESKTOP_BOOTSTRAPPED: "true",
    },
  });

  localStackProcess = child;
  updateLocalStackStatus({
    attempted: true,
    started: true,
    running: true,
    processPid: child.pid ?? null,
    lastError: null,
    message: "Local stack startup command launched. Waiting for ports 3000 and 4000.",
    workspacePath,
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

  return localStackStatus;
}

async function ensureAppReachable(trigger) {
  markStartupTiming("ensure-app-reachable-start", `trigger=${trigger}`, false);
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
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

      loadFallbackPage(
        "Hosted app is unreachable. Retry in a moment, set NEXUSFORGE_DESKTOP_URL to a live target, or start local services on http://localhost:3000/app.",
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
    if (!ports.port3000Open || !ports.port4000Open) {
      loadFallbackPage("Local services are down. Starting recovery sequence.");
      if (localStackStatus.autoStartEnabled) {
        const startResult = await startLocalStack(`auto-${trigger}`);
        const couldStartLocal = Boolean(startResult?.started || startResult?.running);
        if (!couldStartLocal) {
          updateStartupRuntime({
            stage: "Switching to hosted fallback",
            detail: "Local services could not start. Trying hosted NexusForge now.",
            progress: 60,
            accent: "checking",
          });
          const recoveredHosted = await tryHostedFallbackFromLocal();
          if (recoveredHosted) {
            return;
          }
        }
      }
      const ready = await waitForLocalStackReady(Math.min(startupWaitTimeoutMs, startupQuickRecoveryTimeoutMs));
      if (!ready) {
        updateStartupRuntime({
          stage: "Local services unavailable",
          detail: "Trying hosted fallback so users can still join from outside the local network.",
          progress: 62,
          accent: "checking",
        });
        const recoveredHosted = await tryHostedFallbackFromLocal();
        if (recoveredHosted) {
          return;
        }
        loadFallbackPage("Local services are still offline and hosted fallback was unavailable. Use Start Local Stack to retry.");
        return;
      }
    }

    let reachable = await waitForUrlReachable(startUrl, { timeoutMs: 20000, intervalMs: 600 });
    if (!reachable && localStackStatus.autoStartEnabled) {
      updateStartupRuntime({
        stage: "Starting local services",
        detail: "Local URL is not reachable yet. Restarting local services and retrying launch.",
        progress: 56,
        accent: "starting",
      });
      appendStartupLog("[recovery] Local URL unreachable after port checks. Starting recovery restart.");
      await startLocalStack(`url-unreachable-${trigger}`);
      await waitForLocalStackReady(startupWaitTimeoutMs);
      reachable = await waitForUrlReachable(startUrl, { timeoutMs: 20000, intervalMs: 600 });
    }

    if (!reachable) {
      updateStartupRuntime({
        stage: "Local URL unavailable",
        detail: "Trying hosted fallback so users can still join from outside the local network.",
        progress: 62,
        accent: "checking",
      });
      const recoveredHosted = await tryHostedFallbackFromLocal();
      if (recoveredHosted) {
        return;
      }
      loadFallbackPage("Local app URL did not become reachable and hosted fallback was unavailable. Retry in a moment or restart local services.");
      return;
    }

    await loadMainWindowUrlWithRetry(startUrl, { attempts: 4, delayMs: 900 });
    markStartupTiming("local-target-connected", `target=${startUrl}`, false);
    revealMainWindow();
    updateLocalStackStatus({
      launchMode: "local-dev",
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
    const recoveredHosted = await tryHostedFallbackFromLocal();
    if (!recoveredHosted) {
      loadFallbackPage("Recovery encountered an error and hosted fallback was unavailable. Open stack log for details.");
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
  updateStartupRuntime({
    stage: "Booting desktop shell",
    detail: "Starting NexusForge Desktop.",
    progress: 4,
    accent: "warmup",
  });
  readPersistedUpdateState();
  readDesktopPreferences();
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

  createAppTray();
  createSplashWindow();
  createWindow();
  updateStartupRuntime({
    stage: "Preparing launch",
    detail: "Checking updates and final startup tasks.",
    progress: 72,
    accent: "checking",
  });
  void ensureAppReachable("startup");
  void checkForUpdates("startup");

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
