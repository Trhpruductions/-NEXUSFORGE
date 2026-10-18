"use strict";

// Downloads an update installer to disk with limits. No Electron here, so it can be tested against a local server.
// On top of the SHA-256 check in integrity.js (which still runs after every download and again before launch):
//   - a download that receives no bytes for STALL_TIMEOUT_MS is aborted (it used to wait forever, which also blocked
//     every later update attempt because "downloading" never cleared),
//   - a response that takes longer than RESPONSE_TIMEOUT_MS to start is aborted,
//   - an installer larger than MAX_INSTALLER_BYTES is refused, whether the server announces the size or not,
//   - a body shorter than the size the server announced is refused,
//   - the partial file is always removed when a download does not finish.

const fs = require("node:fs");
const path = require("node:path");

const MAX_INSTALLER_BYTES = 300 * 1024 * 1024;
const STALL_TIMEOUT_MS = 60 * 1000;
const RESPONSE_TIMEOUT_MS = 15 * 1000;
const PARTIAL_SUFFIX = ".download";

class UpdateDownloadError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "UpdateDownloadError";
    this.code = code;
  }
}

/** The announced size in bytes, or null when the header is missing or not a plain non-negative integer. */
function parseContentLength(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!/^\d{1,16}$/.test(text)) return null;
  const bytes = Number(text);
  return Number.isSafeInteger(bytes) ? bytes : null;
}

/** The packaged app only downloads installers over https. Dev builds may also use http (local test servers). */
function isAcceptableDownloadUrl(value, { isPackaged }) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  return !isPackaged && url.protocol === "http:";
}

function removeQuietly(filePath) {
  try {
    fs.rmSync(filePath, { force: true });
  } catch {
    // Best effort: a locked partial file is retried on the next download.
  }
}

/** Removes partial downloads (*.download) left in `dir` by an earlier run that was closed mid-download. */
function removeStalePartialDownloads(dir) {
  let removed = 0;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(PARTIAL_SUFFIX)) {
      removeQuietly(path.join(dir, entry.name));
      removed += 1;
    }
  }
  return removed;
}

/**
 * Downloads `url` to `destinationPath`. Bytes go to `${destinationPath}.download` first and are renamed into place
 * only when the whole body arrived. Resolves { path, bytes }; rejects with UpdateDownloadError (code: http-status,
 * too-large, stalled, no-response, incomplete, failed) and leaves no partial file behind.
 */
async function downloadToFile({
  url,
  destinationPath,
  fetchImpl = globalThis.fetch,
  maxBytes = MAX_INSTALLER_BYTES,
  stallTimeoutMs = STALL_TIMEOUT_MS,
  responseTimeoutMs = RESPONSE_TIMEOUT_MS,
  onProgress,
}) {
  const tempPath = `${destinationPath}${PARTIAL_SUFFIX}`;
  const controller = new AbortController();
  let timer = null;
  let timeoutError = null;
  const arm = (ms, code, message) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timeoutError = new UpdateDownloadError(code, message);
      controller.abort();
    }, ms);
  };

  let handle = null;
  let finished = false;
  try {
    arm(responseTimeoutMs, "no-response", `The update server did not respond within ${Math.round(responseTimeoutMs / 1000)} seconds.`);
    const response = await fetchImpl(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok || !response.body) {
      throw new UpdateDownloadError("http-status", `Installer download failed (${response.status}).`);
    }
    const announced = parseContentLength(response.headers.get("content-length"));
    if (announced !== null && announced > maxBytes) {
      throw new UpdateDownloadError("too-large", `The installer is larger than the ${Math.round(maxBytes / 1048576)} MB limit, so it was not downloaded.`);
    }

    // A compressed response announces the compressed size, and fetch hands over the decompressed bytes, so the exact
    // size checks only apply to uncompressed bodies. (A compressed size above the limit was already refused.)
    const encoding = String(response.headers.get("content-encoding") || "identity").trim().toLowerCase();
    const declared = encoding === "identity" ? announced : null;

    handle = fs.openSync(tempPath, "w");
    const reader = response.body.getReader();
    let received = 0;
    while (true) {
      arm(stallTimeoutMs, "stalled", `The download stopped receiving data for ${Math.round(stallTimeoutMs / 1000)} seconds and was cancelled.`);
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.length === 0) continue;
      received += value.length;
      if (received > maxBytes) {
        throw new UpdateDownloadError("too-large", `The installer is larger than the ${Math.round(maxBytes / 1048576)} MB limit; the download was cancelled.`);
      }
      if (declared !== null && received > declared) {
        throw new UpdateDownloadError("incomplete", "The server sent more data than it announced; the download was cancelled.");
      }
      fs.writeSync(handle, value);
      if (typeof onProgress === "function") onProgress(received, declared);
    }
    clearTimeout(timer);
    if (declared !== null && received !== declared) {
      throw new UpdateDownloadError("incomplete", "The download ended before the whole installer arrived.");
    }
    fs.closeSync(handle);
    handle = null;
    fs.renameSync(tempPath, destinationPath);
    finished = true;
    return { path: destinationPath, bytes: received };
  } catch (error) {
    if (timeoutError) throw timeoutError;
    if (error instanceof UpdateDownloadError) throw error;
    throw new UpdateDownloadError("failed", `Installer download failed: ${error && error.message ? error.message : String(error)}`);
  } finally {
    clearTimeout(timer);
    if (!finished) controller.abort();
    if (handle !== null) {
      try {
        fs.closeSync(handle);
      } catch {
        // Already closed.
      }
    }
    if (!finished) removeQuietly(tempPath);
  }
}

module.exports = {
  MAX_INSTALLER_BYTES,
  STALL_TIMEOUT_MS,
  RESPONSE_TIMEOUT_MS,
  PARTIAL_SUFFIX,
  UpdateDownloadError,
  parseContentLength,
  isAcceptableDownloadUrl,
  removeStalePartialDownloads,
  downloadToFile,
};
