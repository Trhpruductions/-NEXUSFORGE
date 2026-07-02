"use client";

import { Activity, Clock, Terminal, Users, Search, Filter } from "lucide-react";

const activity = [
  { when: "2m ago", user: "ArcticWolf", action: "INITIALIZED_VALORANT_SESSION", origin: "US_EAST_NODE" },
  { when: "5m ago", user: "LunaKnight", action: "SENT_COMMS_INVITE: APEX_LEGENDS", origin: "EU_WEST_NODE" },
  { when: "10m ago", user: "NightHawk", action: "CREATED_SECURE_CHANNEL: ALPHA", origin: "INTERNAL_HUB" },
  { when: "15m ago", user: "PixelPirate", action: "SYNCHRONIZED_ROCKET_LEAGUE", origin: "SATELLITE_LINK" },
  { when: "18m ago", user: "SteelReaper", action: "DEPLOYED_ASSET_PACK_v2.0", origin: "AUTO_FORGE" },
  { when: "22m ago", user: "VoidWalker", action: "JOINED_AUDIO_BRIDGE_04", origin: "COMMAND_DECK" },
];

export default function ActivityPage() {
  return (
    <div className="flex flex-col gap-1">
      {/* HEADER: TELEMETRY CONTROL */}
      <div className="p-8 border border-white/10 bg-black/40 flex items-center justify-between">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-8 h-1 bg-amber-500" />
               <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Pulse_Monitor_v2.1</span>
            </div>
            <h1 className="text-4xl font-black uppercase text-white italic tracking-tighter">
               Live_Telemetry_Feed
            </h1>
         </div>
         <div className="flex gap-2">
            <button className="px-6 py-3 border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest hover:border-amber-500/50 hover:bg-amber-500/10 transition-all flex items-center gap-2">
               <Search className="w-3 h-3" /> Search_Nodes
            </button>
            <button className="px-6 py-3 border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest hover:border-amber-500/50 hover:bg-amber-500/10 transition-all flex items-center gap-2">
               <Filter className="w-3 h-3" /> Filter_Logs
            </button>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-1">
         {/* MAIN LOG FEED */}
         <div className="col-span-9 space-y-1">
            {activity.map((item, idx) => (
               <div key={idx} className="p-6 border border-white/10 bg-black/40 flex items-center gap-8 group hover:bg-white/5 transition-colors">
                  <div className="w-24 text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">
                     <Clock className="w-3 h-3 text-amber-500/50" /> {item.when}
                  </div>
                  
                  <div className="flex-1 flex items-center gap-4">
                     <div className="w-10 h-10 border border-white/10 bg-slate-900 flex items-center justify-center text-[10px] font-black text-amber-500">
                        {item.user[0]}
                     </div>
                     <div>
                        <span className="text-[11px] font-black text-amber-500 uppercase tracking-widest block">{item.user}</span>
                        <span className="text-[12px] font-black text-white uppercase tracking-wider">{item.action}</span>
                     </div>
                  </div>

                  <div className="text-right">
                     <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Origin_Node</p>
                     <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">{item.origin}</p>
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                     <button className="px-4 py-2 border border-amber-500/20 bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-black">
                        Intercept
                     </button>
                  </div>
               </div>
            ))}
            
            {/* TERMINAL FOOTER */}
            <div className="p-4 bg-slate-900/50 border border-white/5 text-[9px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-4">
               <div className="w-2 h-2 bg-emerald-500 animate-pulse" />
               Streaming active feed... Total_Events_Logged: 1,542 | Integrity: 100% | Latency: 24ms
            </div>
         </div>

         {/* SIDEBAR: NETWORK STATS */}
         <div className="col-span-3 space-y-1">
            <div className="p-6 border border-white/10 bg-black/40 space-y-6">
               <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-500" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Active_Nodes</span>
               </div>
               <div className="space-y-4">
                  {[
                     { label: "Alpha_Squad", count: 12, status: "SYNCED" },
                     { label: "Internal_Dev", count: 4, status: "LOCKED" },
                     { label: "Public_Hub", count: 842, status: "OPEN" },
                  ].map(stat => (
                     <div key={stat.label} className="p-4 border border-white/5 bg-white/5 flex justify-between items-center">
                        <div>
                           <p className="text-[10px] text-white font-black uppercase tracking-widest">{stat.label}</p>
                           <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">{stat.count} ACTIVE</p>
                        </div>
                        <span className="text-[9px] text-amber-500 font-black uppercase tracking-[0.2em]">{stat.status}</span>
                     </div>
                  ))}
               </div>
            </div>

            <div className="p-6 border border-white/10 bg-black/40 space-y-4">
               <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Log_Analysis</span>
               </div>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-loose">
                  Real-time event stream is being parsed for architectural anomalies. No threats detected in current cycle.
               </p>
               <div className="h-[100px] border border-white/5 bg-slate-950 p-2 overflow-hidden">
                  <div className="text-[8px] font-mono text-emerald-500/50 space-y-1">
                     <p>{">"} SCANNING SECTOR_7...</p>
                     <p>{">"} PKT_LOSS: 0.00%</p>
                     <p>{">"} NODES_ALIGNED: TRUE</p>
                     <p className="animate-pulse">{">"} READY_FOR_UPLINK_</p>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
