"use client";

import { Suspense } from "react";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { ShieldAlert, Activity, Search } from "lucide-react";

export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-1">
      {/* HEADER: ALERT CENTER */}
      <div className="p-8 border border-white/10 bg-black/40 flex items-center justify-between">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-8 h-1 bg-amber-500" />
               <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Alert_Center_v3.2</span>
            </div>
            <h1 className="text-4xl font-black uppercase text-white italic tracking-tighter">
               Terminal_Notifications
            </h1>
         </div>
         <div className="flex gap-2">
            <button className="px-6 py-3 border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest hover:border-amber-500/50 hover:bg-amber-500/10 transition-all flex items-center gap-2">
               <Search className="w-3 h-3" /> Filter_Signals
            </button>
            <div className="h-12 w-px bg-white/10 mx-2" />
            <div className="px-4 py-2 border border-white/5 bg-white/5 flex flex-col items-end">
               <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Feed_Status</span>
               <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 animate-pulse" /> LIVE_POLLING
               </span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-1">
         {/* PRIORITY ALERTS & LOGS */}
         <div className="col-span-12 lg:col-span-9">
            <Suspense fallback={
               <div className="p-12 border border-white/10 bg-black/40 text-center">
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] animate-pulse">Syncing_Alert_Feed...</span>
               </div>
            }>
               <NotificationCenter />
            </Suspense>
         </div>

         {/* SIDEBAR: ALERT POLICIES */}
         <div className="col-span-12 lg:col-span-3 space-y-1">
            <div className="p-8 border border-white/10 bg-black/40 space-y-6">
               <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Alert_Policies</span>
               </div>
               <div className="space-y-4">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-loose">
                     Priority filter is currently active. Critical system signals will bypass throttle settings to ensure immediate commander awareness.
                  </p>
                  <div className="space-y-2">
                     <button className="w-full py-3 border border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/10 transition-all text-left px-4 flex justify-between items-center">
                        Mute_Global_Chat <span>OFF</span>
                     </button>
                     <button className="w-full py-3 border border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/10 transition-all text-left px-4 flex justify-between items-center">
                        Raid_Detections <span>HIGH</span>
                     </button>
                  </div>
               </div>
            </div>

            <div className="p-8 border border-white/10 bg-black/40 space-y-4 text-center">
               <Activity className="w-8 h-8 text-amber-500/20 mx-auto" />
               <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em]">All telemetry is archived for 30 days before being purged from the Primary_Node.</p>
            </div>
         </div>
      </div>
    </div>
  );
}
