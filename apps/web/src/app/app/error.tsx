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
    <div className="h-full bg-black flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Matrix-like Pulse */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(239,68,68,0.1)_0%,_transparent_70%)] animate-pulse" />
      
      <div className="max-w-xl w-full border border-nexus-crimson/50 bg-black/80 p-12 space-y-8 nexus-corner-tick relative z-10 backdrop-blur-xl shadow-[0_0_100px_rgba(239,68,68,0.2)]">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-nexus-crimson/10 border border-nexus-crimson/40">
            <ShieldAlert className="w-12 h-12 text-nexus-crimson" />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-black text-nexus-crimson uppercase tracking-[0.4em]">System_State: FAILURE</p>
            <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">Kernel_Panic</h1>
          </div>
        </div>

        <div className="p-6 bg-white/5 border border-white/10 space-y-4 font-mono text-xs">
          <div className="flex gap-4">
            <span className="text-slate-500">[TRACE_ID]</span>
            <span className="text-white uppercase">{error.digest || "UNRESOLVED_FLUX"}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-slate-500">[ERROR_MSG]</span>
            <span className="text-nexus-crimson">{error.message || "An industrial breach has occurred."}</span>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-slate-400 leading-relaxed uppercase tracking-tight">
            The industrial execution environment has crashed. Transaction atomicity has been preserved by current safeguards. Please re-sync with the authority.
          </p>
          
          <div className="flex gap-4">
            <button
              onClick={() => reset()}
              className="flex-1 py-5 bg-nexus-crimson text-white font-black uppercase tracking-[0.2em] text-[11px] hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3 shadow-[0_10px_20px_-10px_rgba(239,68,68,0.4)]"
            >
              <RefreshCcw className="w-4 h-4" />
              Re-Sync Authority
            </button>
            <button
              onClick={() => window.location.href = '/app'}
              className="px-8 py-5 border border-white/10 text-white font-black uppercase tracking-widest text-[11px] hover:bg-white/10 transition-all"
            >
              Return_Home
            </button>
          </div>
        </div>

        <div className="pt-6 border-t border-white/5 flex justify-between items-center opacity-40">
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-black uppercase tracking-widest">
            <Terminal className="w-3 h-3" />
            NexusForge_Debug_v0.1
          </div>
          <span className="text-[10px] text-slate-500 font-black">CODE: 0xFX_PANIC</span>
        </div>
      </div>
    </div>
  );
}
