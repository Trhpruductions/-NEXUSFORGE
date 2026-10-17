"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/layout/auth-gate";
import { useAuthStore } from "@/store/auth-store";

// The developer section is public: the overview, the updates and the marketplace are for everyone. The pages that
// manage a person's own bots, apps, settings and webhooks still require an account.
const PUBLIC_DEVELOPER_PATHS = new Set(["/developer", "/developer/bots"]);

function isPublicDeveloperPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return PUBLIC_DEVELOPER_PATHS.has(normalized);
}

/**
 * Sign-in gate for the developer section. Public pages render for everyone, and still confirm the session so a
 * signed-in person sees their own options. Every other developer page is gated as before.
 */
export function DeveloperAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    if (useAuthStore.getState().sessionStatus !== "ready") void restoreSession();
  }, [restoreSession]);

  if (isPublicDeveloperPath(pathname)) return <>{children}</>;
  return <AuthGate>{children}</AuthGate>;
}
