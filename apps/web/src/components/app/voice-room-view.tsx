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
    <div className="flex flex-col gap-4 text-slate-900">
      <div className="flex items-center justify-between gap-4 rounded-[28px] border border-slate-900/10 bg-white/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="h-1 w-8 rounded-full bg-amber-400" />
               <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-500">Voice</span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
               Voice rooms and live audio
            </h1>
         </div>
         <div className="flex gap-2">
            <div className="flex flex-col items-end rounded-2xl border border-slate-900/10 bg-slate-50 px-4 py-2">
               <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Global latency</span>
               <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600">22ms stable</span>
            </div>
            <div className="mx-2 h-12 w-px bg-slate-300/40" />
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-50">
               Initialize broadcast
            </button>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
         <div className="col-span-12 lg:col-span-9 space-y-1">
            <div className="grid grid-cols-2 gap-4">
               {participants.map((p, idx) => (
                  <div key={idx} className="group relative overflow-hidden rounded-[28px] border border-slate-900/10 bg-white/85 p-8 shadow-[0_18px_45px_rgba(15,23,42,0.07)] transition-colors hover:bg-white space-y-8">
                     <div className="flex justify-between items-start relative z-10">
                        <div className="space-y-1">
                           <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">{p.role}</span>
                           <h3 className="text-3xl font-semibold tracking-tight text-slate-950">{p.name}</h3>
                        </div>
                        <div className={`rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-widest ${p.status === 'LIVE' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                           {p.status}
                        </div>
                     </div>

                     <div className="space-y-4 relative z-10">
                        <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-widest text-slate-500">
                           <span>Freq_Spectrum</span>
                           <span className="text-slate-900">{p.freq}</span>
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
                           className="rounded-full border border-slate-900/10 bg-white p-3 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                           <Mic className="w-4 h-4" />
                        </button>
                        <button 
                           title="Toggle Output"
                           className="rounded-full border border-slate-900/10 bg-white p-3 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                           <Volume2 className="w-4 h-4" />
                        </button>
                        <div className="flex flex-1 items-center justify-between rounded-2xl border border-slate-900/10 bg-slate-50 px-4 py-3">
                           <span className="text-[8px] font-semibold uppercase tracking-widest text-slate-500">Stream ID</span>
                           <span className="font-mono text-[9px] text-slate-900">0x4F...3B</span>
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         <div className="col-span-12 lg:col-span-3 space-y-1">
            <div className="space-y-8 rounded-[28px] border border-slate-900/10 bg-white/80 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
               <div className="space-y-4">
                  <div className="flex items-center gap-2">
                     <Radio className="w-4 h-4 text-amber-500" />
                     <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-700">Diagnostics</span>
                  </div>
                  <div className="grid gap-2">
                     {[
                        { label: "Bitrate", val: "512kbps" },
                        { label: "Codec", val: "OPUS_HQ" },
                        { label: "Channels", val: "SPATIAL_8CH" },
                     ].map(stat => (
                        <div key={stat.label} className="flex items-center justify-between rounded-2xl border border-slate-900/5 bg-slate-50 p-4">
                           <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">{stat.label}</span>
                           <span className="text-[10px] font-semibold text-slate-900">{stat.val}</span>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-500">
                     <Activity className="w-4 h-4" />
                     <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-700">Stability</span>
                  </div>
                  <div className="space-y-4 rounded-2xl border border-slate-900/5 bg-slate-50 p-4">
                     <div className="h-20 flex items-end gap-1">
                        {[...Array(20)].map((_, i) => (
                           <NetworkBar key={i} />
                        ))}
                     </div>
                     <p className="text-[8px] font-semibold uppercase tracking-widest text-slate-500">Jitter: 0.4ms | Loss: 0.00%</p>
                  </div>
               </div>
            </div>

            <div className="space-y-4 rounded-[28px] border border-slate-900/10 bg-white/80 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
               <button className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-900/10 bg-white py-4 text-[9px] font-semibold uppercase tracking-[0.3em] text-slate-700 transition-colors hover:bg-slate-50">
                  <Settings className="w-3 h-3" /> Audio settings
               </button>
               <button className="w-full rounded-full border border-rose-200 bg-rose-50 py-4 text-[9px] font-semibold uppercase tracking-[0.3em] text-rose-600 transition-colors hover:bg-rose-100">
                  Disconnect array
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
