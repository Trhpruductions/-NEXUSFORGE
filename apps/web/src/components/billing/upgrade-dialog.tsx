"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { usePaywallStore } from "@/store/paywall-store";

/**
 * Shown whenever the server says something needs a higher plan (bigger upload, longer
 * message, more servers, a profile banner...). Mounted once for the whole app.
 */
export function UpgradeDialog() {
  const { prompt, close } = usePaywallStore();

  useEffect(() => {
    if (!prompt) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prompt, close]);

  if (!prompt || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={close} />
      <div role="dialog" aria-modal="true" aria-labelledby="upgrade-title" className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-amber-400/30 bg-[#0d1119] text-slate-100 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <div className="bg-[radial-gradient(circle_at_30%_0%,rgba(251,191,36,0.25),transparent_60%)] px-5 pb-4 pt-5">
          <button type="button" onClick={close} className="absolute right-3 top-3 rounded p-1 text-slate-400 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/10 text-amber-200"><Sparkles className="h-5 w-5" /></span>
          <h2 id="upgrade-title" className="mt-3 text-lg font-bold text-white">Upgrade to Core+ {prompt.requiredTierLabel}</h2>
          <p className="mt-1 text-sm text-slate-300">{prompt.message}</p>
        </div>
        <div className="flex gap-2 border-t border-white/5 px-5 py-4">
          <Link href="/pricing" onClick={close} className="flex-1 rounded-lg bg-amber-400 px-3 py-2 text-center text-xs font-bold text-slate-950 hover:bg-amber-300">See plans</Link>
          <button type="button" onClick={close} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-white/25">Not now</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
