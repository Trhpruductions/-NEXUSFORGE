"use strict";

// The screen-share picker: a small window that lists the screens and windows that can be shared, with previews.
// The page asks to share with getDisplayMedia; main.js's display-media handler calls pick(), and only the source chosen
// here is shared. Cancel, Esc or closing the picker shares nothing. Window titles appear in the picker only; they are
// never logged or sent anywhere.

const path = require("node:path");
const { BrowserWindow, ipcMain, desktopCapturer, screen } = require("electron");
const { describeSources, resolveChoice, sourceKind } = require("./screen-picker-rules");
const { describeSender } = require("./ipc-policy");
const { isBundledPage } = require("./origin-rules");

const PICKER_DIR = path.join(__dirname, "screen-picker");
const PICKER_PAGE = path.join(PICKER_DIR, "picker.html");
const THUMBNAIL_SIZE = { width: 320, height: 180 };
const CHOOSE = "nexusforge-picker:choose";
const CANCEL = "nexusforge-picker:cancel";
const SOURCES = "nexusforge-picker:sources";

let active = null;

/**
 * Shows the picker over `parentWindow` and resolves with { source, kind } for the chosen screen or window, or null when
 * nothing was chosen. Only one picker is open at a time: a second request while one is open is refused (null).
 */
async function pick(parentWindow) {
  if (active && !active.window.isDestroyed()) {
    active.window.focus();
    return null;
  }
  const sources = await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: THUMBNAIL_SIZE, fetchWindowIcons: false });
  const offered = describeSources(sources, screen.getPrimaryDisplay().id);
  if (offered.length === 0) return null;
  const offeredIds = offered.map((item) => item.id);
  const byId = new Map(sources.map((source) => [source.id, source]));

  return new Promise((resolve) => {
    const parent = parentWindow && !parentWindow.isDestroyed() ? parentWindow : undefined;
    const picker = new BrowserWindow({
      parent,
      modal: Boolean(parent),
      width: 880,
      height: 640,
      minWidth: 560,
      minHeight: 420,
      show: false,
      title: "Share your screen",
      backgroundColor: "#020617",
      autoHideMenuBar: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      webPreferences: {
        preload: path.join(PICKER_DIR, "preload.js"),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    const pickerId = picker.webContents.id;
    let settled = false;

    const finish = (sourceId) => {
      if (settled) return;
      settled = true;
      ipcMain.removeListener(CHOOSE, onChoose);
      ipcMain.removeListener(CANCEL, onCancel);
      active = null;
      if (!picker.isDestroyed()) picker.destroy();
      const source = sourceId ? byId.get(sourceId) : null;
      resolve(source ? { source, kind: sourceKind(source.id) } : null);
    };
    // Messages are accepted from this picker window's top frame, showing the bundled picker page, only.
    const fromPicker = (event) => {
      const sender = describeSender(event, (contents) => (contents && contents.id === pickerId ? "picker" : null));
      return Boolean(sender && sender.windowRole === "picker" && sender.isTopFrame && isBundledPage(sender.url, PICKER_PAGE));
    };
    const onChoose = (event, id) => {
      if (!fromPicker(event)) return;
      const chosen = resolveChoice(offeredIds, id);
      if (chosen) finish(chosen);
    };
    const onCancel = (event) => {
      if (fromPicker(event)) finish(null);
    };

    ipcMain.on(CHOOSE, onChoose);
    ipcMain.on(CANCEL, onCancel);
    picker.on("closed", () => finish(null));
    picker.webContents.on("will-navigate", (event) => event.preventDefault());
    picker.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    picker.webContents.once("did-finish-load", () => {
      if (settled) return;
      const items = offered.map((item) => {
        const thumbnail = byId.get(item.id).thumbnail;
        return { ...item, thumbnail: thumbnail && !thumbnail.isEmpty() ? thumbnail.toDataURL() : null };
      });
      picker.webContents.send(SOURCES, items);
      picker.show();
      picker.focus();
    });
    active = { window: picker, finish };
    picker.loadFile(PICKER_PAGE).catch(() => finish(null));
  });
}

module.exports = { pick };
