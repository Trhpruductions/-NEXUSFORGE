"use strict";

// The picker window's only bridge: receive the list of sources, and send back a choice or a cancel.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nexusforgePicker", {
  onSources: (callback) => {
    ipcRenderer.on("nexusforge-picker:sources", (_event, items) => callback(items));
  },
  choose: (id) => ipcRenderer.send("nexusforge-picker:choose", String(id)),
  cancel: () => ipcRenderer.send("nexusforge-picker:cancel"),
});
