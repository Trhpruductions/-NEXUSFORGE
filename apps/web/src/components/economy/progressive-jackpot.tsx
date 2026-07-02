"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Coins, TrendingUp, Trophy, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface ProgressiveJackpotProps {
  slug: string;
  initialValue?: number;
}

export function ProgressiveJackpot({ slug, initialValue = 1250482 }: ProgressiveJackpotProps) {
  const [value, setValue] = useState(initialValue);
  const [isAnimating, setIsAnimating] = useState(false);
  const [error, setError] = useState(false);

  const fetchJackpot = useCallback(async () => {
    try {
      const resp = await api.get(`/api/jackpot/${slug}`);
      const data = resp.data;
      const newValue = Number(data.currentValue);
      
      if (newValue !== value) {
        setValue(newValue);
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 800);
      }
      setError(false);
    } catch (err) {
      setError(true);
    }
  }, [slug, value]);



  // Real-time synchronization
  useEffect(() => {
    fetchJackpot();
    const interval = setInterval(fetchJackpot, 5000);
    return () => clearInterval(interval);
  }, [fetchJackpot]);

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-[24px] border p-5 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all",
      error ? "border-rose-200" : "border-amber-200 hover:border-amber-300 hover:shadow-[0_24px_80px_rgba(251,191,36,0.15)]"
    )}>
      {/* Animated Background Glows */}
      <div className={cn(
        "absolute -left-10 -top-10 h-32 w-32 rounded-full blur-[60px] animate-pulse",
        error ? "bg-rose-200/40" : "bg-amber-200/35"
      )} />
      
      {/* Authority Stamp */}
      <div className="absolute -bottom-2 -right-4 rotate-[-15deg] opacity-20 group-hover:opacity-40 transition-opacity">
        <div className={cn("rounded-[10px] border-2 p-2", error ? "border-rose-400" : "border-emerald-400")}>
          <p className={cn("text-[14px] font-black uppercase tracking-tighter", error ? "text-nexus-crimson" : "text-emerald-500")}>
            {error ? "Desync Alert" : "Authority Verified"}
          </p>
          <p className={cn("text-[8px] font-mono text-center", error ? "text-nexus-crimson" : "text-emerald-500")}>
            {error ? "RETRYING_PROTOCOL..." : "BACKEND_SYNC_STABLE"}
          </p>
        </div>
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full ring-1",
                error ? "bg-rose-100 ring-rose-300" : "bg-amber-100 ring-amber-300"
            )}>
              {error ? <AlertCircle className="w-3.5 h-3.5 text-nexus-crimson" /> : <Trophy className="w-3.5 h-3.5 text-yellow-500" />}
            </div>
            <span className={cn("text-[10px] font-black uppercase tracking-[0.25em]", error ? "text-nexus-crimson" : "text-yellow-500")}>
              {slug.replace(/-/g, '_').toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 ring-1 ring-emerald-200">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span className="text-[9px] font-mono font-bold text-emerald-500">LIVE RELAY</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Coins className={cn(
              "w-10 h-10 transition-all duration-500",
              error ? "text-nexus-crimson opacity-50" : "text-yellow-500",
              isAnimating ? "scale-110 rotate-[15deg] filter brightness-125" : "scale-100"
            )} />
            {!error && <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-amber-500 opacity-0 transition-opacity animate-pulse group-hover:opacity-100" />}
          </div>
          <div className="flex flex-col">
            <div className={cn(
              "text-5xl font-black font-mono tracking-tighter transition-all duration-300 tabular-nums leading-none",
              error ? "text-rose-500/70" : isAnimating ? "scale-[1.02] text-amber-500 drop-shadow-[0_0_15px_rgba(251,191,36,0.4)]" : "text-slate-900"
            )}>
              {value.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                {error ? "TRANSACTION_STREAM_INTERRUPTED" : "Global Liquid Reserve"}
              </span>
              <div className="h-[2px] w-8 rounded-full bg-amber-500/25" />
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Hover Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-yellow-500/0 via-yellow-500/0 to-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}



