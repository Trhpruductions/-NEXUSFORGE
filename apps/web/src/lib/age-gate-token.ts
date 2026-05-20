const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 5;
const AGE_GATE_COOKIE_NAME_LEGACY = "nexusforge_age18";
const AGE_GATE_COOKIE_NAME_HOST_PREFIXED = "__Host-nexusforge_age18";

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function normalizeUserAgent(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || "unknown-agent";
}

function getAgeGateSecret() {
  const secret = process.env.NEXUSFORGE_AGE_GATE_SECRET || process.env.JWT_ACCESS_SECRET || "";
  const normalized = secret.trim();
  if (normalized) {
    return normalized;
  }

  if (process.env.NODE_ENV !== "production") {
    return "nexusforge-dev-age-gate-secret-change-me";
  }

  return "";
}

function bufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string) {
  if (!/^[a-f0-9]+$/i.test(hex) || hex.length % 2 !== 0) {
    return null;
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const parsed = Number.parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(parsed)) {
      return null;
    }
    bytes[i / 2] = parsed;
  }

  return bytes;
}

async function importHmacKey(secret: string) {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signValue(value: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bufferToHex(signature);
}

async function hashUserAgentFingerprint(userAgent: string | null | undefined) {
  const encoder = new TextEncoder();
  const normalized = normalizeUserAgent(userAgent);
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(normalized));
  return bufferToHex(digest).slice(0, 16);
}

export async function createAgeGateToken(nowMs = Date.now(), userAgent?: string | null) {
  const secret = getAgeGateSecret();
  if (!secret) {
    throw new Error("NEXUSFORGE_AGE_GATE_SECRET is not configured");
  }

  const issuedAt = Math.floor(nowMs / 1000);
  const agentFingerprint = await hashUserAgentFingerprint(userAgent);
  const payload = `${issuedAt}:${agentFingerprint}`;
  const signature = await signValue(payload, secret);
  return `${payload}.${signature}`;
}

export async function verifyAgeGateToken(token: string, nowMs = Date.now(), userAgent?: string | null) {
  const secret = getAgeGateSecret();
  if (!secret) {
    return false;
  }

  const [payload, signatureHex] = token.split(".");
  if (!payload || !signatureHex) {
    return false;
  }

  const [issuedAtText, agentFingerprint] = payload.split(":");
  if (!issuedAtText || !agentFingerprint || !/^\d+$/.test(issuedAtText) || !/^[a-f0-9]{16}$/i.test(agentFingerprint)) {
    return false;
  }

  const expectedAgentFingerprint = await hashUserAgentFingerprint(userAgent);
  if (agentFingerprint.toLowerCase() !== expectedAgentFingerprint.toLowerCase()) {
    return false;
  }

  const issuedAt = Number.parseInt(issuedAtText, 10);
  const nowSeconds = Math.floor(nowMs / 1000);
  if (issuedAt > nowSeconds) {
    return false;
  }

  if (nowSeconds - issuedAt > TOKEN_MAX_AGE_SECONDS) {
    return false;
  }

  const signatureBytes = hexToBytes(signatureHex);
  if (!signatureBytes) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await importHmacKey(secret);
  return crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(payload));
}

function isLoopbackHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function getAgeGateCookieName(useSecureCookie = false, requestUrl?: string) {
  const current = isProductionRuntime() ? AGE_GATE_COOKIE_NAME_HOST_PREFIXED : AGE_GATE_COOKIE_NAME_LEGACY;
  if (!isProductionRuntime()) {
    return AGE_GATE_COOKIE_NAME_LEGACY;
  }

  if (!useSecureCookie) {
    return AGE_GATE_COOKIE_NAME_LEGACY;
  }

  if (requestUrl) {
    try {
      const url = new URL(requestUrl);
      if (isLoopbackHostname(url.hostname)) {
        return AGE_GATE_COOKIE_NAME_LEGACY;
      }
    } catch {
      // If the URL cannot be parsed, fall back to the default secure cookie name when secure flag is requested.
    }
  }

  return current;
}

export function getAgeGateCookieNamesForRead() {
  const current = getAgeGateCookieName(true);
  const names = [current, AGE_GATE_COOKIE_NAME_LEGACY, AGE_GATE_COOKIE_NAME_HOST_PREFIXED];
  return Array.from(new Set(names));
}

export function getAgeGateLegacyCookieNamesToClear() {
  const current = getAgeGateCookieName();
  return getAgeGateCookieNamesForRead().filter((name) => name !== current);
}

export function getAgeGateMaxAgeSeconds() {
  return TOKEN_MAX_AGE_SECONDS;
}
