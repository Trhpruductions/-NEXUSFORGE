"use client";

import { Settings, Shield, Bell, User, Cpu, Database, ChevronRight, Binary, Lock, RefreshCcw } from "lucide-react";

const sections = [
  { id: "account", label: "Identity_Matrix", desc: "Core biometric and credential layers", icon: User },
  { id: "security", label: "Hardened_Shell", desc: "Encryption keys and intrusion audit logs", icon: Shield },
  { id: "notifications", label: "Telemetry_Alerts", desc: "Signal routing and event priority", icon: Bell },
  { id: "engine", label: "Nexus_Core_Tuning", desc: "Hardware acceleration and clock rates", icon: Cpu },
  { id: "privacy", label: "Cloak_Protocols", desc: "Metadata masking and link obscuration", icon: Lock },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-1">
      {/* HEADER: CONFIG CONTROL */}
      <div className="p-8 border border-white/10 bg-black/40 flex items-center justify-between">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-8 h-1 bg-amber-500" />
               <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">System_Config_Manifold_v0.8</span>
            </div>
            <h1 className="text-4xl font-black uppercase text-white italic tracking-tighter">
               Core_Environment_Variables
            </h1>
         </div>
         <div className="flex gap-4">
            <div className="px-4 py-2 border border-white/5 bg-white/5 flex flex-col items-end">
               <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">System_Uptime</span>
               <span className="text-[10px] text-white font-black uppercase tracking-widest">14D : 22H : 11M</span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-1">
         {/* SECTIONS GRID */}
         <div className="col-span-12 lg:col-span-9 space-y-1">
            <div className="grid grid-cols-1 gap-1">
               {sections.map((section, idx) => (
                  <div key={idx} className="p-8 border border-white/10 bg-black/40 group hover:bg-white/5 transition-all cursor-pointer flex items-center justify-between">
                     <div className="flex items-center gap-8">
                        <div className="w-16 h-16 border border-white/10 bg-slate-950 flex items-center justify-center group-hover:border-amber-500/50 transition-all">
                           <section.icon className="w-6 h-6 text-slate-500 group-hover:text-amber-500" />
                        </div>
                        <div className="space-y-1">
                           <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">{section.label}</h3>
                           <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">{section.desc}</p>
                        </div>
                     </div>
                     <ChevronRight className="w-6 h-6 text-slate-700 group-hover:text-amber-500 transition-all" />
                  </div>
               ))}
            </div>
         </div>

         {/* DIAGNOSTICS ASIDE */}
         <div className="col-span-12 lg:col-span-3 space-y-1">
            <div className="p-8 border border-white/10 bg-black/40 space-y-8">
               <div className="space-y-4">
                  <div className="flex items-center gap-3">
                     <Binary className="w-4 h-4 text-amber-500" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">Build_Manifest</span>
                  </div>
                  <div className="space-y-4">
                     {[
                        { label: "Version", val: "NF-24.11.2" },
                        { label: "Branch", val: "STABLE-MAIN" },
                        { label: "Compiler", val: "RUST-NG-1.8" },
                     ].map(stat => (
                        <div key={stat.label} className="p-4 border border-white/5 bg-white/2 flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                           <span className="text-slate-500">{stat.label}</span>
                           <span className="text-white font-mono">{stat.val}</span>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center gap-3">
                     <RefreshCcw className="w-4 h-4 text-emerald-500" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">Sync_Status</span>
                  </div>
                  <div className="p-6 border border-white/5 bg-white/2 space-y-4">
                     <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-emerald-500" />
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Node_Connected</span>
                     </div>
                     <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                        Local environment is 100% synchronized with Nexus_Primary_Forge.
                     </p>
                  </div>
               </div>
            </div>

            <div className="p-8 border border-rose-500/20 bg-rose-500/5 space-y-6 text-center">
               <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Destructive_Overrides</h4>
                  <p className="text-[8px] text-rose-300 font-bold uppercase tracking-widest">Authorized_Personnel_Only</p>
               </div>
               <button className="w-full py-4 border border-rose-500/30 text-rose-500 text-[9px] font-black uppercase tracking-[0.3em] hover:bg-rose-500 hover:text-white transition-all">
                  TERMINATE_SESSION
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
