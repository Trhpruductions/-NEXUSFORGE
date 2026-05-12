import { spawnSync } from "node:child_process";

const steps = [
  {
    label: "Build and package desktop installer",
    args: ["run", "desktop:installer"],
  },
  {
    label: "Launch unpacked desktop app",
    args: ["run", "desktop:open:unpacked"],
  },
  {
    label: "Launch installed desktop app",
    args: ["run", "desktop:open:installed"],
  },
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

  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  return exitCode;
}

function runStep(step) {
  console.log(`\n[desktop-release-checklist] ${step.label}`);
  const exitCode = runNpm(step.args);
  return {
    ...step,
    exitCode,
    ok: exitCode === 0,
  };
}

function printSummary(results) {
  console.log("\n[desktop-release-checklist] Summary");
  for (const result of results) {
    const marker = result.ok ? "PASS" : "FAIL";
    console.log(`- ${marker}: ${result.label}`);
  }
}

try {
  const results = [];

  for (const step of steps) {
    const result = runStep(step);
    results.push(result);
    if (!result.ok) {
      printSummary(results);
      console.error(
        `[desktop-release-checklist] FAIL: Step failed (exit ${result.exitCode}): npm ${step.args.join(" ")}`,
      );
      process.exit(1);
    }
  }

  printSummary(results);
  console.log("[desktop-release-checklist] All checks completed successfully.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[desktop-release-checklist] FAIL: ${message}`);
  process.exit(1);
}
