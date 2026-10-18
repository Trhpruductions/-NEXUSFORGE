"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type RouteTransitionProps = {
  children: ReactNode;
};

export function RouteTransition({ children }: RouteTransitionProps) {
  const pathname = usePathname();
  // People who ask for reduced motion get an instant page change: no slide and no blur.
  const reduceMotion = useReducedMotion();
  const themeMode = pathname?.startsWith("/core-plus")
    ? "premium"
    : pathname?.startsWith("/app")
      ? "command"
      : pathname?.startsWith("/notifications")
        ? "signals"
        : pathname?.startsWith("/admin")
          ? "admin"
          : "nexus";

  // Set after load, not during render: prebuilt pages (like the 404 page) don't know the
  // real path on the server, and the text must match when the page hydrates.
  const [routeAnnouncement, setRouteAnnouncement] = useState("");
  useEffect(() => {
    setRouteAnnouncement(pathname ? `Navigated to ${pathname}` : "Navigated to Nexus Forge Gaming");
  }, [pathname]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme-mode", themeMode);
  }, [themeMode]);

  // The key decides what gets rebuilt on a page change. Everything under /app shares one key: its shell holds the
  // voice call, popout windows and realtime connection, and rebuilding it on every page change dropped and
  // rejoined the call (and asked for screen sharing again). Pages inside the app fade in within the shell instead.
  const transitionKey = pathname?.startsWith("/app") ? "/app" : pathname;

  return (
    <div className="flex min-h-app w-full flex-col overflow-x-hidden transition-colors duration-300">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {routeAnnouncement}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={transitionKey}
          initial={reduceMotion ? false : { opacity: 0, y: 6, filter: "blur(3px)" }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4, filter: "blur(2px)" }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
          className="flex min-h-app w-full flex-col overflow-x-hidden"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}