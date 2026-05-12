import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const desktopUaToken = "NexusForgeDesktop";
const configuredRuntimeApiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const runtimeApiBase =
  process.env.NODE_ENV !== "production" && !configuredRuntimeApiBase?.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i)
    ? "http://127.0.0.1:4000"
    : configuredRuntimeApiBase ?? "http://127.0.0.1:4000";
const runtimeLaunchModeUrl = `${runtimeApiBase}/api/runtime/launch-mode`;
const launchModeCacheTtlMs = 15000;

type LaunchModeCache = {
  desktopOnly: boolean;
  expiresAt: number;
};

let launchModeCache: LaunchModeCache | null = null;

function isDesktopOnlyEnabled() {
  return process.env.NEXUSFORGE_DESKTOP_ONLY !== "false";
}

async function resolveDesktopOnlyEnabled() {
  const now = Date.now();
  if (launchModeCache && launchModeCache.expiresAt > now) {
    return launchModeCache.desktopOnly;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const response = await fetch(runtimeLaunchModeUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const payload = (await response.json()) as { desktopOnly?: boolean };
      const desktopOnly = payload.desktopOnly ?? isDesktopOnlyEnabled();
      launchModeCache = {
        desktopOnly,
        expiresAt: now + launchModeCacheTtlMs,
      };
      return desktopOnly;
    }
  } catch {
    // Fall through to env default when runtime endpoint is unavailable.
  }

  const desktopOnly = isDesktopOnlyEnabled();
  launchModeCache = {
    desktopOnly,
    expiresAt: now + launchModeCacheTtlMs,
  };
  return desktopOnly;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/desktop-only") {
    return NextResponse.next();
  }

  const userAgent = request.headers.get("user-agent") ?? "";
  if (userAgent.includes(desktopUaToken)) {
    return NextResponse.next();
  }

  const desktopOnlyEnabled = await resolveDesktopOnlyEnabled();
  if (!desktopOnlyEnabled) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/desktop-only";
  redirectUrl.search = "";
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|sw.js).*)",
  ],
};
