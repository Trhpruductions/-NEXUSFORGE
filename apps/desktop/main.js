const { app, BrowserWindow, shell, session, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const startUrl = process.env.NEXUSFORGE_DESKTOP_URL || "http://localhost:3000/app";
const appIconPath =
  process.platform === "win32"
    ? path.join(__dirname, "assets", "app-icon.ico")
    : path.join(__dirname, "..", "web", "public", "brand", "nexusforge-main-logo.png");
let mainWindow = null;
let startupHealth = {
  mode: "web",
  storageResetAttempted: false,
  storageResetSuccess: false,
  message: "Desktop startup health is not active.",
  timestamp: new Date().toISOString(),
};

if (startUrl.includes("localhost")) {
  const isolatedSessionPath = path.join(app.getPath("temp"), "nexusforge-desktop-dev-session");
  try {
    fs.mkdirSync(isolatedSessionPath, { recursive: true });
    app.setPath("sessionData", isolatedSessionPath);
  } catch (error) {
    console.warn("[NexusForge Desktop] Unable to set isolated dev session path:", error);
  }
}

async function prepareDevSessionStorage() {
  if (!startUrl.includes("localhost")) {
    startupHealth = {
      mode: "web",
      storageResetAttempted: false,
      storageResetSuccess: true,
      message: "Desktop is using a non-local origin. No dev storage reset needed.",
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
    timestamp: new Date().toISOString(),
  };

  try {
    await session.defaultSession.clearStorageData({
      origin,
      storages: ["serviceworkers", "cachestorage", "indexdb"],
    });

    startupHealth = {
      mode: "desktop-dev",
      storageResetAttempted: true,
      storageResetSuccess: true,
      message: "Desktop dev storage reset completed before launch.",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.warn("[NexusForge Desktop] Unable to clear dev session storage:", error);
    startupHealth = {
      mode: "desktop-dev",
      storageResetAttempted: true,
      storageResetSuccess: false,
      message: "Desktop launched with storage reset warning. Review Electron console for details.",
      timestamp: new Date().toISOString(),
    };
  }
}

function resetDevQuotaDatabase() {
  if (!startUrl.includes("localhost")) {
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

// Hard stop duplicate preview instances: one live desktop preview at a time.
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

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Keep the live preview connected while local dev servers restart.
  mainWindow.webContents.on("did-fail-load", (_event, errorCode) => {
    if (!startUrl.includes("localhost")) {
      return;
    }

    // Ignore aborts caused by navigation races; retry network failures.
    if (errorCode === -3) {
      return;
    }

    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        void mainWindow.loadURL(startUrl);
      }
    }, 1000);
  });

  mainWindow.loadURL(startUrl);
}

app.on("second-instance", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
    return;
  }

  createWindow();
});

app.whenReady().then(async () => {
  resetDevQuotaDatabase();
  await prepareDevSessionStorage();

  ipcMain.handle("nexusforge-desktop:get-startup-health", () => startupHealth);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  ipcMain.removeHandler("nexusforge-desktop:get-startup-health");
});