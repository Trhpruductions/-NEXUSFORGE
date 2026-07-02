"use client";

import React, { useEffect, useState, useRef } from "react";
import { Terminal, Shield, Activity, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  module: string;
  message: string;
}

const MODULES = ["CRYPTO", "MINING", "NETWORK", "SECURITY", "PROTOCOL", "DATABASE"];
const MESSAGES = [
  "IP Salt-Anonymization: Active & Restricted",
  "JWT Privacy Strip: PI-Data Scrubbed",
  "Prisma Stability: Connection Pool Hardened",
  "Atomic Transaction: Guardian Logic Verified",
  "Global Jackpot: Syncing with Authority",
  "Packet Inspection: 0 reverse attempts",
  "Authorized Node: Command Central Handshake",
  "System Stability: 99.9% (Industrial Grade)",
  "GHOST-IP Masking: [SHA256] Success",
  "Vault Entitlement: [CORE-PLUS] Verified",
  "Mining Pulse: Efficiency at [OPTIMAL]",
  "Progressive Jackpot: Tracking Multi-Layered Pool",
];

export function LiveTacticalLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const addLog = () => {
      const newLog: LogEntry = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        level: Math.random() > 0.8 ? "warn" : Math.random() > 0.95 ? "error" : "success",
        module: MODULES[Math.floor(Math.random() * MODULES.length)],
        message: MESSAGES[Math.floor(Math.random() * MESSAGES.length)],
      };
      setLogs(prev => [...prev.slice(-4), newLog]);
    };

    const interval = setInterval(addLog, 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-48 flex-col overflow-hidden rounded-[24px] border border-slate-900/10 bg-white/80 shadow-[0_18px_45px_rgba(15,23,42,0.07)] group">
      <div className="flex items-center justify-between border-b border-slate-900/5 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Tactical telemetry</span>
        </div>
        <div className="flex items-center gap-1.5">
           <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[9px] font-semibold uppercase text-emerald-600">Streaming</span>
        </div>
      </div>
      
      <div className="flex-1 space-y-1.5 overflow-y-auto p-2 font-mono scrollbar-none" ref={scrollRef}>
        {logs.length === 0 && (
           <div className="flex h-full items-center justify-center text-[10px] italic text-slate-400 opacity-30">
              Awaiting data stream...
           </div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="text-[9px] flex gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
             <span className="shrink-0 text-slate-500">[{log.timestamp}]</span>
             <span className={cn(
               "shrink-0 font-semibold",
               log.level === "success" ? "text-emerald-600" :
               log.level === "warn" ? "text-amber-600" : "text-rose-600"
             )}>[{log.module}]</span>
             <span className="truncate text-slate-600">{log.message}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-slate-900/5 bg-slate-50 px-3 py-1.5">
         <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
               <Cpu className="w-2.5 h-2.5 text-slate-500" />
               <span className="text-[8px] font-semibold text-slate-500">4.2GHz</span>
            </div>
            <div className="flex items-center gap-1">
               <Shield className="w-2.5 h-2.5 text-emerald-500" />
               <span className="text-[8px] font-semibold text-slate-500">Secured</span>
            </div>
         </div>
         <Activity className="w-2.5 h-2.5 text-amber-500 animate-pulse" />
      </div>
    </div>
  );
}

