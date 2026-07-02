"use client";

import React, { useEffect, useState } from "react";
import { Shield, Lock, Eye, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

interface SecurityGuardProps {
  status: "SECURED" | "BREECHED" | "SCANNING";
  clearance: string;
}

export function SecurityGuard({ status, clearance }: SecurityGuardProps) {
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setPulse((p) => !p), 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex select-none items-center gap-6 rounded-[24px] border border-slate-900/10 bg-white/80 px-4 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2",
            status === "SECURED" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.35)]" : 
            status === "SCANNING" ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]" : 
            "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.35)]",
            pulse && "opacity-40"
          )} />
          <span className="text-[9px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
            Link <span className={cn(
              status === "SECURED" ? "text-emerald-600" : "text-amber-600"
            )}>{status}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 opacity-60">
            <Lock className="w-2 h-2 text-slate-500" />
            <span className="text-[7px] font-mono text-slate-500">SHA-256 masked</span>
          </div>
          <div className="flex items-center gap-1 opacity-60">
            <Eye className="w-2 h-2 text-slate-500" />
            <span className="text-[7px] font-mono italic uppercase text-slate-500">Nexus-Vortex-Auth</span>
          </div>
        </div>
      </div>

      <div className="h-6 w-px bg-slate-300/40" />

      <div className="flex flex-col gap-0.5">
        <span className="text-[7px] font-semibold leading-none tracking-widest uppercase text-slate-500">
          Auth clearance
        </span>
        <div className="flex items-center gap-1.5">
           <Terminal className="w-2.5 h-2.5 text-amber-500" />
           <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-900">
             {clearance || "ANONYMOUS"}
           </span>
        </div>
      </div>
    </div>
  );
}
