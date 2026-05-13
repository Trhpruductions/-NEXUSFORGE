import { NextResponse } from "next/server";
import {
  createAgeGateToken,
  getAgeGateCookieName,
  getAgeGateLegacyCookieNamesToClear,
  getAgeGateMaxAgeSeconds,
} from "@/lib/age-gate-token";
import { buildNoStoreHeaders, enforceSameOriginMutation } from "@/lib/age-gate-request";

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
  try {
    const payload = (await request.json()) as { confirmed?: boolean };
    confirmed = payload.confirmed === true;
  } catch {
    confirmed = false;
  }

  if (!confirmed) {
    return NextResponse.json({ error: "Age confirmation required" }, { status: 400, headers: buildNoStoreHeaders() });
  }

  let token = "";
  try {
    token = await createAgeGateToken(Date.now(), request.headers.get("user-agent"));
  } catch {
    return NextResponse.json({ error: "Age gate is not configured" }, { status: 503, headers: buildNoStoreHeaders() });
  }

  const response = NextResponse.json({ ok: true }, { headers: buildNoStoreHeaders() });
  response.cookies.set(getAgeGateCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
