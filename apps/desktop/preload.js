const { contextBridge, ipcRenderer } = require("electron");

// The bridge is exposed only to pages main.js trusts: the hosted app (and, in a dev build, local dev servers) and
// the bundled splash and local-recovery pages. main.js passes that scope as an argument (lib/origin-rules.js,
// bridgeScope). Any other page in the window (the offline page, a browser error page, a site the window was sent to
// by mistake) gets no bridge. main.js checks the sender of every request again, so this is a second line of defence.
// A sandboxed preload cannot load other files, so this check is written out here; test/preload-gate.test.js keeps it
// in step with origin-rules.js.
const SCOPE_ARG = "--nexusforge-bridge-scope=";

function readBridgeScope() {
  const argv = Array.isArray(process.argv) ? process.argv : [];
  const arg = argv.find((value) => typeof value === "string" && value.startsWith(SCOPE_ARG));
  if (!arg) return null;
  try {
    return JSON.parse(decodeURIComponent(arg.slice(SCOPE_ARG.length)));
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname) {
  const host = String(hostname || "")
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  return host === "localhost" || host.endsWith(".localhost") || host === "::1" || /^127(?:\.\d{1,3}){3}$/.test(host);
}

function bridgeAllowedHere(scope, place) {
  if (!scope || !place) return false;
  try {
    if (place.protocol === "https:" || place.protocol === "http:") {
      if (Array.isArray(scope.origins) && scope.origins.includes(place.origin)) return true;
      return scope.loopback === true && isLoopbackHostname(place.hostname);
    }
    if (place.protocol === "file:") {
      let key = `${place.host}|${decodeURIComponent(place.pathname)}`;
      if (scope.caseInsensitive) key = key.toLowerCase();
      return Array.isArray(scope.pages) && scope.pages.includes(key);
    }
  } catch {
    return false;
  }
  return false;
}

if (bridgeAllowedHere(readBridgeScope(), typeof window !== "undefined" ? window.location : null)) {
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
    // Dev builds only, from the bundled local-recovery page; the packaged app refuses these.
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
}
