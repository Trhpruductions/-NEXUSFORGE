import fs from "fs";
import path from "path";

const CUSTOM_DESIGN_DIR = path.join(process.cwd(), "app-images", "custom-design");
const PUBLIC_CUSTOM_DESIGN_DIR = path.join(process.cwd(), "apps", "web", "public", "custom-design");

export function getCustomDesignImagePath(candidates: string[], fallback: string) {
  for (const fileName of candidates) {
    const customSourcePath = path.join(CUSTOM_DESIGN_DIR, fileName);
    const publicTargetPath = path.join(PUBLIC_CUSTOM_DESIGN_DIR, fileName);

    if (fs.existsSync(publicTargetPath) || fs.existsSync(customSourcePath)) {
      return `/custom-design/${fileName}`;
    }
  }

  return fallback;
}
