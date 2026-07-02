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
    // Log industrial error telemetry
    console.error("[CRITICAL_SYSTEM_FAILURE]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 font-sans">
      <div className="max-w-2xl w-full border border-nexus-crimson/30 bg-black/40 nexus-corner-tick p-12 space-y-10 backdrop-blur-xl relative overflow-hidden">
        {/* SCANLINE EFFECT */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-50 bg-[length:100%_2px,3px_100%]" />
        
        <div className="flex items-center gap-4 text-nexus-crimson animate-pulse">
          <ShieldAlert className="w-10 h-10" />
          <span className="text-[12px] font-black uppercase tracking-[0.4em]">Protocol_Breach // System_Failure</span>
        </div>

        <div className="space-y-4">
          <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
            Kernel_<span className="text-nexus-crimson">Panic_Logged</span>
          </h1>
          <div className="p-6 bg-nexus-crimson/5 border border-nexus-crimson/20 nexus-corner-tick">
            <p className="text-nexus-crimson font-mono text-sm break-all leading-relaxed">
              [OS_TRAP]: {error.message || "AN_UNEXPECTED_EXCEPTION_HAS_OCCURRED"}
              <br />
              [TRACE_ID]: {error.digest || "NULL_DESCRIPTOR"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-3 py-5 bg-nexus-crimson text-white font-black uppercase tracking-widest text-xs hover:bg-white hover:text-black transition-all group"
          >
            <RefreshCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
            Initiate_Hot_Reload
          </button>
          <Link
            href="/"
            className="flex items-center justify-center gap-3 py-5 border border-white/10 text-slate-400 font-black uppercase tracking-widest text-xs hover:border-nexus-cyan hover:text-nexus-cyan transition-all"
          >
            <Home className="w-4 h-4" />
            Return_to_Command
          </Link>
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-white/5 opacity-40">
          <div className="flex items-center gap-4">
             <div className="w-2 h-2 bg-nexus-crimson rounded-full animate-ping" />
             <span className="text-[10px] font-black uppercase tracking-widest text-white">Automated_Diagnostics_Active</span>
          </div>
          <Zap className="w-4 h-4 text-nexus-gold" />
        </div>
      </div>
    </div>
  );
}
