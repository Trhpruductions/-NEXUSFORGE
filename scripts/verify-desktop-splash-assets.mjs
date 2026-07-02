import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const checkPackaged = args.has("--check-packaged") || args.has("--require-packaged");
const requirePackaged = args.has("--require-packaged");

const sourceSplashPath = path.join(repoRoot, "apps", "desktop", "splash.html");
const sourceLogoPath = path.join(repoRoot, "apps", "desktop", "assets", "nexusforge-main-logo.png");
const sourceExpectedReference = "./assets/nexusforge-main-logo.png";

const packagedAsarPath = path.join(
  repoRoot,
  "apps",
  "desktop",
  "release",
  "win-unpacked",
  "resources",
  "app.asar",
);

function fail(message) {
  console.error(`[desktop-splash-verify] FAIL: ${message}`);
  process.exit(1);
}

function extractInlineScript(html) {
  const match = html.match(/<script>([\s\S]*?)<\/script>/i);
  if (!match) {
    fail("source splash must contain an inline script block");
  }

  return match[1];
}

function assertInlineScriptParses(sourceCode) {
  try {
    new Function(sourceCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`source splash inline script syntax error: ${message}`);
  }
}

function assertScriptMarkupContract(html, sourceCode) {
  const idReferences = [...sourceCode.matchAll(/getElementById\("([^"]+)"\)/g)].map((match) => match[1]);
  const classReferences = [...sourceCode.matchAll(/querySelector(?:All)?\("\.([^"]+)"\)/g)].map((match) => match[1]);

  const missingIds = [...new Set(idReferences)].filter((id) => !new RegExp(`id=["']${id}["']`, "i").test(html));
  const missingClasses = [...new Set(classReferences)].filter(
    (className) => !new RegExp(`class=["'][^"']*\\b${className}\\b`, "i").test(html),
  );

  if (missingIds.length > 0) {
    fail(`source splash is missing required ids referenced by script: ${missingIds.join(", ")}`);
  }

  if (missingClasses.length > 0) {
    fail(`source splash is missing required classes referenced by script: ${missingClasses.join(", ")}`);
  }
}

function runAsarList(asarPath) {
  const escapedPath = asarPath.replace(/"/g, '\\"');
  const command = `npx --yes asar list "${escapedPath}"`;

  const result = spawnSync(command, {
    cwd: repoRoot,
    shell: true,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    const stderr = (result.stderr || "").trim();
    const stdout = (result.stdout || "").trim();
    throw new Error(stderr || stdout || `asar list exited with code ${result.status}`);
  }

  return (result.stdout || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((entry) => entry.replace(/\\/g, "/"));
}

if (!fs.existsSync(sourceSplashPath)) {
  fail(`missing source splash template: ${sourceSplashPath}`);
}

if (!fs.existsSync(sourceLogoPath)) {
  fail(`missing source splash logo: ${sourceLogoPath}`);
}

if (fs.statSync(sourceLogoPath).size <= 0) {
  fail(`source splash logo is empty: ${sourceLogoPath}`);
}

const sourceSplashHtml = fs.readFileSync(sourceSplashPath, "utf8");
if (!sourceSplashHtml.includes(sourceExpectedReference)) {
  fail(`source splash must reference '${sourceExpectedReference}'`);
}

const sourceInlineScript = extractInlineScript(sourceSplashHtml);
assertInlineScriptParses(sourceInlineScript);
assertScriptMarkupContract(sourceSplashHtml, sourceInlineScript);

if (!checkPackaged) {
  console.log("[desktop-splash-verify] OK (source splash, script, and logo checks passed).");
  process.exit(0);
}

if (!fs.existsSync(packagedAsarPath)) {
  if (requirePackaged) {
    fail(`missing packaged app archive: ${packagedAsarPath}`);
  }

  console.log(`[desktop-splash-verify] OK (source checks passed; packaged archive not found, skipped: ${packagedAsarPath})`);
  process.exit(0);
}

let asarEntries;
try {
  asarEntries = runAsarList(packagedAsarPath);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(`could not inspect packaged app.asar: ${message}`);
}

const hasPackagedSplash = asarEntries.some((entry) => entry.endsWith("/splash.html") || entry === "/splash.html" || entry === "splash.html");
const hasPackagedLogo = asarEntries.some(
  (entry) =>
    entry.endsWith("/assets/nexusforge-main-logo.png") ||
    entry === "/assets/nexusforge-main-logo.png" ||
    entry === "assets/nexusforge-main-logo.png",
);

if (!hasPackagedSplash) {
  fail(`packaged app.asar missing splash.html: ${packagedAsarPath}`);
}

if (!hasPackagedLogo) {
  fail(`packaged app.asar missing assets/nexusforge-main-logo.png: ${packagedAsarPath}`);
}

console.log("[desktop-splash-verify] OK (source splash contract and packaged splash assets verified).");
