"use strict";

// The diagnostics log (startup.log) with a size cap. No Electron here, so it can be tested directly.
// The log used to grow without limit: every page console message and every launch-mode poll was appended forever.
// Now the current file is kept under maxBytes; when it would pass that, it becomes startup.log.1 (replacing the
// previous one) and a new file starts, so at most about 2 x maxBytes are kept, the newest lines always included.
// A file already far over the cap (from an older version) keeps only its newest maxBytes as the backup.

const fs = require("node:fs");

const DEFAULT_MAX_BYTES = Math.floor(2.5 * 1024 * 1024);
const MAX_LINE_CHARS = 2000;

function tailCopy(source, target, keepBytes, size) {
  const length = Math.min(keepBytes, size);
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(source, "r");
  try {
    fs.readSync(fd, buffer, 0, length, size - length);
  } finally {
    fs.closeSync(fd);
  }
  // Start at the next full line so the backup does not begin halfway through one.
  const newline = buffer.indexOf(0x0a);
  const body = newline >= 0 && newline < buffer.length - 1 ? buffer.subarray(newline + 1) : buffer;
  fs.writeFileSync(target, body);
  fs.rmSync(source, { force: true });
}

/** Returns { append(text), rotate() }. Errors are swallowed: logging must never break the app. */
function createRotatingLog(filePath, { maxBytes = DEFAULT_MAX_BYTES } = {}) {
  const backupPath = `${filePath}.1`;
  let size = null;

  const currentSize = () => {
    if (size === null) {
      try {
        size = fs.statSync(filePath).size;
      } catch {
        size = 0;
      }
    }
    return size;
  };

  const rotate = () => {
    const existing = currentSize();
    try {
      fs.rmSync(backupPath, { force: true });
      if (existing > maxBytes * 2) tailCopy(filePath, backupPath, maxBytes, existing);
      else fs.renameSync(filePath, backupPath);
    } catch {
      // If the file cannot be moved (locked), start over in place rather than grow without limit.
      try {
        fs.writeFileSync(filePath, "");
      } catch {
        // Nothing more to do.
      }
    }
    size = 0;
  };

  const append = (text) => {
    let line = String(text);
    if (line.length > MAX_LINE_CHARS) line = `${line.slice(0, MAX_LINE_CHARS)}...[truncated]\n`;
    const bytes = Buffer.byteLength(line, "utf8");
    try {
      if (currentSize() > 0 && currentSize() + bytes > maxBytes) rotate();
      fs.appendFileSync(filePath, line, "utf8");
      size = currentSize() + bytes;
    } catch {
      size = null;
    }
  };

  return { append, rotate, path: filePath, backupPath };
}

const CONSOLE_LEVELS_BY_NUMBER = ["debug", "info", "warning", "error"];
const LOGGED_CONSOLE_LEVELS = new Set(["warning", "error"]);
const MAX_CONSOLE_MESSAGE_CHARS = 500;

/**
 * The startup.log line for a page console message, or null when it is not logged. Only warnings and errors are kept
 * (info and debug messages are the page's own chatter and can contain user content), messages are shortened, and the
 * source address loses its query and fragment.
 */
function formatConsoleMessage({ level, message, lineNumber, sourceId }) {
  const name = typeof level === "number" ? CONSOLE_LEVELS_BY_NUMBER[level] : String(level || "");
  if (!LOGGED_CONSOLE_LEVELS.has(name)) return null;
  let text = String(message ?? "").replace(/\s+/g, " ").trim();
  if (text.length > MAX_CONSOLE_MESSAGE_CHARS) text = `${text.slice(0, MAX_CONSOLE_MESSAGE_CHARS)}...`;
  let source = String(sourceId ?? "");
  try {
    const url = new URL(source);
    source = `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    source = source.split(/[?#]/)[0];
  }
  return `[renderer-console] level=${name} line=${Number(lineNumber) || 0} source=${source} msg=${text}`;
}

module.exports = { DEFAULT_MAX_BYTES, createRotatingLog, formatConsoleMessage };
