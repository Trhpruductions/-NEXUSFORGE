import { spawnSync } from "node:child_process";

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

try {
  // Uses the resilient root build script with targeted Next.js transient retry behavior.
  runChecked("Building workspace", ["run", "build"]);
  runDesktopPackageWithRetry();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[desktop-installer] FAIL: ${message}`);
  process.exit(1);
}
