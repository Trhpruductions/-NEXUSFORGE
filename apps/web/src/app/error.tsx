"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCcw, ShieldAlert, Home, Zap } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log global route error telemetry
    console.error("[CRITICAL_SYSTEM_FAILURE]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.14),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] p-6 font-sans">
      <div className="mx-auto w-full max-w-2xl space-y-8 rounded-[30px] border border-slate-900/10 bg-white/90 p-10 shadow-[0_30px_90px_rgba(15,23,42,0.1)] backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
            <ShieldAlert className="h-8 w-8 text-rose-600" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-rose-700">System Recovery Mode</span>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-950 md:text-5xl">
            We hit a recoverable issue.
          </h1>
          <div className="rounded-[22px] border border-rose-200 bg-rose-50 p-6">
            <p className="break-all font-mono text-sm leading-relaxed text-rose-700">
              ERROR: {error.message || "AN_UNEXPECTED_EXCEPTION_HAS_OCCURRED"}
              <br />
              TRACE: {error.digest || "NULL_DESCRIPTOR"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-3 rounded-full bg-amber-500 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950 transition-colors hover:bg-amber-400"
          >
            <RefreshCcw className="h-4 w-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="flex items-center justify-center gap-3 rounded-full border border-slate-900/10 bg-white py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Home className="h-4 w-4" />
            Return Home
          </Link>
        </div>

        <div className="flex items-center justify-between border-t border-slate-900/10 pt-5">
          <div className="flex items-center gap-4">
             <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
             <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Automated diagnostics active</span>
          </div>
          <Zap className="h-4 w-4 text-amber-600" />
        </div>
      </div>
    </div>
  );
}
