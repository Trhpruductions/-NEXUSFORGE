"use strict";

// Git, desktop manifest and legal drafts. Read only: git runs with --no-optional-locks and only
// status, log and rev-parse are used.

const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { REPO_ROOT, DESKTOP_MANIFEST, LEGAL_DIR } = require("../config");
const { scrubText } = require("../secrets");

function git(args) {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["--no-optional-locks", "-C", REPO_ROOT, ...args],
      { windowsHide: true, timeout: 20000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          reject(new Error(`git ${args[0]} failed: ${scrubText(String(err.code || err.message))}`));
          return;
        }
        resolve(String(stdout));
      },
    );
  });
}

async function collectGit() {
  const [branchOut, logOut, statusOut] = await Promise.all([
    git(["rev-parse", "--abbrev-ref", "HEAD"]),
    git(["log", "-1", "--format=%h%x1f%s%x1f%cI"]),
    git(["status", "--porcelain"]),
  ]);
  const [hash, subject, date] = logOut.trim().split("\x1f");
  const lines = statusOut.split(/\r?\n/).filter((line) => line.length > 0);
  const untracked = lines.filter((line) => line.startsWith("??")).length;
  return {
    branch: branchOut.trim(),
    lastCommit: { hash: hash || null, subject: scrubText(subject || ""), date: date || null },
    uncommittedFiles: lines.length,
    untrackedFiles: untracked,
    modifiedFiles: lines.length - untracked,
  };
}

async function collectDesktop() {
  const raw = await fs.readFile(DESKTOP_MANIFEST, "utf8");
  const manifest = JSON.parse(raw);
  return {
    file: path.relative(REPO_ROOT, DESKTOP_MANIFEST).split(path.sep).join("/"),
    version: typeof manifest.version === "string" ? manifest.version : null,
    forceUpdate: manifest.forceUpdate === true,
    notes: scrubText(typeof manifest.notes === "string" ? manifest.notes.slice(0, 400) : ""),
    sha256Prefix: typeof manifest.sha256 === "string" ? manifest.sha256.slice(0, 12) : null,
  };
}

/** The same bracketed-placeholder rule the app uses (apps/server/src/lib/legal-rules.ts). */
function findPlaceholders(content) {
  const found = new Set();
  for (const match of content.matchAll(/\[([A-Z0-9][^\]\n]{0,160})\]/g)) {
    const end = (match.index ?? 0) + match[0].length;
    if (content.slice(end, end + 1) === "(") continue; // a markdown link, not a placeholder
    found.add(match[0]);
  }
  return [...found];
}

async function collectLegal() {
  const names = (await fs.readdir(LEGAL_DIR)).filter((name) => name.toLowerCase().endsWith(".md")).sort();
  const files = [];
  for (const name of names) {
    const content = await fs.readFile(path.join(LEGAL_DIR, name), "utf8");
    const placeholders = findPlaceholders(content);
    files.push({
      name,
      placeholderCount: placeholders.length,
      samples: placeholders.slice(0, 3).map((text) => scrubText(text.slice(0, 80))),
    });
  }
  return {
    folder: path.relative(REPO_ROOT, LEGAL_DIR).split(path.sep).join("/"),
    files,
    filesWithPlaceholders: files.filter((file) => file.placeholderCount > 0).length,
  };
}

async function collectVersions() {
  const raw = await fs.readFile(path.join(REPO_ROOT, "apps", "desktop", "package.json"), "utf8");
  const pkg = JSON.parse(raw);
  return { desktopPackageVersion: typeof pkg.version === "string" ? pkg.version : null };
}

/** Each part is collected separately, so one failing part does not hide the others. */
async function collectRepo() {
  const part = async (fn) => {
    try {
      return { value: await fn(), error: null };
    } catch (err) {
      return { value: null, error: scrubText(err.message || "failed") };
    }
  };
  const [git, desktop, legal, versions] = await Promise.all([part(collectGit), part(collectDesktop), part(collectLegal), part(collectVersions)]);
  const desktopPackageVersion = versions.value ? versions.value.desktopPackageVersion : null;
  const manifestVersion = desktop.value ? desktop.value.version : null;
  return {
    checkedAt: new Date().toISOString(),
    git: git.value,
    gitError: git.error,
    desktop: desktop.value,
    desktopError: desktop.error,
    legal: legal.value,
    legalError: legal.error,
    release: {
      desktopPackageVersion,
      manifestVersion,
      versionsMatch: Boolean(desktopPackageVersion && manifestVersion && desktopPackageVersion === manifestVersion),
      error: versions.error,
    },
  };
}

module.exports = { collectRepo, collectLegal, findPlaceholders };
