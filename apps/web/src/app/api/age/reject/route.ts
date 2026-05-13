import { NextResponse } from "next/server";
import { getAgeGateCookieNamesForRead } from "@/lib/age-gate-token";
import { buildNoStoreHeaders, enforceSameOriginMutation } from "@/lib/age-gate-request";

export async function POST(request: Request) {
  if (!enforceSameOriginMutation(request)) {
    return NextResponse.json(
      { error: "Cross-origin age verification mutation is blocked" },
      { status: 403, headers: buildNoStoreHeaders() },
    );
  }

  const response = NextResponse.json({ ok: true }, { headers: buildNoStoreHeaders() });
  for (const cookieName of getAgeGateCookieNamesForRead()) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}
