import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function runNpm(args) {
  const isWindows = process.platform === "win32";
  const quoteArg = (arg) => {
    const value = String(arg);
    return /[\s"']/u.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
  };

  const result = isWindows
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", `npm ${args.map(quoteArg).join(" ")}`], {
        cwd: process.cwd(),
        shell: false,
        encoding: "utf8",
      })
    : spawnSync("npm", args, {
        cwd: process.cwd(),
        shell: false,
        encoding: "utf8",
      });

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  if (stdout) {
    process.stdout.write(stdout);
  }
  if (stderr) {
    process.stderr.write(stderr);
  }

  if (result.error) {
    throw result.error;
  }

  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  return {
    exitCode,
    combinedOutput: `${stdout}\n${stderr}`,
  };
}

function runChecked(label, args) {
  console.log(`[desktop-installer] ${label}`);
  const { exitCode } = runNpm(args);
  if (exitCode !== 0) {
    throw new Error(`Command failed (exit ${exitCode}): npm ${args.join(" ")}`);
  }
}

function tryWindowsPackagingUnlock() {
  if (process.platform !== "win32") {
    return;
  }

  console.log("[desktop-installer] Attempting Windows packaging unlock cleanup.");
  spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      "$targets = @('NexusForge Desktop','electron'); foreach ($name in $targets) { Get-Process -Name $name -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue }",
    ],
    {
      cwd: process.cwd(),
      shell: false,
      stdio: "inherit",
    },
  );
}

function runDesktopPackageWithRetry() {
  const args = ["run", "package:win", "-w", "@nexusforge/desktop"];
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    console.log(`[desktop-installer] Packaging Windows installer (attempt ${attempt}/${maxAttempts})`);
    const { exitCode, combinedOutput } = runNpm(args);

    if (exitCode === 0) {
      return;
    }

    const lockPattern = /Access is denied|ERR_ELECTRON_BUILDER_CANNOT_EXECUTE|win-unpacked/i;
    const looksLikeLockIssue = lockPattern.test(combinedOutput);
    if (attempt < maxAttempts && looksLikeLockIssue) {
      tryWindowsPackagingUnlock();
      continue;
    }

    throw new Error(`Command failed (exit ${exitCode}): npm ${args.join(" ")}`);
  }
}

function syncLatestInstallerAlias() {
  const releaseDir = path.join(process.cwd(), "apps", "desktop", "release");
  const latestName = "NexusForge Desktop Setup Latest.exe";
  const versionedPattern = /^NexusForge Desktop Setup \d+\.\d+\.\d+\.exe$/u;

  if (!fs.existsSync(releaseDir)) {
    throw new Error(`Release directory not found: ${releaseDir}`);
  }

  const candidates = fs
    .readdirSync(releaseDir)
    .filter((name) => versionedPattern.test(name))
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

  if (candidates.length === 0) {
    throw new Error(`No versioned installer found in ${releaseDir}`);
  }

  const selected = candidates[0];
  const latestPath = path.join(releaseDir, latestName);
  fs.copyFileSync(selected.fullPath, latestPath);
  console.log(`[desktop-installer] Synced latest installer alias: ${selected.name} -> ${latestName}`);

  return {
    releaseDir,
    latestPath,
    versionedName: selected.name,
    versionedPath: selected.fullPath,
  };
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex").toLowerCase();
}

function refreshReleaseManifestSha(installerInfo) {
  const manifestPath = path.join(installerInfo.releaseDir, "desktop-update.json");
  if (!fs.existsSync(manifestPath)) {
    console.warn(`[desktop-installer] Skipping release manifest refresh; file not found: ${manifestPath}`);
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse release manifest at ${manifestPath}: ${message}`);
  }

  const installerHash = sha256File(installerInfo.versionedPath);
  manifest.sha256 = installerHash;

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`[desktop-installer] Refreshed release manifest sha256 at ${manifestPath}`);
}

try {
  // Uses the resilient root build script with targeted Next.js transient retry behavior.
  runChecked("Building workspace", ["run", "build"]);
  runDesktopPackageWithRetry();
  const installerInfo = syncLatestInstallerAlias();
  refreshReleaseManifestSha(installerInfo);
  runChecked("Verifying packaged splash assets", ["run", "desktop:splash:verify:strict"]);
  runChecked("Generating desktop artifact integrity report", ["run", "desktop:artifact:report"]);
  runChecked("Validating desktop artifact consistency", ["run", "desktop:artifact:validate"]);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[desktop-installer] FAIL: ${message}`);
  process.exit(1);
}
