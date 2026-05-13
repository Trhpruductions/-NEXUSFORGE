import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAgeGateCookieNamesForRead, verifyAgeGateToken } from "@/lib/age-gate-token";

const desktopUaToken = "NexusForgeDesktop";
const configuredRuntimeApiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const launchModeCacheTtlMs = 15000;

type LaunchModeCache = {
  desktopOnly: boolean;
  expiresAt: number;
};

let launchModeCache: LaunchModeCache | null = null;

function isDesktopOnlyEnabled() {
  return process.env.NEXUSFORGE_DESKTOP_ONLY === "true";
}

function resolveRuntimeApiBase(request: NextRequest) {
  if (configuredRuntimeApiBase) {
    return configuredRuntimeApiBase;
  }

  const hostname = request.nextUrl.hostname;
  const runningLocally = hostname === "localhost" || hostname === "127.0.0.1";
  if (runningLocally) {
    return "http://127.0.0.1:4000";
  }

  // Hosted deployments should probe runtime mode from their own origin when explicit API base is absent.
  return request.nextUrl.origin;
}

async function resolveDesktopOnlyEnabled(request: NextRequest) {
  const now = Date.now();
  if (launchModeCache && launchModeCache.expiresAt > now) {
    return launchModeCache.desktopOnly;
  }

  const runtimeLaunchModeUrl = `${resolveRuntimeApiBase(request)}/api/runtime/launch-mode`;

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
  const isDesktopUpdateAsset =
    pathname === "/desktop-update.json" ||
    /^\/NexusForge(?:%20|\s)Desktop(?:%20|\s)Setup.*\.exe$/i.test(pathname);

  const isAgeGateRoute = pathname === "/age-gate";
  const isAgeApiRoute = pathname.startsWith("/api/age/");

  if (!isAgeGateRoute && !isAgeApiRoute && !isDesktopUpdateAsset) {
    const ageCookieNames = getAgeGateCookieNamesForRead();
    const ageCookie = ageCookieNames.map((name) => request.cookies.get(name)?.value || "").find(Boolean) || "";
    const verified = ageCookie ? await verifyAgeGateToken(ageCookie, Date.now(), request.headers.get("user-agent")) : false;
    if (!verified) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/age-gate";
      redirectUrl.search = `next=${encodeURIComponent(`${pathname}${request.nextUrl.search}`)}`;
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (pathname === "/desktop-only" || isDesktopUpdateAsset) {
    return NextResponse.next();
  }

  const userAgent = request.headers.get("user-agent") ?? "";
  if (userAgent.includes(desktopUaToken)) {
    return NextResponse.next();
  }

  const desktopOnlyEnabled = await resolveDesktopOnlyEnabled(request);
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
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|sw.js|desktop-update\.json|NexusForge%20Desktop%20Setup.*\.exe).*)",
  ],
};
