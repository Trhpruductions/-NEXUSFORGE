"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type LocalStackStatus = {
  launchMode?: string;
  startUrl?: string;
  localRecoveryEnabled?: boolean;
  message?: string;
};

type DesktopBridge = {
  runtime?: string;
  getLocalStackStatus?: () => Promise<LocalStackStatus>;
};

type BadgeMode = "local" | "hosted" | "hosted-fallback" | "detecting";

function resolveBadgeMode(status: LocalStackStatus | null): BadgeMode {
  if (!status) {
    return "detecting";
  }

  const launchMode = String(status.launchMode || "").toLowerCase();
  const message = String(status.message || "").toLowerCase();

  if (launchMode === "local-dev") {
    return "local";
  }

  if (launchMode === "hosted") {
    if (message.includes("switched to hosted")) {
      return "hosted-fallback";
    }
    return "hosted";
  }

  return "detecting";
}

export function DesktopLaunchModeBadge() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<LocalStackStatus | null>(null);

  const isAppRoute = pathname === "/app" || pathname?.startsWith("/app/");

  useEffect(() => {
    if (!isAppRoute) {
      return;
    }

    const bridge = (window as { nexusforgeDesktop?: DesktopBridge }).nexusforgeDesktop;
    if (!bridge || bridge.runtime !== "electron" || typeof bridge.getLocalStackStatus !== "function") {
      return;
    }

    let cancelled = false;
    setEnabled(true);

    const refresh = async () => {
      try {
        const next = await bridge.getLocalStackStatus?.();
        if (!cancelled && next) {
          setStatus(next);
        }
      } catch {
        // Keep current badge state when status probe fails.
      }
    };

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isAppRoute]);

  const mode = useMemo(() => resolveBadgeMode(status), [status]);

  if (!enabled || !isAppRoute) {
    return null;
  }

  const label =
    mode === "local"
      ? "Live Mode: Local"
      : mode === "hosted-fallback"
        ? "Live Mode: Hosted Fallback"
        : mode === "hosted"
          ? "Live Mode: Hosted"
          : "Live Mode: Detecting";

  const toneClass =
    mode === "local"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : mode === "hosted-fallback"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : mode === "hosted"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-900/10 bg-white text-slate-700";

  return (
    <div className={`pointer-events-none fixed bottom-4 right-4 z-[110] rounded-[14px] border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] shadow-[0_14px_32px_rgba(2,6,23,0.18)] backdrop-blur ${toneClass}`}>
      {label}
    </div>
  );
}

