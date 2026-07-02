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
    <div className="bg-black/40 border border-white/5 rounded-none overflow-hidden flex flex-col h-48 group">
      <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tactical Telemetry</span>
        </div>
        <div className="flex items-center gap-1.5">
           <div className="h-1.5 w-1.5 rounded-none bg-emerald-500 animate-pulse" />
           <span className="text-[9px] font-bold text-emerald-500/80 uppercase">Streaming</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 font-mono space-y-1.5 scrollbar-none" ref={scrollRef}>
        {logs.length === 0 && (
           <div className="h-full flex items-center justify-center opacity-20 italic text-[10px] text-slate-400">
              Awaiting data stream...
           </div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="text-[9px] flex gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
             <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
             <span className={cn(
               "font-black shrink-0",
               log.level === "success" ? "text-emerald-500" :
               log.level === "warn" ? "text-amber-500" : "text-rose-500"
             )}>[{log.module}]</span>
             <span className="text-slate-300 truncate">{log.message}</span>
          </div>
        ))}
      </div>

      <div className="px-3 py-1.5 bg-black/40 border-t border-white/5 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
               <Cpu className="w-2.5 h-2.5 text-slate-500" />
               <span className="text-[8px] text-slate-500 font-bold">4.2GHz</span>
            </div>
            <div className="flex items-center gap-1">
               <Shield className="w-2.5 h-2.5 text-emerald-500" />
               <span className="text-[8px] text-slate-500 font-bold">SECURED</span>
            </div>
         </div>
         <Activity className="w-2.5 h-2.5 text-amber-500 animate-pulse" />
      </div>
    </div>
  );
}

