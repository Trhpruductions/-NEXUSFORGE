"use strict";

// Integrity checks for the desktop updater. No Electron here, so the checks can be tested directly.
// A manifest hash must be exactly 64 hexadecimal characters after trimming. Anything else refuses the update.
// An installer runs only after it has passed the check immediately before launch, not only after download.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SHA256 = /^[0-9a-f]{64}$/i;

// The hash to compare against, lower case, or null when the manifest value is missing or not a valid SHA-256 hex string.
function normalizeSha256(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return SHA256.test(trimmed) ? trimmed.toLowerCase() : null;
}

function isValidSha256(value) {
  return normalizeSha256(value) !== null;
}

function computeSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

// Checks a file against the manifest hash. Refuses when the hash is missing or malformed (the file is not read),
// when the file is missing, and when the hashes differ. A file is only ever reported ok when its hash matches.
async function verifyInstallerIntegrity(filePath, manifestSha256) {
  const expected = normalizeSha256(manifestSha256);
  if (expected === null) {
    return {
      ok: false,
      code: "no-valid-hash",
      reason: "The update manifest has no valid SHA-256 hash, so the installer cannot be verified. The update was refused.",
    };
  }
  let actual;
  try {
    actual = await computeSha256(filePath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { ok: false, code: "missing-file", reason: "The downloaded installer is missing, so it cannot be verified." };
    }
    throw error;
  }
  if (actual !== expected) {
    return {
      ok: false,
      code: "mismatch",
      reason: "The downloaded installer does not match the SHA-256 hash in the update manifest. It was discarded.",
    };
  }
  return { ok: true, code: "match", sha256: actual };
}

// Runs launch() only when the file verifies right now. The check happens here, immediately before launch, so a file
// that changed after download is never run. Returns { launched, reason }.
async function runIfVerified(filePath, manifestSha256, launch) {
  const check = await verifyInstallerIntegrity(filePath, manifestSha256);
  if (!check.ok) return { launched: false, code: check.code, reason: check.reason };
  launch();
  return { launched: true, code: "launched", reason: null };
}

// Deletes a file only when it is the one this update operation downloaded (ownedPath). Any other path is left alone.
function discardOwnedInstaller(filePath, ownedPath) {
  if (!filePath || !ownedPath || path.resolve(filePath) !== path.resolve(ownedPath)) return false;
  try {
    fs.rmSync(path.resolve(filePath), { force: true });
    return true;
  } catch {
    return false;
  }
}

module.exports = { normalizeSha256, isValidSha256, computeSha256, verifyInstallerIntegrity, runIfVerified, discardOwnedInstaller };
