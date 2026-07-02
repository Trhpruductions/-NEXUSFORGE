"use client";

import { Suspense } from "react";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { ShieldAlert, Activity, Search } from "lucide-react";

export default function NotificationsPage() {
  return (
      <div className="flex flex-col gap-4 text-slate-100 nf-content-rhythm nf-stagger nf-stagger-base-60">
         <div className="flex items-center justify-between gap-4 rounded-[28px] border border-slate-700/70 bg-slate-900/75 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl nf-stagger-item-0">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="h-1 w-8 rounded-full bg-amber-400" />
               <span className="nf-type-eyebrow text-slate-300">Operations feed</span>
            </div>
            <h1 className="nf-type-title text-slate-100">
               Threats, alerts, and live signals
            </h1>
         </div>
         <div className="flex gap-2">
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900 px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-300 transition-all hover:border-sky-400/60 hover:bg-sky-500/10 hover:text-sky-200">
               <Search className="w-3 h-3" /> Filter
            </button>
            <div className="mx-2 h-12 w-px bg-slate-300/40" />
            <div className="flex flex-col items-end rounded-2xl border border-slate-700/70 bg-slate-900/70 px-4 py-2">
               <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Feed status</span>
               <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> live polling
               </span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-4 nf-stagger-item-1">
         <div className="col-span-12 lg:col-span-9">
            <Suspense fallback={
               <div className="rounded-[28px] border border-slate-700/70 bg-slate-900/75 p-12 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                  <span className="animate-pulse nf-type-eyebrow text-slate-400">Syncing alerts...</span>
               </div>
            }>
               <NotificationCenter />
            </Suspense>
         </div>

         <div className="col-span-12 lg:col-span-3 space-y-1">
            <div className="space-y-6 rounded-[28px] border border-slate-700/70 bg-slate-900/75 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
               <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span className="nf-type-eyebrow text-slate-300">Alert policy</span>
               </div>
               <div className="space-y-4">
                  <p className="nf-type-subtitle text-slate-400">
                     Priority filtering stays enabled so critical events surface fast during active sessions.
                  </p>
                  <div className="space-y-2">
                     <button className="flex w-full items-center justify-between rounded-full border border-slate-700/70 bg-slate-900 px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-widest text-slate-300 transition-all hover:border-slate-500/70 hover:bg-slate-800/70">
                        Mute global chat <span>Off</span>
                     </button>
                     <button className="flex w-full items-center justify-between rounded-full border border-slate-700/70 bg-slate-900 px-4 py-3 text-left text-[9px] font-semibold uppercase tracking-widest text-slate-300 transition-all hover:border-slate-500/70 hover:bg-slate-800/70">
                        Raid detections <span>High</span>
                     </button>
                  </div>
               </div>
            </div>

            <div className="space-y-4 rounded-[28px] border border-slate-700/70 bg-slate-900/75 p-8 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
               <Activity className="mx-auto w-8 h-8 text-sky-300/50" />
               <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">Alerts remain archived for 30 days before secure purge.</p>
            </div>
         </div>
      </div>
    </div>
  );
}
