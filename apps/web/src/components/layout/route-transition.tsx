"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

type RouteTransitionProps = {
  children: ReactNode;
};

export function RouteTransition({ children }: RouteTransitionProps) {
  const pathname = usePathname();
  const themeMode = pathname?.startsWith("/core-plus")
    ? "premium"
    : pathname?.startsWith("/app")
      ? "command"
      : pathname?.startsWith("/notifications")
        ? "signals"
        : pathname?.startsWith("/admin")
          ? "admin"
          : "nexus";

  const routeAnnouncement = pathname ? `Navigated to ${pathname}` : "Navigated to NexusForge";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme-mode", themeMode);
  }, [themeMode]);

  return (
    <div className="flex min-h-dvh w-full flex-col overflow-x-hidden transition-colors duration-300">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {routeAnnouncement}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -4, filter: "blur(2px)" }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="flex min-h-dvh w-full flex-col overflow-x-hidden"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}