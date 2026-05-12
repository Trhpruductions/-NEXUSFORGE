const { app, BrowserWindow, shell, session, ipcMain, dialog } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const localStartUrl = "http://localhost:3000/app";
const startUrl = process.env.NEXUSFORGE_DESKTOP_URL || localStartUrl;
const isLocalStartTarget = /localhost|127\.0\.0\.1/i.test(startUrl);
const appIconPath =
  process.platform === "win32"
    ? path.join(__dirname, "assets", "app-icon.ico")
    : path.join(__dirname, "..", "web", "public", "brand", "nexusforge-main-logo.png");
const fallbackPath = path.join(__dirname, "fallback.html");
const splashPath = path.join(__dirname, "splash.html");
const startupWaitTimeoutMs = 90000;
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
const updateDownloadDir = path.join(app.getPath("userData"), "updates");
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
const updateStatePath = path.join(app.getPath("userData"), "update-state.json");

let startupRuntime = {
  stage: "Booting desktop shell",
  detail: "Preparing the launch environment.",
  progress: 8,
  accent: "warmup",
  timestamp: new Date().toISOString(),
};

let updateRuntime = {
  checking: false,
  available: false,
  forceRequired: false,
  downloading: false,
  downloaded: false,
  downloadPercent: 0,
  currentVersion: app.getVersion(),
  latestVersion: null,
  notes: [],
  downloadUrl: null,
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
  startUrl,
  workspacePath: null,
  attempted: false,
  started: false,
  running: false,
  autoStartEnabled: true,
  port3000Open: false,
  port4000Open: false,
  processPid: null,
  lastError: null,
  message: "Local stack not started yet.",
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

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>What's New</title>
  <style>body{margin:0;padding:28px;background:#020617;color:#e2e8f0;font-family:Segoe UI,Inter,sans-serif}
  h1{margin:0 0 6px;font-size:28px}p{color:#94a3b8}ul{margin:20px 0 0;padding-left:20px}
  li{margin:10px 0;padding:10px 12px;border:1px solid rgba(56,189,248,.25);border-radius:10px;background:rgba(15,23,42,.7)}
  .meta{margin-top:8px;font-size:12px;color:#67e8f9;letter-spacing:.08em;text-transform:uppercase}</style></head>
  <body><h1>What's New</h1><p>Version ${String(updateRuntime.latestVersion || app.getVersion())}</p>
  <div class="meta">NexusForge Desktop</div><ul>${list}</ul></body></html>`;
  await changelogWindow.loadURL(`data:text/html,${encodeURIComponent(html)}`);
}

async function showUpdateReadyDialog() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const result = await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "Update Ready",
    message: `Update downloaded successfully and ready to install (v${updateRuntime.latestVersion || "latest"}).`,
    detail: "Install now to apply the desktop binary update, or continue and install later.",
    buttons: ["Install & Restart", "Later"],
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

  const response = await fetch(downloadUrl, { cache: "no-store" });
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
  if (!installerPath || !fs.existsSync(installerPath)) {
    throw new Error("Downloaded installer is unavailable.");
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
  return (
    !skipAutoInstallOnQuit &&
    autoInstallOnClose &&
    process.platform === "win32" &&
    updateRuntime.downloaded &&
    Boolean(updateRuntime.installerPath) &&
    fs.existsSync(updateRuntime.installerPath)
  );
}

async function beginBackgroundUpdateDownload(forceInstallAfterDownload = false) {
  if (updateRuntime.downloading || updateRuntime.downloaded) {
    return;
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
    const installerPath = await downloadUpdateInstaller(updateRuntime.downloadUrl, updateRuntime.latestVersion);
    const integrityOk = await verifyInstallerIntegrity(installerPath, updateRuntime.sha256);
    if (!integrityOk) {
      fs.rmSync(installerPath, { force: true });
      throw new Error("Downloaded update failed integrity verification.");
    }

    updateRuntime = {
      ...updateRuntime,
      downloading: false,
      downloaded: true,
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
    title: "New Update Available",
    message: `New Update Available - Version ${updateRuntime.latestVersion || "latest"}`,
    detail: "NexusForge will download and stage this desktop update in the background.",
    buttons: ["Download in Background", "Remind Me Later", "View Changes"],
    defaultId: 0,
    cancelId: 1,
  });

  if (result.response === 0) {
    await beginBackgroundUpdateDownload();
    return;
  }

  if (result.response === 1) {
    updateRuntime = {
      ...updateRuntime,
      remindLaterUntil: Date.now() + remindLaterDelayMs,
    };
    persistUpdateState();
    emitUpdateRuntime();
    return;
  }

  await showChangelogWindow();
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
    const response = await fetch(updateManifestUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Update manifest request failed (${response.status}).`);
    }

    const payload = await response.json();
    const latestVersion = String(payload?.version || "").trim();
    const notes = sanitizeReleaseNotes(payload?.notes);
    const downloadUrl = typeof payload?.downloadUrl === "string" ? payload.downloadUrl : null;
    const sha256 = typeof payload?.sha256 === "string" ? payload.sha256.trim() : null;
    const hasUpdate = Boolean(latestVersion) && isVersionGreater(latestVersion, app.getVersion());
    const payloadForceUpdate =
      payload?.forceUpdate === true ||
      payload?.required === true ||
      payload?.mandatory === true ||
      payload?.forceRequired === true;
    const forceRequired = hasUpdate && (payloadForceUpdate || forceUpdateByDefault);

    updateRuntime = {
      ...updateRuntime,
      checking: false,
      available: hasUpdate,
      forceRequired,
      latestVersion: hasUpdate ? latestVersion : null,
      notes,
      downloadUrl,
      sha256,
      downloaded: hasUpdate ? updateRuntime.downloaded : false,
      downloadPercent: hasUpdate ? updateRuntime.downloadPercent : 0,
      installerPath: hasUpdate ? updateRuntime.installerPath : null,
      lastCheckedAt: new Date().toISOString(),
      lastError: null,
    };
    emitUpdateRuntime();

    if (hasUpdate && !updateRuntime.downloading && !updateRuntime.downloaded) {
      void beginBackgroundUpdateDownload(forceRequired);
    }

    if (hasUpdate && forceRequired && updateRuntime.downloaded) {
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
    emitStartupRuntime();
  });
  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}

function revealMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (startupRevealTimer) {
    clearTimeout(startupRevealTimer);
    startupRevealTimer = null;
  }

  startupRevealTimer = setTimeout(() => {
    updateStartupRuntime({
      stage: "Opening NexusForge Desktop",
      detail: "The workspace is ready. Bringing the app forward.",
      progress: 100,
      accent: "ready",
    });
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
  }, startupSplashHoldMs);
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

function loadFallbackPage(message) {
  updateLocalStackStatus({ message });
  appendLocalStackHistory(message);

  if (mainWindow && !mainWindow.isDestroyed()) {
    void mainWindow.loadFile(fallbackPath).catch((error) => {
      console.warn("[NexusForge Desktop] Unable to load fallback page:", error);
    });
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
    updateLocalStackStatus({
      message: "Local stack start skipped: desktop target is not localhost.",
      attempted: true,
      started: false,
      running: false,
    });
    return localStackStatus;
  }

  const workspacePath = resolveWorkspacePath();
  if (!workspacePath) {
    const message = "Local workspace was not found. Set NEXUSFORGE_WORKSPACE_PATH to your repo path.";
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
      const reachable = await waitForUrlReachable(startUrl, { timeoutMs: 20000, intervalMs: 600 });
      if (!reachable) {
        throw new Error("Hosted startup URL did not become reachable in time.");
      }
      await loadMainWindowUrlWithRetry(startUrl, { attempts: 4, delayMs: 900 });
      updateLocalStackStatus({
        message: "Desktop is connected to hosted services.",
        lastError: null,
      });
      appendLocalStackHistory("Desktop connected to hosted target.");
    } catch (error) {
      const message = `Hosted target unreachable: ${String(error)}`;
      updateLocalStackStatus({
        lastError: message,
        message,
      });
      loadFallbackPage("Hosted app is unreachable. Retry in a moment or set NEXUSFORGE_DESKTOP_URL to a live target.");
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
        await startLocalStack(`auto-${trigger}`);
      }
      const ready = await waitForLocalStackReady(startupWaitTimeoutMs);
      if (!ready) {
        loadFallbackPage("Local services are still offline. Use Start Local Stack to retry.");
        return;
      }
    }

    const reachable = await waitForUrlReachable(startUrl, { timeoutMs: 20000, intervalMs: 600 });
    if (!reachable) {
      loadFallbackPage("Local app URL did not become reachable. Retry in a moment or restart local services.");
      return;
    }

    await loadMainWindowUrlWithRetry(startUrl, { attempts: 4, delayMs: 900 });
    updateLocalStackStatus({
      message: "Desktop is connected to local services.",
      lastError: null,
      running: true,
    });
    appendLocalStackHistory("Desktop reconnected to local services.");
  } catch (error) {
    const message = `Recovery failed: ${String(error)}`;
    updateLocalStackStatus({
      lastError: message,
      message,
    });
    loadFallbackPage("Recovery encountered an error. Open stack log for details.");
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

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
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
    mainWindow = null;
  });

  mainWindow.once("ready-to-show", () => {
    revealMainWindow();
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode) => {
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
  updateStartupRuntime({
    stage: "Booting desktop shell",
    detail: "Starting NexusForge Desktop.",
    progress: 4,
    accent: "warmup",
  });
  readPersistedUpdateState();
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
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", (event) => {
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
  ipcMain.removeHandler("nexusforge-desktop:check-updates-now");
  ipcMain.removeHandler("nexusforge-desktop:restart-for-update");
  ipcMain.removeHandler("nexusforge-desktop:start-local-stack");
  ipcMain.removeHandler("nexusforge-desktop:retry-app-load");
  ipcMain.removeHandler("nexusforge-desktop:open-local-stack-log");
  ipcMain.removeHandler("nexusforge-desktop:run-maintenance");
  ipcMain.removeHandler("nexusforge-desktop:reload-window");
  ipcMain.removeHandler("nexusforge-desktop:restart-clean-session");
});