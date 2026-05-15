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

function main() {
  const manifestPath = resolveManifestPath();
  if (!manifestPath) {
    fail("desktop-update.json not found in workspace");
  }

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
  if (!/^https?:\/\//i.test(downloadUrl)) {
    fail("downloadUrl must be an absolute http(s) URL");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(downloadUrl);
  } catch {
    fail("downloadUrl must be a valid URL");
  }

  if (!/\.exe($|[?#])/i.test(parsedUrl.pathname + parsedUrl.search + parsedUrl.hash)) {
    fail("downloadUrl must point to an .exe installer");
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

  console.log(`[desktop:manifest:validate] OK: ${manifestPath}`);
}

main();