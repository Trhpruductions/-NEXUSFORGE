import { NextResponse } from "next/server";
import {
  createAgeGateToken,
  getAgeGateCookieName,
  getAgeGateLegacyCookieNamesToClear,
  getAgeGateMaxAgeSeconds,
} from "@/lib/age-gate-token";
import { assessAgeGateRisk, type AgeGateDeviceProfile } from "@/lib/age-gate-risk";
import { appendAgeGateAuditEvent } from "@/lib/age-gate-audit";
import { isAgeGateFingerprintAllowed } from "@/lib/age-gate-allowlist";
import { buildNoStoreHeaders, enforceSameOriginMutation, isSecureRequest } from "@/lib/age-gate-request";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 12;

type RateEntry = {
  count: number;
  resetAt: number;
};

const verifyRateLimitStore = new Map<string, RateEntry>();

function getClientFingerprint(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const firstForwardedIp = forwardedFor.split(",")[0]?.trim() || "";
  const ip = request.headers.get("cf-connecting-ip") || firstForwardedIp || "unknown-ip";
  const userAgent = request.headers.get("user-agent") || "unknown-agent";
  return `${ip}|${userAgent}`;
}

function consumeVerifyAttempt(key: string, now = Date.now()) {
  // Keep the in-memory limiter map bounded by removing expired entries opportunistically.
  if (verifyRateLimitStore.size > 2000) {
    for (const [entryKey, entry] of verifyRateLimitStore.entries()) {
      if (entry.resetAt <= now) {
        verifyRateLimitStore.delete(entryKey);
      }
    }
  }

  const current = verifyRateLimitStore.get(key);
  if (!current || current.resetAt <= now) {
    verifyRateLimitStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, resetAt: now + WINDOW_MS, remaining: MAX_ATTEMPTS_PER_WINDOW - 1 };
  }

  current.count += 1;
  verifyRateLimitStore.set(key, current);

  const remaining = Math.max(0, MAX_ATTEMPTS_PER_WINDOW - current.count);
  if (current.count > MAX_ATTEMPTS_PER_WINDOW) {
    return { allowed: false, resetAt: current.resetAt, remaining };
  }

  return { allowed: true, resetAt: current.resetAt, remaining };
}

export async function POST(request: Request) {
  if (!enforceSameOriginMutation(request)) {
    return NextResponse.json(
      { error: "Cross-origin age verification is blocked" },
      { status: 403, headers: buildNoStoreHeaders() },
    );
  }

  const rateKey = getClientFingerprint(request);
  const rateStatus = consumeVerifyAttempt(rateKey);
  if (!rateStatus.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rateStatus.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      {
        error: "Too many verification attempts. Try again later.",
      },
      {
        status: 429,
        headers: buildNoStoreHeaders({
          "retry-after": String(retryAfterSeconds),
        }),
      },
    );
  }

  let confirmed = false;
  let deviceProfile: AgeGateDeviceProfile | undefined;

  try {
    const payload = (await request.json()) as { confirmed?: boolean; deviceProfile?: AgeGateDeviceProfile };
    confirmed = payload.confirmed === true;
    deviceProfile = payload.deviceProfile;
  } catch {
    confirmed = false;
    deviceProfile = undefined;
  }

  if (!confirmed) {
    await appendAgeGateAuditEvent({
      action: "verify",
      status: "denied",
      confirmed: false,
      fingerprint: "unknown",
      ip: request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-ip",
      userAgent: request.headers.get("user-agent") || "unknown-agent",
      risk: { score: 0, level: "low", reasons: [] },
      deviceProfile: deviceProfile ?? {},
      note: "Age confirmation was not provided.",
    });

    return NextResponse.json({ error: "Age confirmation required" }, { status: 400, headers: buildNoStoreHeaders() });
  }

  const risk = assessAgeGateRisk(deviceProfile ?? {}, request);
  const allowedByReview = await isAgeGateFingerprintAllowed(risk.fingerprint);

  if (allowedByReview) {
    await appendAgeGateAuditEvent({
      action: "verify",
      status: "approved",
      confirmed: true,
      fingerprint: risk.fingerprint,
      ip: request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-ip",
      userAgent: request.headers.get("user-agent") || "unknown-agent",
      risk,
      deviceProfile: deviceProfile ?? {},
      note: "Verification allowed by manual review override.",
    });
  } else if (risk.level === "critical" || risk.level === "high") {
    await appendAgeGateAuditEvent({
      action: "verify",
      status: "blocked",
      confirmed: true,
      fingerprint: risk.fingerprint,
      ip: request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-ip",
      userAgent: request.headers.get("user-agent") || "unknown-agent",
      risk,
      deviceProfile: deviceProfile ?? {},
      note: "Suspicious verification attempt blocked for manual review.",
    });

    console.warn("[age-gate] suspicious verification attempt", { risk });
    return NextResponse.json(
      {
        error: "Suspicious verification behavior detected.",
        riskScore: risk.score,
        reason: risk.reasons,
        manualReview: true,
      },
      { status: 403, headers: buildNoStoreHeaders() },
    );
  }

  let token = "";
  try {
    token = await createAgeGateToken(Date.now(), request.headers.get("user-agent"));
  } catch {
    return NextResponse.json({ error: "Age gate is not configured" }, { status: 503, headers: buildNoStoreHeaders() });
  }

  await appendAgeGateAuditEvent({
    action: "verify",
    status: "approved",
    confirmed: true,
    fingerprint: risk.fingerprint,
    ip: request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-ip",
    userAgent: request.headers.get("user-agent") || "unknown-agent",
    risk,
    deviceProfile: deviceProfile ?? {},
    note: "Age verification succeeds and age gate token issued.",
  });

  const response = NextResponse.json(
    { ok: true, risk: { level: risk.level, score: risk.score, reasons: risk.reasons } },
    { headers: buildNoStoreHeaders() },
  );
  response.cookies.set(getAgeGateCookieName(isSecureRequest(request), request.url), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && isSecureRequest(request),
    sameSite: "strict",
    path: "/",
    maxAge: getAgeGateMaxAgeSeconds(),
  });

  for (const legacyName of getAgeGateLegacyCookieNamesToClear()) {
    response.cookies.set(legacyName, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}
