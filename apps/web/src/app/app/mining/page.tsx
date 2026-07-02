"use client";

import { Cpu, Zap, Activity, Database, Terminal, Shield, ArrowRight, RefreshCcw, Power, Loader2, HardDrive, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMining, MiningRig } from "@/hooks/use-mining";
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
      setInternalTemp(t => +(62 + (Math.random() * 4)).toFixed(0));
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
    <div className="flex flex-col gap-1 select-none">
      {/* HEADER: MINING CONTROL */}
      <div className="p-8 border border-white/10 bg-black/60 flex items-center justify-between nexus-corner-tick relative overflow-hidden backdrop-blur-xl">
         <div className="absolute top-0 right-0 w-64 h-64 bg-nexus-cyan/5 blur-[100px] -z-10" />
         <div className="space-y-2 text-glow">
            <div className="flex items-center gap-3">
               <div className="w-10 h-1 bg-nexus-gold shadow-[0_0_10px_rgba(251,191,36,0.6)]" />
               <span className="text-[11px] font-black text-nexus-gold uppercase tracking-[0.4em] nexus-text-pop">Mining_Infrastructure_v6.4</span>
            </div>
            <h1 className="text-4xl font-black uppercase text-white italic tracking-tighter drop-shadow-lg">
               Compute_<span className="text-nexus-cyan nexus-text-vibrant text-shadow-glow">Yield_Station</span>
            </h1>
         </div>
         <div className="flex gap-4">
            <div className="px-6 py-3 border border-white/10 bg-white/5 flex flex-col items-end nexus-corner-tick">
               <span className="text-[10px] text-nexus-purple font-black uppercase tracking-widest opacity-80">Infrastructure_Status</span>
               <span className={cn(
                  "text-[12px] font-black uppercase tracking-widest flex items-center gap-2 nexus-text-pop",
                  rigs.length > 0 ? "text-nexus-cyan" : "text-slate-500"
               )}>
                  <div className={cn(
                    "w-2 h-2 shadow-[0_0_8px]",
                    rigs.length > 0 ? "bg-nexus-cyan shadow-nexus-cyan" : "bg-slate-500 shadow-transparent"
                  )} /> 
                  {rigs.length.toString().padStart(2, '0')}_{rigs.length > 0 ? "OPERATIONAL" : "OFFLINE"}
               </span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-1">
         {/* RIG MONITOR */}
         <div className="col-span-12 lg:col-span-8 space-y-1">
            <div className="p-14 border border-white/10 bg-black/60 space-y-16 nexus-corner-tick backdrop-blur-3xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                  <Cpu className="w-64 h-64 text-nexus-cyan" />
               </div>

               {error && (
                 <div className="absolute top-0 left-0 right-0 p-4 bg-nexus-crimson/20 border-b border-nexus-crimson/40 text-nexus-crimson text-xs font-black uppercase tracking-widest text-center animate-pulse z-50">
                    CRITICAL_SYSTEM_ERROR: {error}
                 </div>
               )}

               <div className="grid grid-cols-3 gap-12 relative z-10">
                  <div className="space-y-4">
                     <p className="text-[11px] text-nexus-purple font-black uppercase tracking-widest opacity-70">Aggregate_Hashrate</p>
                     <div className="flex items-baseline gap-3">
                        <span className="text-6xl font-black text-white italic tracking-tighter drop-shadow-xl">
                          {localHashRate > 0 ? localHashRate.toFixed(2) : "00.00"}
                        </span>
                        <span className="text-nexus-cyan font-black text-sm uppercase tracking-widest nexus-text-vibrant">MH/s</span>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <p className="text-[11px] text-nexus-purple font-black uppercase tracking-widest opacity-70">Internal_Thermal</p>
                     <div className="flex items-baseline gap-3">
                        <span className={cn(
                          "text-6xl font-black italic tracking-tighter transition-colors duration-500",
                          internalTemp > 75 ? 'text-nexus-crimson drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'text-white'
                        )}>{internalTemp}&deg;</span>
                        <span className="text-slate-500 font-black text-sm uppercase tracking-widest">Celsius</span>
                     </div>
                  </div>
                  <div className="space-y-4 text-right">
                     <p className="text-[11px] text-nexus-purple font-black uppercase tracking-widest opacity-70">Accumulated_Yield</p>
                     <div className="flex items-baseline justify-end gap-3">
                        <span className="text-6xl font-black text-nexus-gold italic tracking-tighter nexus-text-pop">
                          {totalPending > 0n ? `+${totalPending.toLocaleString()}` : "00"}
                        </span>
                        <span className="text-slate-500 font-black text-sm uppercase font-mono tracking-widest">NC</span>
                     </div>
                  </div>
               </div>

               <div className="space-y-8 relative z-10">
                  <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-[0.2em] text-nexus-purple">
                     <span className="opacity-80">Distribution_Pulse_Stream</span>
                     <span className="text-nexus-gold nexus-text-pop">
                        {(rigs.length > 0 ? 80 + Math.random() * 15 : 0).toFixed(0)}% SYSTEM_UTILIZATION
                     </span>
                  </div>
                  <div className="grid grid-cols-12 md:grid-cols-24 gap-1.5 h-40">
                     {[...Array(24)].map((_, i) => {
                        const heights = ["h-[30%]", "h-[45%]", "h-[60%]", "h-[35%]", "h-[50%]", "h-[75%]", "h-[40%]", "h-[65%]"];
                        const isActive = totalHashRate > 0;
                        return (
                           <div 
                              key={i} 
                              className="bg-white/5 relative group overflow-hidden border-b border-white/5 transition-colors hover:bg-white/10"
                           >
                              <div 
                                 className={cn(
                                    "absolute bottom-0 inset-x-0 transition-all duration-1000",
                                    isActive ? "bg-nexus-cyan shadow-[0_0_15px_rgba(0,242,255,0.6)]" : "bg-white/10",
                                    isActive ? heights[i % heights.length] : "h-0"
                                 )}
                              />
                              <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                           </div>
                        );
                     })}
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                {rigs.map((rig, idx) => (
                  <div key={rig.rigId} className="p-8 border border-white/10 bg-black/60 space-y-8 group hover:bg-white/5 transition-all nexus-corner-tick backdrop-blur-md">
                      <div className="flex justify-between items-start">
                         <div className="space-y-1">
                            <span className="text-[10px] text-nexus-purple font-black uppercase tracking-widest opacity-60">MODULE_ID</span>
                            <h4 className={cn(
                              "text-2xl font-black uppercase italic tracking-tighter drop-shadow-sm", 
                              idx % 2 === 0 ? "text-nexus-cyan" : "text-nexus-purple"
                            )}>{rig.name}</h4>
                         </div>
                         <div className={cn(
                            "px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] nexus-text-pop border",
                            rig.status === "ACTIVE" ? "bg-nexus-cyan/10 border-nexus-cyan/30 text-nexus-cyan" : "bg-nexus-crimson/10 border-nexus-crimson/30 text-nexus-crimson"
                         )}>
                            {rig.status}
                         </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="p-5 bg-black/40 border border-white/5 nexus-corner-tick hover:border-nexus-gold/30 transition-colors">
                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1 opacity-70">Hash_Output</p>
                            <p className="text-xl font-black text-white italic">{rig.hashRate} MH/s</p>
                         </div>
                         <div className="p-5 bg-black/40 border border-white/5 nexus-corner-tick hover:border-nexus-cyan/30 transition-colors">
                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1 opacity-70">Efficiency</p>
                            <p className="text-xl font-black text-white italic">{(rig.efficiency * 100).toFixed(0)}%</p>
                         </div>
                      </div>
                  </div>
                ))}
                
                {rigs.length === 0 && !loading && (
                   <div className="col-span-2 p-12 border border-dashed border-white/10 bg-black/20 text-center space-y-4 nexus-corner-tick">
                      <HardDrive className="w-12 h-12 text-slate-700 mx-auto" />
                      <div className="space-y-1">
                        <p className="text-white font-black uppercase italic tracking-widest text-lg">No_Rigs_Detected</p>
                        <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Initialize infrastructure via terminal_0.1</p>
                      </div>
                   </div>
                )}
            </div>
         </div>

         {/* POOL TELEMETRY */}
         <div className="col-span-12 lg:col-span-4 space-y-1">
            <div className="p-10 border border-white/10 bg-black/60 shadow-[inset_0_0_60px_rgba(0,242,255,0.05)] space-y-10 h-full nexus-corner-tick backdrop-blur-3xl relative overflow-hidden flex flex-col">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-nexus-purple/5 blur-[100px] pointer-events-none" />
               
               <div className="space-y-6 relative z-10">
                  <div className="flex items-center gap-3">
                     <Database className="w-5 h-5 text-nexus-gold drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]" />
                     <span className="text-[12px] font-black text-white uppercase tracking-[0.3em] nexus-text-pop">Economic_Integrity</span>
                  </div>
                  <div className="space-y-1.5">
                     {[
                        { label: "Atomic_Sync", val: "VERIFIED", color: "text-nexus-cyan" },
                        { label: "Safety_Guard", val: "LOCKED", color: "text-nexus-gold" },
                        { label: "NC_Balance", val: `${Number(economy?.balance || 0).toLocaleString()} NC`, color: "text-nexus-purple" },
                        { label: "Session_Extractions", val: `+${sessionHarvested} NC`, color: "text-white" },
                     ].map(item => (
                        <div key={item.label} className="p-4 border border-white/5 bg-white/5 hover:bg-white/10 transition-colors flex justify-between items-center text-[10px] font-black uppercase tracking-widest nexus-corner-tick">
                           <span className="text-slate-500 opacity-80">{item.label}</span>
                           <span className={cn("nexus-text-pop", item.color)}>{item.val}</span>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="space-y-6 relative z-10">
                  <div className="flex items-center gap-3 text-nexus-cyan">
                     <Activity className="w-5 h-5 drop-shadow-[0_0_8px_rgba(0,242,255,0.3)]" />
                     <span className="text-[12px] font-black text-white uppercase tracking-[0.3em] nexus-text-pop">Global_Extraction</span>
                  </div>
                  <div className="p-10 border border-white/5 bg-black/40 flex flex-col items-center justify-center space-y-8 min-h-[250px] nexus-corner-tick backdrop-blur-md">
                     <div className="relative w-36 h-36 flex items-center justify-center">
                        <div className="absolute inset-0 border-[8px] border-white/5 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)]" />
                        <div className={cn(
                           "absolute inset-0 border-[8px] border-t-transparent animate-[spin_2s_linear_infinite] shadow-[0_0_20px]",
                           isHarvesting ? "border-nexus-gold shadow-nexus-gold" : "border-nexus-cyan shadow-nexus-cyan"
                        )} />
                        <div className="absolute inset-[15px] border-[2px] border-nexus-purple/30 border-b-transparent animate-[spin_4s_linear_infinite_reverse]" />
                        {isHarvesting ? (
                          <Loader2 className="w-10 h-10 text-nexus-gold animate-spin" />
                        ) : (
                          <span className="text-2xl font-black text-white italic tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                            {rigs.length > 0 ? "STABLE" : "IDLE"}
                          </span>
                        )}
                     </div>
                     <p className={cn(
                       "text-[10px] font-black uppercase tracking-[0.4em] text-center",
                       isHarvesting ? "text-nexus-gold animate-pulse" : "text-nexus-purple opacity-80"
                     )}>
                        {isHarvesting ? "INITIATING_ATOMIC_HARVEST..." : "SOLVING_BLOCK_EQUATIONS..."}
                     </p>
                  </div>
               </div>

               <div className="flex gap-2 relative z-10 mt-auto">
                  <button 
                    onClick={handleHarvest}
                    disabled={isHarvesting || rigs.length === 0}
                    className={cn(
                      "flex-1 py-5 font-black uppercase tracking-[0.2em] text-[11px] transition-all flex items-center justify-center gap-3 shadow-[0_10px_20px_-10px_rgba(0,242,255,0.4)] group overflow-hidden relative",
                      isHarvesting || rigs.length === 0 ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-nexus-cyan text-black hover:bg-white"
                    )}
                  >
                     {isHarvesting ? (
                       <Loader2 className="w-4 h-4 animate-spin" />
                     ) : (
                       <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                     )} 
                     {isHarvesting ? "PROCESSOR_BUSY" : "HARVEST_ALL_YIELD"}
                  </button>
                  <button 
                    onClick={() => refresh()}
                    title="Re-sync Telemetry"
                    className="w-16 py-5 border border-white/10 text-white font-black uppercase tracking-widest text-[11px] hover:bg-white/10 transition-all flex items-center justify-center"
                  >
                     <RefreshCcw className={cn("w-5 h-5", loading && "animate-spin")} />
                  </button>
                  <button 
                    title="Terminate Operations"
                    className="w-16 py-5 border border-nexus-crimson/20 text-nexus-crimson font-black uppercase tracking-widest text-[11px] hover:bg-nexus-crimson hover:text-white transition-all flex items-center justify-center"
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

