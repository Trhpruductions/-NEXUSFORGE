import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const brandDir = path.join(repoRoot, "apps", "web", "public", "brand");

const requiredAssets = [
  "nexusforge-main-logo.png",
  "nexusforge-logo.png",
  "tier-starter-core.png",
  "tier-plus-command.png",
  "tier-elite-creator.png",
  "tier-infinite-league.png",
  "boost-pack-icon.png",
  "profile-badge-founder.png",
  "profile-badge-owner.png",
  "profile-badge-admin.png",
  "profile-badge-moderator.png",
  "profile-badge-developer.png",
  "profile-badge-vip.png",
  "profile-badge-investor.png",
  "profile-badge-staff.png",
  "profile-badge-legend.png",
];

function fileSizeSafe(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

const missing = [];
const empty = [];

for (const name of requiredAssets) {
  const filePath = path.join(brandDir, name);
  if (!fs.existsSync(filePath)) {
    missing.push(name);
    continue;
  }

  if (fileSizeSafe(filePath) <= 0) {
    empty.push(name);
  }
}

if (missing.length || empty.length) {
  console.error("[brand-verify] Brand asset verification failed.");

  if (missing.length) {
    console.error(`[brand-verify] Missing files (${missing.length}):`);
    for (const name of missing) {
      console.error(` - ${name}`);
    }
  }

  if (empty.length) {
    console.error(`[brand-verify] Empty files (${empty.length}):`);
    for (const name of empty) {
      console.error(` - ${name}`);
    }
  }

  process.exit(1);
}

console.log(`[brand-verify] OK (${requiredAssets.length} required assets verified).`);
