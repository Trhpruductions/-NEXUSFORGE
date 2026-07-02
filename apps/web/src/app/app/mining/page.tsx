"use client";

import { Cpu, Activity, Database, RefreshCcw, Power, Loader2, HardDrive, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMining } from "@/hooks/use-mining";
import { useEconomy } from "@/hooks/use-economy";

export default function MiningPage() {
  const { rigs, loading, error, isHarvesting, harvestAll, refresh } = useMining();
  const { data: economy } = useEconomy("current"); // Logic for "current" would be handled in hook or middleware
  
  const [sessionHarvested, setSessionHarvested] = useState<string>("0");
  const [localHashRate, setLocalHashRate] = useState(0);
  const [internalTemp, setInternalTemp] = useState(62);

  const totalHashRate = rigs.reduce((acc, rig) => acc + rig.hashRate, 0);
  const totalPending = rigs.reduce((acc, rig) => acc + BigInt(rig.currentYield), 0n);

  useEffect(() => {
    setLocalHashRate(totalHashRate);
  }, [totalHashRate]);

  // Visual jitter for "live" feel
  useEffect(() => {
    const interval = setInterval(() => {
      if (totalHashRate > 0) {
        setLocalHashRate(prev => +(prev + (Math.random() * 0.4 - 0.2)).toFixed(2));
      }
      setInternalTemp(() => +(62 + (Math.random() * 4)).toFixed(0));
    }, 3000);
    return () => clearInterval(interval);
  }, [totalHashRate]);

  const handleHarvest = async () => {
    const result = await harvestAll();
    if (result) {
      setSessionHarvested(prev => (BigInt(prev) + BigInt(result)).toString());
    }
  };

  return (
      <div className="cinematic-stage metal-corners flex select-none flex-col gap-4 text-slate-100 nf-content-rhythm">
         <div className="cinematic-particles" />
         <div className="forge-frame relative flex flex-col justify-between gap-4 overflow-hidden rounded-[28px] p-5 backdrop-blur-xl md:p-8 lg:flex-row lg:items-center">
         <div className="absolute -z-10 h-64 w-64 top-0 right-0 bg-sky-200/30 blur-[100px]" />
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="h-1 w-10 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.35)]" />
               <span className="nf-type-eyebrow text-slate-300">Mining grid</span>
            </div>
            <h1 className="nf-type-title text-slate-100 md:text-4xl">
               Industrial yield command center
            </h1>
         </div>
         <div className="flex w-full gap-3 md:gap-4 lg:w-auto">
            <div className="flex w-full flex-col items-end rounded-2xl border border-slate-700/70 bg-slate-900/70 px-4 py-3 md:px-6 lg:w-auto">
               <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Infrastructure status</span>
               <span className={cn(
                  "flex items-center gap-2 text-[12px] font-semibold uppercase tracking-widest",
                  rigs.length > 0 ? "text-sky-600" : "text-slate-500"
               )}>
                  <div className={cn(
                    "h-2 w-2 rounded-full shadow-[0_0_8px]",
                    rigs.length > 0 ? "bg-sky-500 shadow-sky-500" : "bg-slate-400 shadow-transparent"
                  )} /> 
                  {rigs.length.toString().padStart(2, '0')} {rigs.length > 0 ? "operational" : "offline"}
               </span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
         <div className="col-span-12 xl:col-span-8 space-y-3">
            <div className="forge-frame relative overflow-hidden rounded-[28px] p-5 backdrop-blur-3xl md:p-8 xl:p-12 space-y-8 md:space-y-12">
               <div className="pointer-events-none absolute top-0 right-0 p-12 opacity-[0.04]">
                  <Cpu className="w-64 h-64 text-sky-300" />
               </div>

               {error && (
                 <div className="absolute top-0 left-0 right-0 z-50 border-b border-rose-200 bg-rose-50 p-4 text-center text-xs font-semibold uppercase tracking-widest text-rose-700 animate-pulse">
                    CRITICAL_SYSTEM_ERROR: {error}
                 </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 xl:gap-12 relative z-10">
                  <div className="space-y-4">
                     <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 opacity-70">Aggregate hash rate</p>
                     <div className="flex items-baseline gap-3">
                        <span className="text-4xl font-semibold tracking-tight text-slate-100 md:text-5xl xl:text-6xl">
                          {localHashRate > 0 ? localHashRate.toFixed(2) : "00.00"}
                        </span>
                        <span className="text-sm font-semibold uppercase tracking-widest text-sky-600">MH/s</span>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 opacity-70">Internal temperature</p>
                     <div className="flex items-baseline gap-3">
                                    <span className={cn(
                                       "text-4xl font-semibold tracking-tight transition-colors duration-500 md:text-5xl xl:text-6xl",
                          internalTemp > 75 ? 'text-rose-600' : 'text-slate-100'
                        )}>{internalTemp}&deg;</span>
                        <span className="text-sm font-semibold uppercase tracking-widest text-slate-500">Celsius</span>
                     </div>
                  </div>
                  <div className="space-y-4 md:text-right">
                     <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 opacity-70">Accumulated yield</p>
                     <div className="flex items-baseline justify-end gap-3">
                        <span className="text-4xl font-semibold tracking-tight text-amber-600 md:text-5xl xl:text-6xl">
                          {totalPending > 0n ? `+${totalPending.toLocaleString()}` : "00"}
                        </span>
                        <span className="text-sm font-semibold uppercase tracking-widest text-slate-500">NC</span>
                     </div>
                  </div>
               </div>

               <div className="space-y-8 relative z-10">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                     <span className="opacity-80">Distribution pulse</span>
                     <span className="text-amber-600">
                        {(rigs.length > 0 ? 80 + Math.random() * 15 : 0).toFixed(0)}% utilization
                     </span>
                  </div>
                  <div className="grid grid-cols-12 md:grid-cols-24 gap-1.5 h-32 md:h-40">
                     {[...Array(24)].map((_, i) => {
                        const heights = ["h-[30%]", "h-[45%]", "h-[60%]", "h-[35%]", "h-[50%]", "h-[75%]", "h-[40%]", "h-[65%]"];
                        const isActive = totalHashRate > 0;
                        return (
                           <div 
                              key={i} 
                              className="group relative overflow-hidden border-b border-slate-700/60 bg-slate-900/80 transition-colors hover:bg-slate-200"
                           >
                              <div 
                                 className={cn(
                                    "absolute bottom-0 inset-x-0 transition-all duration-1000",
                                    isActive ? "bg-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.45)]" : "bg-slate-900/20",
                                    isActive ? heights[i % heights.length] : "h-0"
                                 )}
                              />
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-white/40 to-transparent" />
                           </div>
                        );
                     })}
                  </div>
               </div>
            </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 nf-stagger nf-stagger-base-60">
                {rigs.map((rig, idx) => (
               <div key={rig.rigId} className={cn("forge-frame group space-y-6 rounded-[28px] p-5 backdrop-blur-md md:p-7 nf-interact", idx % 3 === 0 && "nf-stagger-item-0", idx % 3 === 1 && "nf-stagger-item-1", idx % 3 === 2 && "nf-stagger-item-2")}>
                      <div className="flex items-start justify-between">
                         <div className="space-y-1">
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 opacity-60">Module</span>
                            <h4 className="text-2xl font-semibold tracking-tight text-slate-100">{rig.name}</h4>
                         </div>
                         <div className={cn(
                            "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] border",
                            rig.status === "ACTIVE" ? "bg-sky-500/15 border-sky-400/50 text-sky-200" : "bg-rose-500/15 border-rose-400/50 text-rose-200"
                         )}>
                            {rig.status}
                         </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                         <div className="forge-panel rounded-2xl p-4 md:p-5 transition-colors hover:border-sky-400/40">
                            <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-slate-500 opacity-70">Hash output</p>
                            <p className="text-xl font-semibold text-slate-100">{rig.hashRate} MH/s</p>
                         </div>
                         <div className="forge-panel rounded-2xl p-4 md:p-5 transition-colors hover:border-sky-400/40">
                            <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-slate-500 opacity-70">Efficiency</p>
                            <p className="text-xl font-semibold text-slate-100">{(rig.efficiency * 100).toFixed(0)}%</p>
                         </div>
                      </div>
                  </div>
                ))}
                
                {rigs.length === 0 && !loading && (
                   <div className="col-span-1 space-y-4 rounded-[28px] border border-dashed border-slate-700/70 bg-slate-900/65 p-8 text-center md:col-span-2 md:p-12">
                      <HardDrive className="mx-auto w-12 h-12 text-slate-300" />
                      <div className="space-y-1">
                        <p className="text-lg font-semibold tracking-tight text-slate-100">No rigs detected</p>
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Initialize infrastructure when you are ready</p>
                      </div>
                   </div>
                )}
            </div>
         </div>

         <div className="col-span-12 xl:col-span-4 space-y-3">
            <div className="forge-frame relative flex h-full flex-col space-y-8 overflow-hidden rounded-[28px] p-5 backdrop-blur-3xl md:p-8 md:space-y-10">
               <div className="pointer-events-none absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 bg-sky-200/20 blur-[100px]" />
               
               <div className="space-y-6 relative z-10">
                  <div className="flex items-center gap-3">
                     <Database className="w-5 h-5 text-amber-500" />
                     <span className="text-[12px] font-semibold uppercase tracking-[0.3em] text-slate-300">Economy</span>
                  </div>
                  <div className="space-y-1.5">
                     {[
                        { label: "Atomic sync", val: "Verified", color: "text-sky-600" },
                        { label: "Safety guard", val: "Locked", color: "text-amber-600" },
                        { label: "NC balance", val: `${Number(economy?.balance || 0).toLocaleString()} NC`, color: "text-slate-100" },
                        { label: "Session harvest", val: `+${sessionHarvested} NC`, color: "text-slate-100" },
                     ].map(item => (
                        <div key={item.label} className="forge-panel flex items-center justify-between rounded-2xl p-4 text-[10px] font-semibold uppercase tracking-widest transition-colors hover:bg-slate-900">
                           <span className="text-slate-500 opacity-80">{item.label}</span>
                           <span className={cn(item.color)}>{item.val}</span>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="space-y-6 relative z-10">
                  <div className="flex items-center gap-3 text-sky-600">
                     <Activity className="w-5 h-5" />
                     <span className="text-[12px] font-semibold uppercase tracking-[0.3em] text-slate-300">Harvest status</span>
                  </div>
                  <div className="forge-panel flex min-h-[220px] flex-col items-center justify-center space-y-6 rounded-[28px] p-6 md:min-h-[250px] md:p-10 md:space-y-8 backdrop-blur-md">
                     <div className="relative w-36 h-36 flex items-center justify-center">
                        <div className="absolute inset-0 border-[8px] border-slate-200 shadow-[inset_0_0_30px_rgba(15,23,42,0.08)]" />
                        <div className={cn(
                           "absolute inset-0 border-[8px] border-t-transparent animate-[spin_2s_linear_infinite] shadow-[0_0_20px]",
                           isHarvesting ? "border-amber-400 shadow-amber-400" : "border-sky-400 shadow-sky-400"
                        )} />
                        <div className="absolute inset-[15px] animate-[spin_4s_linear_infinite_reverse] border-[2px] border-b-transparent border-slate-300" />
                        {isHarvesting ? (
                          <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
                        ) : (
                          <span className="text-2xl font-semibold tracking-tight text-slate-100">
                            {rigs.length > 0 ? "Stable" : "Idle"}
                          </span>
                        )}
                     </div>
                     <p className={cn(
                       "text-center text-[10px] font-semibold uppercase tracking-[0.4em]",
                       isHarvesting ? "text-amber-600 animate-pulse" : "text-slate-500 opacity-80"
                     )}>
                        {isHarvesting ? "Collecting yield..." : "Ready to harvest"}
                     </p>
                  </div>
               </div>

               <div className="relative z-10 mt-auto flex gap-2">
                  <button 
                    onClick={handleHarvest}
                    disabled={isHarvesting || rigs.length === 0}
                              className={cn(
                                 "group relative flex flex-1 items-center justify-center gap-3 overflow-hidden rounded-full py-4 text-[11px] font-semibold uppercase tracking-[0.2em] transition-all duration-300",
                                                 isHarvesting || rigs.length === 0 ? "cursor-not-allowed bg-slate-700/60 text-slate-400" : "nf-control nf-interact"
                              )}
                  >
                     {isHarvesting ? (
                       <Loader2 className="w-4 h-4 animate-spin" />
                     ) : (
                       <CheckCircle2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                     )} 
                     {isHarvesting ? "Processing" : "Harvest all"}
                  </button>
                  <button 
                    onClick={() => refresh()}
                    title="Re-sync Telemetry"
                              className="flex w-14 items-center justify-center rounded-full border border-slate-700/70 py-4 text-[11px] font-semibold uppercase tracking-widest text-slate-300 transition-all duration-300 hover:border-sky-400/60 hover:bg-sky-500/10 md:w-16 md:py-5 nf-interact"
                  >
                     <RefreshCcw className={cn("w-5 h-5", loading && "animate-spin")} />
                  </button>
                  <button 
                    title="Terminate Operations"
                              className="flex w-14 items-center justify-center rounded-full border border-rose-400/45 py-4 text-[11px] font-semibold uppercase tracking-widest text-rose-300 transition-all duration-300 hover:bg-rose-500/15 md:w-16 md:py-5 nf-interact"
                  >
                     <Power className="w-5 h-5" />
                  </button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

