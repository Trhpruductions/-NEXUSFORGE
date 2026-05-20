export type AgeGateDeviceProfile = {
  userAgent?: string;
  platform?: string;
  vendor?: string;
  language?: string;
  languages?: readonly string[];
  hardwareConcurrency?: number;
  deviceMemory?: number;
  cookieEnabled?: boolean;
  webdriver?: boolean;
  screenWidth?: number;
  screenHeight?: number;
  colorDepth?: number;
  touchPoints?: number;
  timezone?: string;
  timezoneOffset?: number;
  browserFeatures?: {
    hasWebGPU?: boolean;
    hasGpu?: boolean;
    hasFlash?: boolean;
  };
  pluginCount?: number;
};

type AgeGateRiskResult = {
  score: number;
  level: "low" | "medium" | "high" | "critical";
  reasons: string[];
  fingerprint: string;
};

function bufferToHex(buffer: ArrayBuffer | ArrayBufferView) {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function digestString(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bufferToHex(digest).slice(0, 32);
}

function normalizeProfile(profile: AgeGateDeviceProfile) {
  return {
    userAgent: profile.userAgent?.trim() || "",
    platform: profile.platform?.trim() || "",
    vendor: profile.vendor?.trim() || "",
    language: profile.language?.trim() || "",
    languages: profile.languages?.slice(0, 5) ?? [],
    hardwareConcurrency: profile.hardwareConcurrency ?? 0,
    deviceMemory: profile.deviceMemory ?? 0,
    cookieEnabled: profile.cookieEnabled ?? false,
    webdriver: profile.webdriver ?? false,
    screenWidth: profile.screenWidth ?? 0,
    screenHeight: profile.screenHeight ?? 0,
    colorDepth: profile.colorDepth ?? 0,
    touchPoints: profile.touchPoints ?? 0,
    timezone: profile.timezone?.trim() || "",
    timezoneOffset: profile.timezoneOffset ?? 0,
    browserFeatures: {
      hasWebGPU: profile.browserFeatures?.hasWebGPU ?? false,
      hasGpu: profile.browserFeatures?.hasGpu ?? false,
      hasFlash: profile.browserFeatures?.hasFlash ?? false,
    },
    pluginCount: profile.pluginCount ?? 0,
  };
}

export async function hashAgeGateDeviceProfile(profile: AgeGateDeviceProfile) {
  const normalized = normalizeProfile(profile);
  const payload = JSON.stringify(normalized);
  return digestString(payload);
}

function parseIpHeader(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const firstForwardedIp = forwardedFor.split(",")[0]?.trim() || "";
  const actualIp = request.headers.get("cf-connecting-ip") || firstForwardedIp || "unknown";
  return actualIp;
}

export function assessAgeGateRisk(profile: AgeGateDeviceProfile, request: Request): AgeGateRiskResult {
  const reasons: string[] = [];
  let score = 0;
  const normalized = normalizeProfile(profile);
  const ua = (normalized.userAgent || request.headers.get("user-agent") || "").toLowerCase();

  if (normalized.webdriver || ua.includes("webdriver") || ua.includes("headless") || ua.includes("phantomjs") || ua.includes("puppeteer") || ua.includes("playwright")) {
    reasons.push("Automation or headless browser detected");
    score += 50;
  }

  if (ua.includes("bot") || ua.includes("crawl") || ua.includes("spider") || ua.includes("bingpreview")) {
    reasons.push("Known bot user agent detected");
    score += 40;
  }

  if (normalized.hardwareConcurrency > 0 && normalized.hardwareConcurrency <= 2) {
    reasons.push("Low CPU concurrency");
    score += 10;
  }

  if (normalized.deviceMemory > 0 && normalized.deviceMemory <= 1) {
    reasons.push("Low device memory reported");
    score += 10;
  }

  if (!normalized.cookieEnabled) {
    reasons.push("Cookies are disabled");
    score += 15;
  }

  if (normalized.language && normalized.languages.length > 0 && !normalized.languages[0].includes(normalized.language)) {
    reasons.push("Language inconsistency detected");
    score += 8;
  }

  if (!normalized.timezone && normalized.timezoneOffset === 0) {
    reasons.push("Timezone data unavailable");
    score += 8;
  }

  if (normalized.pluginCount === 0 && !/mobile|android|iphone|ipad/i.test(ua)) {
    reasons.push("No browser plugins detected on desktop browser");
    score += 8;
  }

  if (normalized.touchPoints === 0 && /mobile|iphone|android/i.test(ua)) {
    reasons.push("Expected touch support on mobile device is missing");
    score += 10;
  }

  if (normalized.browserFeatures?.hasFlash) {
    reasons.push("Legacy Flash support detected");
    score += 6;
  }

  if (normalized.browserFeatures?.hasWebGPU === false && ua.includes("chrome")) {
    reasons.push("Modern browser GPU support missing");
    score += 5;
  }

  const ip = parseIpHeader(request).toLowerCase();
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("172.")) {
    reasons.push("Local or private network address detected");
    score += 8;
  }

  if (request.headers.has("via") || request.headers.has("forwarded") || request.headers.has("x-real-ip")) {
    reasons.push("Proxy or forwarding headers detected");
    score += 15;
  }

  if (ua.includes("tor") || ua.includes("onion")) {
    reasons.push("Tor or anonymizing network detected");
    score += 30;
  }

  if (ua.includes("linux") && /windows|macintosh/.test(normalized.platform?.toLowerCase() || "")) {
    reasons.push("Platform and user agent mismatch");
    score += 20;
  }

  if (normalized.vendor && normalized.vendor.toLowerCase().includes("google inc.")) {
    // no risk change, just observation
  }

  const fingerprint = `${normalized.userAgent}|${normalized.platform}|${normalized.vendor}|${normalized.language}|${normalized.timezone}|${normalized.screenWidth}x${normalized.screenHeight}|${normalized.hardwareConcurrency}|${normalized.deviceMemory}|${normalized.touchPoints}`;
  const fingerprintHash = bufferToHex(new TextEncoder().encode(fingerprint)).slice(0, 24);

  let level: AgeGateRiskResult["level"] = "low";
  if (score >= 75) {
    level = "critical";
  } else if (score >= 55) {
    level = "high";
  } else if (score >= 30) {
    level = "medium";
  }

  return {
    score,
    level,
    reasons,
    fingerprint: fingerprintHash,
  };
}
