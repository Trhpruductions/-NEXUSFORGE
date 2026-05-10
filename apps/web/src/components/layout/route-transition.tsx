"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";

type RouteTransitionProps = {
  children: ReactNode;
};

export function RouteTransition({ children }: RouteTransitionProps) {
  const pathname = usePathname();
  const themeMode = pathname.startsWith("/core-plus")
    ? "premium"
    : pathname.startsWith("/app")
      ? "command"
      : pathname.startsWith("/notifications")
        ? "signals"
        : pathname.startsWith("/admin")
          ? "admin"
          : "nexus";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme-mode", themeMode);
  }, [themeMode]);

  return <div className="flex min-h-full flex-col transition-colors duration-300">{children}</div>;
}