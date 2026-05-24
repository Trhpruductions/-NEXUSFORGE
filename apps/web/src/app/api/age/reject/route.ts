import { NextResponse } from "next/server";
import { getAgeGateCookieNamesForRead } from "@/lib/age-gate-token";
import { appendAgeGateAuditEvent } from "@/lib/age-gate-audit";
import { buildNoStoreHeaders, enforceSameOriginMutation, isSecureRequest } from "@/lib/age-gate-request";

export async function POST(request: Request) {
  if (!enforceSameOriginMutation(request)) {
    return NextResponse.json(
      { error: "Cross-origin age verification mutation is blocked" },
      { status: 403, headers: buildNoStoreHeaders() },
    );
  }

  await appendAgeGateAuditEvent({
    action: "reject",
    status: "rejected",
    confirmed: false,
    fingerprint: "unknown",
    ip: request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-ip",
    userAgent: request.headers.get("user-agent") || "unknown-agent",
    risk: { score: 0, level: "low", reasons: ["User explicitly rejected age verification."] },
    deviceProfile: {},
    note: "User chose not to confirm age.",
  });

  const response = NextResponse.json({ ok: true }, { headers: buildNoStoreHeaders() });
  for (const cookieName of getAgeGateCookieNamesForRead()) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && isSecureRequest(request),
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}
