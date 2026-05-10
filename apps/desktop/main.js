const { app, BrowserWindow, shell, session } = require("electron");
const path = require("node:path");

const startUrl = process.env.NEXUSFORGE_DESKTOP_URL || "http://localhost:3000/app";
const appIconPath =
  process.platform === "win32"
    ? path.join(__dirname, "assets", "app-icon.ico")
    : path.join(__dirname, "..", "web", "public", "brand", "nexusforge-main-logo.png");
let mainWindow = null;

async function prepareDevSessionStorage() {
  if (!startUrl.includes("localhost")) {
    return;
  }

  const origin = new URL(startUrl).origin;

  try {
    await session.defaultSession.clearStorageData({
      origin,
      storages: ["serviceworkers", "cachestorage", "indexdb"],
    });
  } catch (error) {
    console.warn("[NexusForge Desktop] Unable to clear dev session storage:", error);
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
  await prepareDevSessionStorage();
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