const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nexusforgeDesktop", {
  platform: process.platform,
  runtime: "electron",
  getStartupHealth: () => ipcRenderer.invoke("nexusforge-desktop:get-startup-health"),
  runMaintenance: () => ipcRenderer.invoke("nexusforge-desktop:run-maintenance"),
  reloadWindow: () => ipcRenderer.invoke("nexusforge-desktop:reload-window"),
});