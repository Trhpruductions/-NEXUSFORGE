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

  return (
    <div className="flex h-full flex-col transition-colors duration-300 overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -4, filter: "blur(2px)" }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="flex h-full flex-col overflow-hidden"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}