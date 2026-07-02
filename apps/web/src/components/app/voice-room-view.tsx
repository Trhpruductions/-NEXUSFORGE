"use client";

import { useEffect, useRef } from "react";
import { Mic, Radio, Users, Activity, Settings, Shield, Plus, ArrowRight, Volume2, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

function SpectrumBar({ active }: { active: boolean }) {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!barRef.current) return;
    if (!active) {
      barRef.current.style.height = '4%';
      return;
    }
    const interval = setInterval(() => {
      if (barRef.current) barRef.current.style.height = `${Math.random() * 100}%`;
    }, 150 + Math.random() * 100);
    return () => clearInterval(interval);
  }, [active]);
  
  return (
    <div 
       ref={barRef} 
       className={cn("flex-1 bg-amber-500/20", active && "group-hover:bg-amber-500")}
    />
  );
}

function NetworkBar() {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (barRef.current) {
      barRef.current.style.height = `${20 + Math.random() * 80}%`;
    }
  }, []);
  return <div ref={barRef} className="w-full bg-emerald-500/20" />;
}

const participants = [
  { name: "Astra", role: "COMMANDER", status: "LIVE", freq: "92%" },
  { name: "Nova", role: "SUPPORT", status: "MUTED", freq: "0%" },
  { name: "Vex", role: "TACTICS", status: "LIVE", freq: "86%" },
  { name: "Cora", role: "STREAM", status: "LIVE", freq: "94%" },
];

export function VoiceRoomView({ heroImageSrc, chatPreviewSrc }: { heroImageSrc: string; chatPreviewSrc: string }) {
  return (
    <div className="flex flex-col gap-1">
      {/* HEADER: AUDIO COMMAND */}
      <div className="p-8 border border-white/10 bg-black/40 flex items-center justify-between">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-8 h-1 bg-amber-500" />
               <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Audio_Arena_v4.2</span>
            </div>
            <h1 className="text-4xl font-black uppercase text-white italic tracking-tighter">
               Comm_Array_Surface
            </h1>
         </div>
         <div className="flex gap-2">
            <div className="px-4 py-2 border border-white/5 bg-white/5 flex flex-col items-end">
               <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Global_Latency</span>
               <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">22ms STABLE</span>
            </div>
            <div className="h-12 w-px bg-white/10 mx-2" />
            <button className="px-6 py-3 bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all flex items-center gap-2">
               Initialize_Broadcast
            </button>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-1">
         {/* PARTICIPANT GRID */}
         <div className="col-span-12 lg:col-span-9 space-y-1">
            <div className="grid grid-cols-2 gap-1">
               {participants.map((p, idx) => (
                  <div key={idx} className="p-8 border border-white/10 bg-black/40 space-y-8 group hover:bg-white/5 transition-all relative overflow-hidden">
                     <div className="flex justify-between items-start relative z-10">
                        <div className="space-y-1">
                           <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">{p.role}_NODE</span>
                           <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter">{p.name}</h3>
                        </div>
                        <div className={`px-3 py-1 border ${p.status === 'LIVE' ? 'border-amber-500/20 bg-amber-500/10 text-amber-500' : 'border-white/5 bg-white/5 text-slate-600'} text-[9px] font-black uppercase tracking-widest`}>
                           {p.status}
                        </div>
                     </div>

                     <div className="space-y-4 relative z-10">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-500">
                           <span>Freq_Spectrum</span>
                           <span className="text-white">{p.freq}</span>
                        </div>
                        <div className="flex gap-1 h-12 items-end">
                           {[...Array(24)].map((_, i) => (
                              <SpectrumBar key={i} active={p.status === 'LIVE'} />
                           ))}
                        </div>
                     </div>

                     <div className="flex gap-2 relative z-10">
                        <button 
                           title="Toggle Microphone"
                           className="p-3 border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:border-white/20 transition-all"
                        >
                           <Mic className="w-4 h-4" />
                        </button>
                        <button 
                           title="Toggle Output"
                           className="p-3 border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:border-white/20 transition-all"
                        >
                           <Volume2 className="w-4 h-4" />
                        </button>
                        <div className="flex-1 px-4 py-3 border border-white/10 bg-white/5 flex items-center justify-between">
                           <span className="text-[8px] text-slate-600 font-black uppercase tracking-widest">Stream_ID</span>
                           <span className="text-[9px] text-white font-mono">0x4F...3B</span>
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         {/* AUDIO ENGINE MONITOR */}
         <div className="col-span-12 lg:col-span-3 space-y-1">
            <div className="p-8 border border-white/10 bg-black/40 space-y-8">
               <div className="space-y-4">
                  <div className="flex items-center gap-2">
                     <Radio className="w-4 h-4 text-amber-500" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">Array_Diagnostics</span>
                  </div>
                  <div className="grid gap-2">
                     {[
                        { label: "Bitrate", val: "512kbps" },
                        { label: "Codec", val: "OPUS_HQ" },
                        { label: "Channels", val: "SPATIAL_8CH" },
                     ].map(stat => (
                        <div key={stat.label} className="p-4 border border-white/5 bg-white/2 flex justify-between items-center">
                           <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{stat.label}</span>
                           <span className="text-[10px] text-white font-black">{stat.val}</span>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-500">
                     <Activity className="w-4 h-4" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">Network_Stability</span>
                  </div>
                  <div className="p-4 bg-slate-950 border border-white/5 space-y-4">
                     <div className="h-20 flex items-end gap-1">
                        {[...Array(20)].map((_, i) => (
                           <NetworkBar key={i} />
                        ))}
                     </div>
                     <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest">Jitter: 0.4ms | Loss: 0.00%</p>
                  </div>
               </div>
            </div>

            <div className="p-8 border border-white/10 bg-black/40 space-y-4">
               <button className="w-full py-4 border border-white/10 text-white text-[9px] font-black uppercase tracking-[0.3em] hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                  <Settings className="w-3 h-3" /> Audio_Settings
               </button>
               <button className="w-full py-4 border border-rose-500/20 text-rose-500 text-[9px] font-black uppercase tracking-[0.3em] hover:bg-rose-500 hover:text-white transition-all">
                  Disconnect_Array
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
