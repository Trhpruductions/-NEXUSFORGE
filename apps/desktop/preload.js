const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nexusforgeDesktop", {
  platform: process.platform,
  runtime: "electron",
  // What this version can do, so the website can show only what works here (1.0.16+; fullscreen-state 1.0.17+).
  features: ["popouts", "titlebar", "window-reset", "fullscreen-state"],
  resetWindowLayout: () => ipcRenderer.invoke("nexusforge-desktop:reset-window-layout"),
  isFullScreen: () => ipcRenderer.invoke("nexusforge-desktop:is-fullscreen"),
  onFullScreenChange: (callback) => {
    const handler = (_event, fullScreen) => callback(Boolean(fullScreen));
    ipcRenderer.on("nexusforge-desktop:fullscreen", handler);
    return () => ipcRenderer.removeListener("nexusforge-desktop:fullscreen", handler);
  },
  getStartupHealth: () => ipcRenderer.invoke("nexusforge-desktop:get-startup-health"),
  // Splash screen buttons only ("minimize" or "close"); main.js ignores it from any other window.
  splashControl: (action) => ipcRenderer.send("nexusforge-desktop:splash-control", action === "close" ? "close" : "minimize"),
  getLocalStackStatus: () => ipcRenderer.invoke("nexusforge-desktop:get-local-stack-status"),
  getUpdateState: () => ipcRenderer.invoke("nexusforge-desktop:get-update-state"),
  getPricingCatalog: () => ipcRenderer.invoke("nexusforge-desktop:get-pricing-catalog"),
  getDesktopPreferences: () => ipcRenderer.invoke("nexusforge-desktop:get-desktop-preferences"),
  updateDesktopPreferences: (patch) => ipcRenderer.invoke("nexusforge-desktop:update-desktop-preferences", patch),
  checkUpdatesNow: () => ipcRenderer.invoke("nexusforge-desktop:check-updates-now"),
  downloadUpdateNow: () => ipcRenderer.invoke("nexusforge-desktop:download-update-now"),
  resolveUpdatePrompt: (choice) => ipcRenderer.invoke("nexusforge-desktop:resolve-update-prompt", choice),
  restartForUpdate: () => ipcRenderer.invoke("nexusforge-desktop:restart-for-update"),
  startLocalStack: () => ipcRenderer.invoke("nexusforge-desktop:start-local-stack"),
  setWorkspacePath: (workspacePath) => ipcRenderer.invoke("nexusforge-desktop:set-workspace-path", workspacePath),
  retryAppLoad: () => ipcRenderer.invoke("nexusforge-desktop:retry-app-load"),
  openLocalStackLog: () => ipcRenderer.invoke("nexusforge-desktop:open-local-stack-log"),
  runMaintenance: () => ipcRenderer.invoke("nexusforge-desktop:run-maintenance"),
  reloadWindow: () => ipcRenderer.invoke("nexusforge-desktop:reload-window"),
  restartCleanSession: () => ipcRenderer.invoke("nexusforge-desktop:restart-clean-session"),
  onUpdateState: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("nexusforge-desktop:update-state", handler);
    return () => ipcRenderer.removeListener("nexusforge-desktop:update-state", handler);
  },
  onStartupState: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("nexusforge-desktop:startup-state", handler);
    return () => ipcRenderer.removeListener("nexusforge-desktop:startup-state", handler);
  },
});