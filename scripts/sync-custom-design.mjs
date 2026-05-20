import { existsSync, mkdirSync, readdirSync, copyFileSync, writeFileSync } from "fs";
import { join } from "path";

const sourceDir = join(process.cwd(), "app-images", "custom-design");
const targetDir = join(process.cwd(), "apps", "web", "public", "custom-design");
const manifestPath = join(process.cwd(), "apps", "web", "src", "lib", "custom-design-manifest.ts");

if (!existsSync(sourceDir)) {
  console.error(`Source folder not found: ${sourceDir}`);
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });

const imageFiles = readdirSync(sourceDir).filter((file) => /\.(png|jpe?g|webp|svg)$/i.test(file));

if (imageFiles.length === 0) {
  console.log(`No image files found in ${sourceDir}. Add your app design images and rerun this script.`);
  process.exit(0);
}

for (const fileName of imageFiles) {
  const sourcePath = join(sourceDir, fileName);
  const destPath = join(targetDir, fileName);
  copyFileSync(sourcePath, destPath);
  console.log(`Copied ${fileName}`);
}

const manifestContents = `export const customDesignAssets = ${JSON.stringify(imageFiles, null, 2)} as const;\n`;
writeFileSync(manifestPath, manifestContents, "utf8");
console.log(`Wrote manifest with ${imageFiles.length} asset(s) to ${manifestPath}`);
console.log(`\nSynced ${imageFiles.length} custom design image(s) to public/custom-design.`);
