import { env } from "../config/env.js";

type PricingCatalogResponse = {
  paidFeatureLabels?: Record<string, string>;
  paidFeaturePrices?: Record<string, string>;
  generatedAt?: string;
};

type CatalogCache = {
  expiresAt: number;
  value: PricingCatalogResponse | null;
};

const CATALOG_CACHE_TTL_MS = 60_000;
let catalogCache: CatalogCache = {
  expiresAt: 0,
  value: null,
};

function resolveCatalogUrl() {
  return `${env.APP_WEB_URL.replace(/\/+$/, "")}/api/pricing/catalog`;
}

export async function getRemotePricingCatalog(): Promise<PricingCatalogResponse | null> {
  const now = Date.now();
  if (catalogCache.value && catalogCache.expiresAt > now) {
    return catalogCache.value;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(resolveCatalogUrl(), {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const parsed = (await response.json()) as PricingCatalogResponse;
    catalogCache = {
      expiresAt: now + CATALOG_CACHE_TTL_MS,
      value: parsed,
    };

    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}