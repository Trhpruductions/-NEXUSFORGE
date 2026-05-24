import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const desktopUaToken = "NexusForgeDesktop";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDesktopUpdateAsset =
    pathname === "/desktop-update.json" ||
    /^\/NexusForge(?:%20|\s)Desktop(?:%20|\s)Setup.*\.exe$/i.test(pathname);

  const isApiRoute = pathname.startsWith("/api/");

  const publicRoutes = ["/", "/login", "/register", "/support", "/beta", "/terms", "/privacy", "/forgot-password", "/age-gate"];
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  const userAgent = request.headers.get("user-agent") ?? "";
  if (userAgent.includes(desktopUaToken)) {
    return NextResponse.next();
  }

  if (pathname === "/desktop-only" || isDesktopUpdateAsset || isPublicRoute || isApiRoute) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|sw.js|desktop-update\.json|NexusForge%20Desktop%20Setup.*\.exe).*)",
  ],
};
