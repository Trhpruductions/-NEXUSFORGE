const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nexusforgeDesktop", {
  platform: process.platform,
  runtime: "electron",
  getStartupHealth: () => ipcRenderer.invoke("nexusforge-desktop:get-startup-health"),
  getLocalStackStatus: () => ipcRenderer.invoke("nexusforge-desktop:get-local-stack-status"),
  getUpdateState: () => ipcRenderer.invoke("nexusforge-desktop:get-update-state"),
  checkUpdatesNow: () => ipcRenderer.invoke("nexusforge-desktop:check-updates-now"),
  restartForUpdate: () => ipcRenderer.invoke("nexusforge-desktop:restart-for-update"),
  startLocalStack: () => ipcRenderer.invoke("nexusforge-desktop:start-local-stack"),
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
});