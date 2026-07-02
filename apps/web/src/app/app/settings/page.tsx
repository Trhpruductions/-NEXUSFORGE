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
    <div className="flex flex-col gap-4 text-slate-100">
      <div className="flex items-center justify-between gap-4 rounded-[28px] border border-slate-700/70 bg-slate-900/75 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="h-1 w-8 rounded-full bg-amber-400" />
               <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-500">Settings</span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-100">
               Core environment
            </h1>
         </div>
         <div className="flex gap-4">
            <div className="flex flex-col items-end rounded-2xl border border-slate-700/70 bg-slate-900/70 px-4 py-2">
               <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">System uptime</span>
               <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-100">14d : 22h : 11m</span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
         <div className="col-span-12 lg:col-span-9 space-y-1">
            <div className="grid grid-cols-1 gap-4">
               {sections.map((section, idx) => (
                  <div key={idx} className="group flex cursor-pointer items-center justify-between rounded-[28px] border border-slate-700/70 bg-slate-900/80 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.07)] transition-colors hover:bg-slate-900">
                     <div className="flex items-center gap-8">
                        <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-slate-700/70 bg-slate-900/70 transition-colors group-hover:border-amber-200">
                           <section.icon className="w-6 h-6 text-slate-500 group-hover:text-amber-600" />
                        </div>
                        <div className="space-y-1">
                           <h3 className="text-xl font-semibold tracking-tight text-slate-100">{section.label}</h3>
                           <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{section.desc}</p>
                        </div>
                     </div>
                     <ChevronRight className="w-6 h-6 text-slate-400 transition-colors group-hover:text-amber-600" />
                  </div>
               ))}
            </div>
         </div>

         <div className="col-span-12 lg:col-span-3 space-y-1">
            <div className="space-y-8 rounded-[28px] border border-slate-700/70 bg-slate-900/75 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
               <div className="space-y-4">
                  <div className="flex items-center gap-3">
                     <Binary className="w-4 h-4 text-amber-500" />
                     <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Build manifest</span>
                  </div>
                  <div className="space-y-4">
                     {[
                        { label: "Version", val: "NF-24.11.2" },
                        { label: "Branch", val: "STABLE-MAIN" },
                        { label: "Compiler", val: "RUST-NG-1.8" },
                     ].map(stat => (
                        <div key={stat.label} className="flex items-center justify-between rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 text-[10px] font-semibold uppercase tracking-widest">
                           <span className="text-slate-500">{stat.label}</span>
                           <span className="font-mono text-slate-100">{stat.val}</span>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center gap-3">
                     <RefreshCcw className="w-4 h-4 text-emerald-500" />
                     <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Sync status</span>
                  </div>
                  <div className="space-y-4 rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6">
                     <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600">Node connected</span>
                     </div>
                     <p className="text-[9px] font-semibold uppercase tracking-widest leading-relaxed text-slate-500">
                        Local environment is synchronized and ready.
                     </p>
                  </div>
               </div>
            </div>

            <div className="space-y-6 rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-center">
               <div className="space-y-2">
                  <h4 className="text-[10px] font-semibold uppercase tracking-widest text-rose-600">Destructive actions</h4>
                  <p className="text-[8px] font-semibold uppercase tracking-widest text-rose-400">Authorized personnel only</p>
               </div>
               <button className="w-full rounded-full border border-rose-200 bg-slate-900 py-4 text-[9px] font-semibold uppercase tracking-[0.3em] text-rose-600 transition-colors hover:bg-rose-100">
                  Terminate session
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
