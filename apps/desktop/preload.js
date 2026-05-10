const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nexusforgeDesktop", {
  platform: process.platform,
  runtime: "electron",
  getStartupHealth: () => ipcRenderer.invoke("nexusforge-desktop:get-startup-health"),
});