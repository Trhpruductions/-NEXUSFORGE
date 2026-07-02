import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const repoRoot = process.cwd();
const latestInstallerName = "NexusForge Desktop Setup Latest.exe";

function parseArgs(argv) {
  const options = {
    releaseDir: path.join(repoRoot, "apps", "desktop", "release"),
    reportPath: "",
    manifestPath: "",
    allowMissingReport: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--release-dir") {
      const value = argv[index + 1];
      if (!value) {
        fail("--release-dir requires a value");
      }
      options.releaseDir = path.resolve(repoRoot, value);
      index += 1;
      continue;
    }

    if (arg === "--manifest-path") {
      const value = argv[index + 1];
      if (!value) {
        fail("--manifest-path requires a value");
      }
      options.manifestPath = path.resolve(repoRoot, value);
      index += 1;
      continue;
    }

    if (arg === "--report-path") {
      const value = argv[index + 1];
      if (!value) {
        fail("--report-path requires a value");
      }
      options.reportPath = path.resolve(repoRoot, value);
      index += 1;
      continue;
    }

    if (arg === "--allow-missing-report") {
      options.allowMissingReport = true;
      continue;
    }

    fail(`unknown argument: ${arg}`);
  }

  if (!options.manifestPath) {
    options.manifestPath = path.join(options.releaseDir, "desktop-update.json");
  }

  if (!options.reportPath) {
    options.reportPath = path.join(options.releaseDir, "artifact-integrity-latest.json");
  }

  return options;
}

function fail(message) {
  console.error(`[desktop-artifact-consistency] FAIL: ${message}`);
  process.exit(1);
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} not found: ${filePath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`${label} is not valid JSON: ${message}`);
  }
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex").toLowerCase();
}

function installerNameFromUrl(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  try {
    const parsed = new URL(text, "https://nexusforge.local");
    const parsedPath = decodeURIComponent(parsed.pathname || "");
    return path.posix.basename(parsedPath);
  } catch {
    return "";
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = readJson(options.manifestPath, "desktop release manifest");

  const manifestVersion = String(manifest.version || "").trim();
  if (!/^\d+\.\d+\.\d+$/u.test(manifestVersion)) {
    fail(`manifest version must be semver (x.y.z), got '${manifestVersion || "<empty>"}'`);
  }

  const expectedVersionedInstallerName = `NexusForge Desktop Setup ${manifestVersion}.exe`;
  const expectedVersionedInstallerPath = path.join(options.releaseDir, expectedVersionedInstallerName);
  const latestInstallerPath = path.join(options.releaseDir, latestInstallerName);

  if (!fs.existsSync(expectedVersionedInstallerPath)) {
    fail(`versioned installer missing for manifest version ${manifestVersion}: ${expectedVersionedInstallerPath}`);
  }

  if (!fs.existsSync(latestInstallerPath)) {
    fail(`latest installer alias missing: ${latestInstallerPath}`);
  }

  const versionedInstallerHash = sha256File(expectedVersionedInstallerPath);
  const latestInstallerHash = sha256File(latestInstallerPath);

  if (versionedInstallerHash !== latestInstallerHash) {
    fail(
      `latest installer drift detected: ${latestInstallerName} hash ${latestInstallerHash} does not match ${expectedVersionedInstallerName} hash ${versionedInstallerHash}`,
    );
  }

  const manifestSha = String(manifest.sha256 || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(manifestSha)) {
    fail("manifest sha256 must be a 64-character hex string");
  }

  if (manifestSha !== versionedInstallerHash) {
    fail(
      `manifest sha256 mismatch: manifest=${manifestSha} expected=${versionedInstallerHash} for ${expectedVersionedInstallerName}`,
    );
  }

  const reportExists = fs.existsSync(options.reportPath);
  if (!reportExists && !options.allowMissingReport) {
    fail(`artifact integrity report not found: ${options.reportPath}`);
  }

  let appAsarSha = "n/a";
  if (reportExists) {
    const report = readJson(options.reportPath, "artifact integrity report");
    const reportInstallerName = String(report?.installer?.fileName || "").trim();
    const reportInstallerSha = String(report?.installer?.sha256 || "").trim().toLowerCase();

    if (!reportInstallerName || !/^[a-f0-9]{64}$/u.test(reportInstallerSha)) {
      fail("artifact report installer metadata is missing or invalid");
    }

    if (reportInstallerName !== expectedVersionedInstallerName && reportInstallerName !== latestInstallerName) {
      fail(
        `artifact report installer fileName mismatch: got '${reportInstallerName}', expected '${expectedVersionedInstallerName}' or '${latestInstallerName}'`,
      );
    }

    if (reportInstallerSha !== versionedInstallerHash) {
      fail(`artifact report installer hash mismatch: report=${reportInstallerSha} expected=${versionedInstallerHash}`);
    }

    const appAsarPath = String(report?.appAsar?.fullPath || "").trim();
    appAsarSha = String(report?.appAsar?.sha256 || "").trim().toLowerCase();
    if (!appAsarPath || !/^[a-f0-9]{64}$/u.test(appAsarSha)) {
      fail("artifact report app.asar metadata is missing or invalid");
    }
    if (!fs.existsSync(appAsarPath)) {
      fail(`artifact report app.asar path does not exist: ${appAsarPath}`);
    }

    const actualAppAsarSha = sha256File(appAsarPath);
    if (actualAppAsarSha !== appAsarSha) {
      fail(`app.asar hash drift detected: report=${appAsarSha} actual=${actualAppAsarSha}`);
    }
  }

  const minInstallerBytesRaw = process.env.NEXUSFORGE_MIN_INSTALLER_BYTES;
  const minAppAsarBytesRaw = process.env.NEXUSFORGE_MIN_APP_ASAR_BYTES;
  const minInstallerBytes = Number.isFinite(Number(minInstallerBytesRaw))
    ? Math.max(1, Number(minInstallerBytesRaw))
    : 40 * 1024 * 1024;
  const minAppAsarBytes = Number.isFinite(Number(minAppAsarBytesRaw))
    ? Math.max(1, Number(minAppAsarBytesRaw))
    : 10 * 1024 * 1024;

  const versionedSize = fs.statSync(expectedVersionedInstallerPath).size;
  const latestSize = fs.statSync(latestInstallerPath).size;
  if (versionedSize < minInstallerBytes) {
    fail(`versioned installer too small: ${versionedSize} bytes (minimum ${minInstallerBytes})`);
  }
  if (latestSize < minInstallerBytes) {
    fail(`latest installer too small: ${latestSize} bytes (minimum ${minInstallerBytes})`);
  }

  if (reportExists) {
    const report = readJson(options.reportPath, "artifact integrity report");
    const appAsarPath = String(report?.appAsar?.fullPath || "").trim();
    const appAsarSize = fs.statSync(appAsarPath).size;
    if (appAsarSize < minAppAsarBytes) {
      fail(`app.asar too small: ${appAsarSize} bytes (minimum ${minAppAsarBytes})`);
    }
  }

  const downloadUrlInstaller = installerNameFromUrl(manifest.downloadUrl);
  const downloadUrls = Array.isArray(manifest.downloadUrls) ? manifest.downloadUrls : [];
  const normalizedDownloadInstallers = [downloadUrlInstaller, ...downloadUrls.map(installerNameFromUrl)].filter(Boolean);

  if (!normalizedDownloadInstallers.includes(latestInstallerName)) {
    fail(`manifest download URLs must include ${latestInstallerName}`);
  }

  if (!normalizedDownloadInstallers.includes(expectedVersionedInstallerName)) {
    fail(`manifest download URLs must include ${expectedVersionedInstallerName}`);
  }

  console.log(`[desktop-artifact-consistency] Manifest version: ${manifestVersion}`);
  console.log(`[desktop-artifact-consistency] Release directory: ${options.releaseDir}`);
  console.log(`[desktop-artifact-consistency] Installer hash: ${versionedInstallerHash}`);
  if (reportExists) {
    console.log(`[desktop-artifact-consistency] app.asar hash: ${appAsarSha}`);
  } else {
    console.log("[desktop-artifact-consistency] app.asar hash: skipped (report missing by override)");
  }
  console.log("[desktop-artifact-consistency] PASS");
}

main();
