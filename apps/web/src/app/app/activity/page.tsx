"use client";

import { Activity, Clock, Terminal, Users, Search, Filter } from "lucide-react";

const activity = [
  { when: "2m ago", user: "ArcticWolf", action: "Started a Valorant session", origin: "US East" },
  { when: "5m ago", user: "LunaKnight", action: "Shared an invite to Apex Legends", origin: "EU West" },
  { when: "10m ago", user: "NightHawk", action: "Opened a private channel", origin: "Internal" },
  { when: "15m ago", user: "PixelPirate", action: "Synced Rocket League progress", origin: "Cloud" },
  { when: "18m ago", user: "SteelReaper", action: "Published a new asset pack", origin: "Auto sync" },
  { when: "22m ago", user: "VoidWalker", action: "Joined a voice room", origin: "Workspace" },
];

export default function ActivityPage() {
  return (
      <div className="cinematic-stage metal-corners flex flex-col gap-4 text-slate-100 nf-content-rhythm">
         <div className="cinematic-particles" />
         <div className="forge-frame flex items-center justify-between gap-4 rounded-[28px] p-6 backdrop-blur-xl md:p-8">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="h-1 w-8 rounded-full bg-sky-400" />
               <span className="nf-type-eyebrow text-slate-300">Activity feed</span>
            </div>
            <h1 className="nf-type-title text-slate-100 md:text-4xl">
               Live operations timeline
            </h1>
         </div>
         <div className="flex gap-2">
            <button className="forge-btn-secondary inline-flex items-center gap-2 rounded-full px-4 py-3 text-[10px] font-semibold uppercase tracking-widest transition-colors md:px-6 nf-interact">
               <Search className="w-3 h-3" /> Search
            </button>
            <button className="forge-btn-secondary inline-flex items-center gap-2 rounded-full px-4 py-3 text-[10px] font-semibold uppercase tracking-widest transition-colors md:px-6 nf-interact">
               <Filter className="w-3 h-3" /> Filter
            </button>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
         <div className="col-span-12 space-y-3 lg:col-span-9">
            {activity.map((item, idx) => (
               <div key={idx} className="forge-panel group flex items-center gap-6 rounded-[22px] p-5 transition-colors hover:bg-slate-900 md:p-6 nf-interact">
                  <div className="flex w-24 items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                     <Clock className="w-3 h-3 text-sky-300/70" /> {item.when}
                  </div>
                  
                  <div className="flex-1 flex items-center gap-4">
                     <div className="flex h-10 w-10 items-center justify-center border border-slate-700/70 bg-slate-900 text-[10px] font-semibold text-sky-300 shadow-sm">
                        {item.user[0]}
                     </div>
                     <div>
                        <span className="block text-[11px] font-semibold uppercase tracking-widest text-sky-300">{item.user}</span>
                        <span className="text-[12px] font-medium tracking-wide text-slate-100">{item.action}</span>
                     </div>
                  </div>

                  <div className="text-right">
                     <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Origin</p>
                     <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">{item.origin}</p>
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                     <button className="forge-btn-secondary rounded-full px-4 py-2 text-[9px] font-semibold uppercase tracking-widest transition-colors hover:text-slate-100 nf-interact">
                        Open
                     </button>
                  </div>
               </div>
            ))}
            
            <div className="forge-panel flex items-center gap-4 rounded-2xl px-4 py-4 text-[9px] font-mono uppercase tracking-widest text-slate-500">
               <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
               Feed active | Total events: 1,542 | Integrity: 100% | Latency: 24ms
            </div>
         </div>

         <div className="col-span-12 space-y-4 lg:col-span-3">
            <div className="forge-frame space-y-6 rounded-[28px] p-6">
               <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-300" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Active people</span>
               </div>
               <div className="space-y-4">
                  {[
                     { label: "Alpha Squad", count: 12, status: "Synced" },
                     { label: "Internal Dev", count: 4, status: "Private" },
                     { label: "Public Hub", count: 842, status: "Open" },
                  ].map(stat => (
                     <div key={stat.label} className="forge-panel flex items-center justify-between rounded-2xl p-4">
                        <div>
                           <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-100">{stat.label}</p>
                           <p className="text-[8px] font-semibold uppercase tracking-widest text-slate-500">{stat.count} active</p>
                        </div>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-300">{stat.status}</span>
                     </div>
                  ))}
               </div>
            </div>

            <div className="forge-frame space-y-4 rounded-[28px] p-6">
               <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Notes</span>
               </div>
               <p className="text-[10px] font-medium uppercase tracking-widest leading-loose text-slate-500">
                  The feed stays readable and compact so you can scan what changed without losing focus.
               </p>
               <div className="h-[100px] overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/70 p-3">
                  <div className="space-y-1 font-mono text-[8px] text-emerald-600/70">
                     <p>{">"} scanning updates...</p>
                     <p>{">"} packet loss: 0.00%</p>
                     <p>{">"} groups aligned: true</p>
                     <p className="animate-pulse">{">"} ready for more</p>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
