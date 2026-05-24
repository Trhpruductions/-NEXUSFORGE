import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const transientWebBuildPatterns = [
  /Cannot find module for page:\s*\/favicon\.ico/i,
  /Failed to collect page data for\s*\/favicon\.ico/i,
  /Cannot find module for page:\s*\/_document/i,
  /PageNotFoundError[\s\S]*\/_document/i,
  /Cannot find module ['"].*\.next-build[\\\/]server[\\\/]next-font-manifest\.json['"]/i,
  /Cannot find module ['"].*next-font-manifest\.json['"]/i,
];

function cleanWebBuildArtifacts() {
  const webBuildPath = path.join(process.cwd(), "apps", "web", ".next-build");
  const nextPath = path.join(process.cwd(), "apps", "web", ".next");

  for (const target of [webBuildPath, nextPath]) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`[build-workspace] Removed stale build artifact: ${target}`);
    } catch (error) {
      console.warn(`[build-workspace] Failed to remove stale build artifact: ${target}`);
      console.warn(error);
    }
  }
}

function buildNpmExecutionCandidates(args) {
  const isWindows = process.platform === "win32";
  const npmExecPath = String(process.env.npm_execpath || "").trim();
  const quoteArg = (arg) => {
    const value = String(arg);
    return /[\s"']/u.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
  };

  const quotedArgs = args.map(quoteArg).join(" ");
  const candidates = [];

  // Windows can have multiple valid npm runners depending on how Node/npm was installed
  // and whether the process is launched from a shell or a package manager wrapper.
  // Try the reliable cmd.exe shell form first, then fallback to npm_execpath/npm.cmd/npm.
  if (isWindows) {
    candidates.push({ command: "cmd.exe", args: ["/d", "/s", "/c", `npm ${quotedArgs}`] });
    if (npmExecPath) {
      if (/\.(?:mjs|js)$/i.test(npmExecPath)) {
        candidates.push({ command: process.execPath, args: [npmExecPath, ...args] });
      } else {
        candidates.push({ command: npmExecPath, args });
      }
    }
    candidates.push({ command: "npm.cmd", args });
    candidates.push({ command: "npm", args });
  } else {
    if (npmExecPath) {
      if (/\.(?:mjs|js)$/i.test(npmExecPath)) {
        candidates.push({ command: process.execPath, args: [npmExecPath, ...args] });
      } else {
        candidates.push({ command: npmExecPath, args });
      }
    }
    candidates.push({ command: "npm", args });
  }

  return candidates;
}

function isWindowsNpmInvocationError(result, stderr) {
  if (result.error) {
    return true;
  }

  if (typeof stderr !== "string") {
    return false;
  }

  return /The system cannot find the file specified|spawn .* ENOENT|not recognized as an internal or external command/i.test(stderr);
}

function runNpm(args) {
  const isWindows = process.platform === "win32";
  const candidates = buildNpmExecutionCandidates(args);
  let lastResult = null;

  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, candidate.args, {
      cwd: process.cwd(),
      shell: false,
      encoding: "utf8",
    });

    lastResult = result;
    const stdout = result.stdout || "";
    const stderr = result.stderr || "";
    const combinedOutput = `${stdout}\n${stderr}`;
    const exitCode = Number.isInteger(result.status) ? result.status : 1;

    if (stdout) {
      process.stdout.write(stdout);
    }
    if (stderr) {
      process.stderr.write(stderr);
    }

    if (!isWindows || !isWindowsNpmInvocationError(result, stderr)) {
      if (result.error) {
        throw result.error;
      }
      if (candidate.command !== "cmd.exe") {
        console.log(`[build-workspace] NPM invocation succeeded with ${candidate.command}.`);
      }
      return { exitCode, combinedOutput };
    }

    console.warn(`[build-workspace] NPM invocation with ${candidate.command} failed; trying next candidate.`);
  }

  if (lastResult?.error) {
    throw lastResult.error;
  }

  const finalStdout = lastResult?.stdout || "";
  const finalStderr = lastResult?.stderr || "";
  return {
    exitCode: Number.isInteger(lastResult?.status) ? lastResult.status : 1,
    combinedOutput: `${finalStdout}\n${finalStderr}`,
  };
}

function runChecked(label, args) {
  console.log(`[build-workspace] ${label}`);
  const { exitCode } = runNpm(args);
  if (exitCode !== 0) {
    throw new Error(`Command failed (exit ${exitCode}): npm ${args.join(" ")}`);
  }
}

function runWebBuildWithRetry() {
  const args = ["run", "build", "-w", "web"];
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    console.log(`[build-workspace] Building web app (attempt ${attempt}/${maxAttempts})`);
    const { exitCode, combinedOutput } = runNpm(args);

    if (exitCode === 0) {
      return;
    }

    const isTransient = transientWebBuildPatterns.some((pattern) => pattern.test(combinedOutput));
    if (attempt < maxAttempts && isTransient) {
      console.log("[build-workspace] Detected transient Next.js build error. Cleaning web build artifacts and retrying once.");
      cleanWebBuildArtifacts();
      continue;
    }

    throw new Error(`Command failed (exit ${exitCode}): npm ${args.join(" ")}`);
  }
}

function main() {
  runChecked("Verifying brand assets", ["run", "brand:verify"]);
  runWebBuildWithRetry();
  runChecked("Building server", ["run", "build", "-w", "@nexusforge/server"]);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[build-workspace] FAIL: ${message}`);
  process.exit(1);
}
