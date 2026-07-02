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
    <div className="flex items-center gap-6 select-none">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2",
            status === "SECURED" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" : 
            status === "SCANNING" ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]" : 
            "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]",
            pulse && "opacity-40"
          )} />
          <span className="text-[9px] font-black tracking-[0.2em] text-slate-400 uppercase">
            LINK <span className={cn(
              status === "SECURED" ? "text-emerald-500" : "text-amber-500"
            )}>{status}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 opacity-50">
            <Lock className="w-2 h-2 text-white" />
            <span className="text-[7px] font-mono text-white">SHA-256 MASKED</span>
          </div>
          <div className="flex items-center gap-1 opacity-50">
            <Eye className="w-2 h-2 text-white" />
            <span className="text-[7px] font-mono text-white uppercase italic">Nexus-Vortex-Auth</span>
          </div>
        </div>
      </div>

      <div className="h-6 w-px bg-white/10" />

      <div className="flex flex-col gap-0.5">
        <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest leading-none">
          Auth_Clearance
        </span>
        <div className="flex items-center gap-1.5">
           <Terminal className="w-2.5 h-2.5 text-amber-500" />
           <span className="text-[10px] font-black text-white uppercase tracking-wider">
             {clearance || "ANONYMOUS"}
           </span>
        </div>
      </div>
    </div>
  );
}
