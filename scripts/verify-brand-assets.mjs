import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const brandDir = path.join(repoRoot, "apps", "web", "public", "brand");
const desktopAssetsDir = path.join(repoRoot, "apps", "desktop", "assets");
const desktopSplashPath = path.join(repoRoot, "apps", "desktop", "splash.html");
const desktopSplashLogoRelativePath = "./assets/nexusforge-main-logo.png";

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
const desktopIssues = [];

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

const desktopLogoPath = path.join(desktopAssetsDir, "nexusforge-main-logo.png");
if (!fs.existsSync(desktopLogoPath)) {
  desktopIssues.push(`Missing desktop splash logo asset: ${desktopLogoPath}`);
} else if (fileSizeSafe(desktopLogoPath) <= 0) {
  desktopIssues.push(`Desktop splash logo asset is empty: ${desktopLogoPath}`);
}

if (!fs.existsSync(desktopSplashPath)) {
  desktopIssues.push(`Missing desktop splash template: ${desktopSplashPath}`);
} else {
  const splashHtml = fs.readFileSync(desktopSplashPath, "utf8");
  if (!splashHtml.includes(desktopSplashLogoRelativePath)) {
    desktopIssues.push(
      `Desktop splash must reference packaged logo path '${desktopSplashLogoRelativePath}'`
    );
  }
}

if (missing.length || empty.length || desktopIssues.length) {
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

  if (desktopIssues.length) {
    console.error(`[brand-verify] Desktop splash issues (${desktopIssues.length}):`);
    for (const issue of desktopIssues) {
      console.error(` - ${issue}`);
    }
  }

  process.exit(1);
}

console.log(`[brand-verify] OK (${requiredAssets.length} required assets verified).`);
