const webBaseUrl = (process.env.NEXUSFORGE_WEB_BASE_URL || "http://127.0.0.1:3300").replace(/\/+$/, "");
const apiBaseUrl = (process.env.NEXUSFORGE_API_BASE_URL || "http://127.0.0.1:4001").replace(/\/+$/, "");
const adminEmail = process.env.NEXUSFORGE_PRICING_SMOKE_ADMIN_EMAIL || "razeprime@nexusforge.local";
const adminPassword = process.env.NEXUSFORGE_PRICING_SMOKE_ADMIN_PASSWORD || "Sample!2026";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return { response, json, text };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function verifyCatalog() {
  const { response, json, text } = await fetchJson(`${webBaseUrl}/api/pricing/catalog`);
  assert(response.ok, `Catalog endpoint failed (${response.status}): ${text.slice(0, 300)}`);
  assert(json && typeof json === "object", "Catalog payload is not valid JSON object");

  const expectedTiers = ["CORE", "PLUS", "ELITE", "INFINITE"];
  for (const tier of expectedTiers) {
    assert(json.tiers?.[tier], `Missing tiers.${tier}`);
    assert(typeof json.tiers[tier].monthly === "string", `Missing tiers.${tier}.monthly`);
    assert(typeof json.tiers[tier].yearly === "string", `Missing tiers.${tier}.yearly`);
  }

  const expectedFeatures = [
    "CORE_PLUS",
    "FORGE_BOOST_PACK",
    "CREATOR_CAMPAIGN_SLOT",
    "EVENT_TICKET_PASS",
    "TEAM_BRANDING_KIT",
    "ADVANCED_MODERATION_AI",
  ];

  for (const feature of expectedFeatures) {
    assert(typeof json.paidFeatureLabels?.[feature] === "string", `Missing paidFeatureLabels.${feature}`);
    assert(typeof json.paidFeaturePrices?.[feature] === "string", `Missing paidFeaturePrices.${feature}`);
  }

  return {
    expectedFeatures,
    catalogLabelByFeature: json.paidFeatureLabels,
    catalogPriceByFeature: json.paidFeaturePrices,
  };
}

async function loginAdmin() {
  const { response, json, text } = await fetchJson(`${apiBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword,
    }),
  });

  assert(response.ok, `Admin login failed (${response.status}): ${text.slice(0, 300)}`);
  assert(typeof json?.accessToken === "string" && json.accessToken.length > 20, "Missing accessToken from login response");
  assert(typeof json?.csrfToken === "string" && json.csrfToken.length > 8, "Missing csrfToken from login response");

  return {
    accessToken: json.accessToken,
    csrfToken: json.csrfToken,
    username: json?.user?.username || "unknown",
  };
}

// Financial data lives in the owner console on this PC, not on the website. The website must not serve it.
async function verifyRevenueNotOnWebsite(auth) {
  const { response, text } = await fetchJson(`${apiBaseUrl}/api/admin/revenue`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${auth.accessToken}`,
      "x-csrf-token": auth.csrfToken,
    },
  });

  assert(response.status === 404, `Website still serves revenue (${response.status}): ${text.slice(0, 200)}`);
}

async function main() {
  const catalogInfo = await verifyCatalog();
  const auth = await loginAdmin();
  await verifyRevenueNotOnWebsite(auth);

  console.log("[pricing-smoke] catalog endpoint: ok");
  console.log(`[pricing-smoke] admin auth: ok (${auth.username})`);
  console.log("[pricing-smoke] revenue is not served by the website: ok");
}

main().catch((error) => {
  console.error(`[pricing-smoke] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});