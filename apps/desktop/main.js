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
  sessionDataPath: app.getPath("sessionData"),
  lastMaintenanceAction: "none",
  maintenanceHistory: [],
  timestamp: new Date().toISOString(),
};
let isolatedSessionPath = null;

function appendMaintenanceHistory(entry) {
  const nextHistory = [entry, ...(startupHealth.maintenanceHistory ?? [])].slice(0, 8);
  startupHealth = {
    ...startupHealth,
    maintenanceHistory: nextHistory,
  };
}

if (startUrl.includes("localhost")) {
  isolatedSessionPath = path.join(app.getPath("temp"), "nexusforge-desktop-dev-session");
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

  startupHealth = {
    ...startupHealth,
    lastMaintenanceAction: "startup",
    maintenanceHistory: startupHealth.maintenanceHistory,
    timestamp: new Date().toISOString(),
  };

  ipcMain.handle("nexusforge-desktop:get-startup-health", () => startupHealth);
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
      await mainWindow.webContents.loadURL(startUrl);
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
  ipcMain.removeHandler("nexusforge-desktop:run-maintenance");
  ipcMain.removeHandler("nexusforge-desktop:reload-window");
  ipcMain.removeHandler("nexusforge-desktop:restart-clean-session");
});