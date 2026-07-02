import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

const checks = [
  {
    path: "apps/web/src/components/brand/pricing-and-payments.tsx",
    requires: ["from \"@/lib/pricing-catalog\"", "CORE_PLUS_TIER_PRICING", "PAID_FEATURE_PRICE_LABELS"],
  },
  {
    path: "apps/web/src/components/brand/core-plus-experience.tsx",
    requires: ["from \"@/lib/pricing-catalog\"", "CORE_PLUS_TIER_PRICING"],
  },
  {
    path: "apps/web/src/components/admin/admin-dashboard.tsx",
    requires: ["from \"@/lib/pricing-catalog\"", "PAID_FEATURE_DISPLAY_LABELS", "CORE_PLUS_TIER_DISPLAY_LABELS"],
  },
  {
    path: "apps/web/src/app/api/pricing/catalog/route.ts",
    requires: ["from \"@/lib/pricing-catalog\"", "CORE_PLUS_TIER_PRICING", "PAID_FEATURE_PRICE_LABELS"],
  },
  {
    path: "apps/server/src/lib/pricing-catalog-client.ts",
    requires: ["/api/pricing/catalog", "getRemotePricingCatalog", "resolveCatalogUrl"],
  },
  {
    path: "apps/server/src/routes/admin.routes.ts",
    requires: ["getRemotePricingCatalog", "featureLabel", "priceLabel"],
  },
  {
    path: "apps/desktop/main.js",
    requires: ["resolvePricingCatalogUrl", "fetchPricingCatalog", "nexusforge-desktop:get-pricing-catalog"],
  },
  {
    path: "apps/desktop/preload.js",
    requires: ["getPricingCatalog", "nexusforge-desktop:get-pricing-catalog"],
  },
];

const forbiddenPriceLiterals = [
  "$3.99",
  "$9.99",
  "$19.99",
  "$39.99",
  "$39",
  "$99",
  "$199",
  "$399",
  "$3 / $8 / $19",
  "$29 per campaign",
  "$2 to $9 per event",
  "$12 one-time",
  "$9 per forge / month",
];

const filesToEnforceNoHardcodedPrices = [
  "apps/web/src/components/brand/pricing-and-payments.tsx",
  "apps/web/src/components/brand/core-plus-experience.tsx",
];

const failures = [];

for (const check of checks) {
  const fullPath = resolve(root, check.path);
  let content = "";

  try {
    content = readFileSync(fullPath, "utf8");
  } catch (error) {
    failures.push(`${check.path}: unable to read file (${error instanceof Error ? error.message : String(error)})`);
    continue;
  }

  for (const required of check.requires) {
    if (!content.includes(required)) {
      failures.push(`${check.path}: missing required token: ${required}`);
    }
  }
}

for (const relativePath of filesToEnforceNoHardcodedPrices) {
  const fullPath = resolve(root, relativePath);
  let content = "";

  try {
    content = readFileSync(fullPath, "utf8");
  } catch (error) {
    failures.push(`${relativePath}: unable to read file (${error instanceof Error ? error.message : String(error)})`);
    continue;
  }

  for (const literal of forbiddenPriceLiterals) {
    if (content.includes(literal)) {
      failures.push(`${relativePath}: found hardcoded price literal ${literal}`);
    }
  }
}

if (failures.length) {
  console.error("[pricing-validate] failed checks:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("[pricing-validate] all checks passed");