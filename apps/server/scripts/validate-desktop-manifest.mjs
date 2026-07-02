import fs from "node:fs";
import path from "node:path";

function fail(message) {
  console.error(`[desktop:manifest:validate] FAIL: ${message}`);
  process.exit(1);
}

function resolveManifestPath() {
  const candidates = [
    path.resolve(process.cwd(), "apps/web/public/desktop-update.json"),
    path.resolve(process.cwd(), "../web/public/desktop-update.json"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function resolveRootManifestPath() {
  const candidates = [
    path.resolve(process.cwd(), "desktop-update.json"),
    path.resolve(process.cwd(), "../desktop-update.json"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function areManifestsAligned(publicManifest, rootManifest) {
  const fields = [
    "version",
    "notes",
    "downloadUrl",
    "downloadUrls",
    "downloadFolderUrl",
    "sha256",
    "forceUpdate",
  ];

  return fields.every((field) => {
    const publicValue = publicManifest[field];
    const rootValue = rootManifest[field];

    if (Array.isArray(publicValue) || Array.isArray(rootValue)) {
      return JSON.stringify(publicValue) === JSON.stringify(rootValue);
    }

    return publicValue === rootValue;
  });
}

function main() {
  const manifestPath = resolveManifestPath();
  if (!manifestPath) {
    fail("desktop-update.json not found in workspace");
  }

  const rootManifestPath = resolveRootManifestPath();

  const raw = fs.readFileSync(manifestPath, "utf8");
  let manifest;

  try {
    manifest = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`desktop-update.json is not valid JSON: ${message}`);
  }

  const version = String(manifest.version || "").trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    fail("version must be semver (x.y.z)");
  }

  const downloadUrl = String(manifest.downloadUrl || "").trim();
  if (!downloadUrl) {
    fail("downloadUrl must be present");
  }

  const downloadUrls = [];
  if (manifest.downloadUrls !== undefined) {
    if (!Array.isArray(manifest.downloadUrls)) {
      fail("downloadUrls must be an array if present");
    }
    for (const entry of manifest.downloadUrls) {
      if (typeof entry !== "string" || !entry.trim()) {
        fail("downloadUrls entries must be non-empty strings");
      }
      downloadUrls.push(entry.trim());
    }
  }

  const urlCandidates = [downloadUrl, ...downloadUrls];
  for (const candidate of urlCandidates) {
    let parsedUrl;
    try {
      parsedUrl = new URL(candidate, "http://example.com");
    } catch {
      fail(`download URL '${candidate}' must be a valid URL or relative path`);
    }

    if (!/\.exe($|[?#])/i.test(parsedUrl.pathname + parsedUrl.search + parsedUrl.hash)) {
      fail(`download URL '${candidate}' must point to an .exe installer`);
    }
  }

  const sha256 = String(manifest.sha256 || "").trim();
  if (!/^[a-f0-9]{64}$/i.test(sha256)) {
    fail("sha256 must be a 64-character hex string");
  }

  if (typeof manifest.forceUpdate !== "boolean") {
    fail("forceUpdate must be a boolean");
  }

  if (!Array.isArray(manifest.notes)) {
    fail("notes must be an array");
  }

  for (const note of manifest.notes) {
    if (typeof note !== "string") {
      fail("every notes entry must be a string");
    }
  }

  if (rootManifestPath && path.resolve(rootManifestPath) !== path.resolve(manifestPath)) {
    let rootManifest;

    try {
      rootManifest = JSON.parse(fs.readFileSync(rootManifestPath, "utf8"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fail(`root desktop-update.json is not valid JSON: ${message}`);
    }

    if (!areManifestsAligned(manifest, rootManifest)) {
      fail("root desktop-update.json and apps/web/public/desktop-update.json are out of sync");
    }
  }

  console.log(`[desktop:manifest:validate] OK: ${manifestPath}`);
}

main();