import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const releaseDir = path.join(repoRoot, "apps", "desktop", "release");
const appAsarPath = path.join(releaseDir, "win-unpacked", "resources", "app.asar");
const reportPath = path.join(releaseDir, "artifact-integrity-latest.json");

function fail(message) {
  console.error(`[desktop-artifact-report] FAIL: ${message}`);
  process.exit(1);
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest("hex");
}

function getLatestInstaller() {
  if (!fs.existsSync(releaseDir)) {
    return null;
  }

  const entries = fs
    .readdirSync(releaseDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^NexusForge Desktop Setup .*\.exe$/u.test(name));

  if (entries.length === 0) {
    return null;
  }

  const files = entries
    .map((name) => {
      const fullPath = path.join(releaseDir, name);
      const stat = fs.statSync(fullPath);
      return {
        name,
        fullPath,
        mtimeMs: stat.mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return files[0];
}

function runPackagedSplashVerification() {
  const verifyScriptPath = path.join(repoRoot, "scripts", "verify-desktop-splash-assets.mjs");
  const result = spawnSync(process.execPath, [verifyScriptPath, "--require-packaged"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });

  const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  const exitCode = Number.isInteger(result.status) ? result.status : 1;

  return {
    passed: exitCode === 0,
    exitCode,
    output,
  };
}

const installer = getLatestInstaller();
if (!installer) {
  fail(`no installer found in ${releaseDir}`);
}

if (!fs.existsSync(appAsarPath)) {
  fail(`packaged app archive not found: ${appAsarPath}`);
}

const splashVerification = runPackagedSplashVerification();

const installerStat = fs.statSync(installer.fullPath);
const asarStat = fs.statSync(appAsarPath);

const report = {
  generatedAt: new Date().toISOString(),
  releaseDirectory: releaseDir,
  installer: {
    fileName: installer.name,
    fullPath: installer.fullPath,
    sizeBytes: installerStat.size,
    sha256: sha256File(installer.fullPath),
  },
  appAsar: {
    fullPath: appAsarPath,
    sizeBytes: asarStat.size,
    sha256: sha256File(appAsarPath),
  },
  splashVerification,
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(`[desktop-artifact-report] Report saved: ${reportPath}`);
console.log(`[desktop-artifact-report] Installer SHA256: ${report.installer.sha256}`);
console.log(`[desktop-artifact-report] app.asar SHA256: ${report.appAsar.sha256}`);

if (!splashVerification.passed) {
  fail(`packaged splash verification failed (exit ${splashVerification.exitCode})`);
}

console.log("[desktop-artifact-report] PASS");
