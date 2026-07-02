"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw, Terminal, ShieldAlert } from "lucide-react";

export default function GlobalAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Industrial logging: ship to nexus cloud or log locally
    console.error("[KERNEL_PANIC]", error);
  }, [error]);

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-slate-950 p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(251,191,36,0.12)_0%,_transparent_70%)] animate-pulse" />
      
      <div className="relative z-10 w-full max-w-xl space-y-8 rounded-[28px] border border-slate-700/70 bg-slate-900/80 p-12 shadow-[0_24px_60px_rgba(15,23,42,0.1)] backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <div className="border border-amber-200 bg-amber-50 p-4">
            <ShieldAlert className="h-12 w-12 text-amber-600" />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-amber-700">Something interrupted the workspace</p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-100">We hit a recoverable issue</h1>
          </div>
        </div>

        <div className="space-y-4 border border-slate-700/70 bg-slate-900/70 p-6 font-mono text-xs">
          <div className="flex gap-4">
            <span className="text-slate-500">Trace</span>
            <span className="uppercase text-slate-100">{error.digest || "UNRESOLVED"}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-slate-500">Message</span>
            <span className="text-slate-300">{error.message || "A temporary issue interrupted the page."}</span>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-400">
            The page can usually recover with a refresh. Your data is still protected, and the workspace should come back cleanly.
          </p>
          
          <div className="flex gap-4">
            <button
              onClick={() => reset()}
              className="flex flex-1 items-center justify-center gap-3 rounded-full bg-amber-500 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-100 transition-colors hover:bg-amber-400"
            >
              <RefreshCcw className="w-4 h-4" />
              Try again
            </button>
            <button
              onClick={() => window.location.href = '/app'}
              className="rounded-full border border-slate-700/70 px-8 py-4 text-[11px] font-semibold uppercase tracking-widest text-slate-300 transition-colors hover:bg-slate-900/70"
            >
              Back home
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-700/70 pt-6 opacity-60">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            <Terminal className="w-3 h-3" />
            NexusForge recovery mode
          </div>
          <span className="text-[10px] font-semibold text-slate-500">Code: 0xRECOVER</span>
        </div>
      </div>
    </div>
  );
}
