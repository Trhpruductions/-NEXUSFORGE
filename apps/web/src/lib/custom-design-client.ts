import { customDesignAssets } from "@/lib/custom-design-manifest";

const availableCustomDesignAssets = customDesignAssets as readonly string[];

export function getCustomDesignImageUrl(candidates: string[], fallback: string) {
  for (const fileName of candidates) {
    if (!fileName) continue;
    const fileKey = fileName.startsWith("custom-design/") ? fileName.replace(/^custom-design\//, "") : fileName.replace(/^[\/]/, "");
    if (availableCustomDesignAssets.includes(fileKey)) {
      return fileName.startsWith("/") ? fileName : fileName.startsWith("custom-design/") ? `/${fileName}` : `/custom-design/${fileName}`;
    }
  }

  return fallback;
}
