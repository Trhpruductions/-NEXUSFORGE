import { spawnSync } from "node:child_process";

const transientWebBuildPatterns = [
  /Cannot find module for page:\s*\/favicon\.ico/i,
  /Failed to collect page data for\s*\/favicon\.ico/i,
  /Cannot find module for page:\s*\/_document/i,
  /PageNotFoundError[\s\S]*\/_document/i,
];

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

  const combinedOutput = `${stdout}\n${stderr}`;
  const exitCode = Number.isInteger(result.status) ? result.status : 1;

  return { exitCode, combinedOutput };
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
      console.log("[build-workspace] Detected transient Next.js page-module error. Retrying once.");
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
