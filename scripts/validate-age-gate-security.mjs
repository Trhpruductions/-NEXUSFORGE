const defaultBaseUrl = "http://127.0.0.1:3000";

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0 || index + 1 >= process.argv.length) {
    return null;
  }
  return process.argv[index + 1];
}

function fail(message) {
  console.error(`[age-gate-validate] FAIL: ${message}`);
  process.exit(1);
}

function ensure(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function hasNoStoreHeader(headers) {
  const cacheControl = String(headers.get("cache-control") || "").toLowerCase();
  return cacheControl.includes("no-store") && cacheControl.includes("no-cache");
}

function hasExpectedAgeCookie(setCookieHeader) {
  const normalized = String(setCookieHeader || "");
  return normalized.includes("nexusforge_age18=") || normalized.includes("__Host-nexusforge_age18=");
}

function getBrowserLikeDeviceProfile() {
  return {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6423.93 Safari/537.36",
    platform: "Windows",
    vendor: "Google Inc.",
    language: "en-US",
    languages: ["en-US", "en"],
    hardwareConcurrency: 8,
    deviceMemory: 8,
    cookieEnabled: true,
    webdriver: false,
    screenWidth: 1920,
    screenHeight: 1080,
    colorDepth: 24,
    touchPoints: 0,
    timezone: "America/Los_Angeles",
    timezoneOffset: new Date().getTimezoneOffset(),
    browserFeatures: {
      hasWebGPU: true,
      hasGpu: true,
      hasFlash: false,
    },
    pluginCount: 1,
  };
}

async function postJson(url, payload, headers) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });

  let bodyText = "";
  try {
    bodyText = await response.text();
  } catch {
    bodyText = "";
  }

  return { response, bodyText };
}

function parseRetryAfterSeconds(headers) {
  const value = String(headers.get("retry-after") || "").trim();
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function waitMs(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

async function main() {
  const rawBase = getArgValue("--base") || defaultBaseUrl;
  const baseUrl = rawBase.replace(/\/+$/, "");
  const baseOrigin = new URL(baseUrl).origin;

  const verifyUrl = `${baseUrl}/api/age/verify`;
  const rejectUrl = `${baseUrl}/api/age/reject`;

  console.log(`[age-gate-validate] Base URL: ${baseUrl}`);

  const crossOriginVerify = await postJson(
    verifyUrl,
    { confirmed: true },
    {
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site",
      "user-agent": "AgeGateValidator-CrossOrigin",
    },
  );
  ensure(crossOriginVerify.response.status === 403, "Cross-origin verify should be blocked with 403");
  ensure(hasNoStoreHeader(crossOriginVerify.response.headers), "Cross-origin verify response must be no-store");

  let sameOriginVerify = await postJson(
    verifyUrl,
    { confirmed: true, deviceProfile: getBrowserLikeDeviceProfile() },
    {
      origin: baseOrigin,
      "sec-fetch-site": "same-origin",
      "user-agent": "AgeGateValidator-SameOrigin",
    },
  );
  if (sameOriginVerify.response.status === 429) {
    const retryAfterSeconds = parseRetryAfterSeconds(sameOriginVerify.response.headers);
    ensure(Boolean(retryAfterSeconds), "Rate-limited verify response must include retry-after header");
    await waitMs((retryAfterSeconds + 1) * 1000);
    sameOriginVerify = await postJson(
      verifyUrl,
      { confirmed: true, deviceProfile: getBrowserLikeDeviceProfile() },
      {
        origin: baseOrigin,
        "sec-fetch-site": "same-origin",
        "user-agent": "AgeGateValidator-SameOrigin-Retry",
      },
    );
  }
  ensure(sameOriginVerify.response.status === 200, "Same-origin verify should succeed with 200");
  ensure(hasNoStoreHeader(sameOriginVerify.response.headers), "Successful verify response must be no-store");
  ensure(
    hasExpectedAgeCookie(sameOriginVerify.response.headers.get("set-cookie")),
    "Successful verify response must set expected age cookie",
  );

  let rateLimited = false;
  for (let attempt = 1; attempt <= 25; attempt += 1) {
    const rateResponse = await postJson(
      verifyUrl,
      { confirmed: true, deviceProfile: getBrowserLikeDeviceProfile() },
      {
        origin: baseOrigin,
        "sec-fetch-site": "same-origin",
        "user-agent": "AgeGateValidator-RateLimit",
      },
    );

    if (rateResponse.response.status === 429) {
      const retryAfter = String(rateResponse.response.headers.get("retry-after") || "").trim();
      ensure(Boolean(retryAfter), "Rate-limited response must include retry-after header");
      ensure(hasNoStoreHeader(rateResponse.response.headers), "Rate-limited response must be no-store");
      rateLimited = true;
      break;
    }

    ensure(
      rateResponse.response.status === 200,
      `Unexpected status during rate-limit probe: ${rateResponse.response.status}`,
    );
  }

  ensure(rateLimited, "Verify endpoint did not enforce rate limiting in expected attempt window");

  const crossOriginReject = await postJson(
    rejectUrl,
    {},
    {
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site",
      "user-agent": "AgeGateValidator-CrossOrigin-Reject",
    },
  );
  ensure(crossOriginReject.response.status === 403, "Cross-origin reject should be blocked with 403");
  ensure(hasNoStoreHeader(crossOriginReject.response.headers), "Cross-origin reject response must be no-store");

  const sameOriginReject = await postJson(
    rejectUrl,
    {},
    {
      origin: baseOrigin,
      "sec-fetch-site": "same-origin",
      "user-agent": "AgeGateValidator-SameOrigin-Reject",
    },
  );
  ensure(sameOriginReject.response.status === 200, "Same-origin reject should succeed with 200");
  ensure(hasNoStoreHeader(sameOriginReject.response.headers), "Successful reject response must be no-store");

  console.log("[age-gate-validate] PASS");
  console.log("[age-gate-validate] Cross-origin blocked, no-store enforced, cookie set, and rate-limit active.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
