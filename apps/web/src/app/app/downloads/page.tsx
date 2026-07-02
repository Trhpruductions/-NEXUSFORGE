"use client";

import { CloudDownload, ShieldCheck, Database, HardDrive, Cpu, Zap, Box } from "lucide-react";
import { TacticalBar } from "@/components/tactical/tactical-bar";

const downloads = [
  { title: "NEXUSFORGE_LAUNCHER_v4.2", status: "STABLE", size: "124 MB", progress: 100, speed: "0 KB/s" },
  { title: "FORGE_ASSET_PACK_v2.0", status: "STREAMING", size: "2.1 GB", progress: 64, speed: "12.4 MB/s" },
  { title: "EVENT_MAP_PACK_BETA", status: "QUEUED", size: "540 MB", progress: 0, speed: "PENDING" },
];

export default function DownloadsPage() {
  return (
    <div className="flex flex-col gap-4 text-slate-100">
      <div className="flex items-center justify-between gap-4 rounded-[28px] border border-slate-700/70 bg-slate-900/75 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="h-1 w-8 rounded-full bg-amber-400" />
               <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-500">Downloads</span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-100">
               Downloads and updates
            </h1>
         </div>
         <div className="flex gap-4">
            <div className="flex flex-col items-end rounded-2xl border border-slate-700/70 bg-slate-900/70 px-4 py-2">
               <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Sync status</span>
               <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-amber-600">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" /> Active downlink
               </span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
         <div className="col-span-8 space-y-1">
            {downloads.map((dl, idx) => (
               <div key={idx} className="group space-y-6 rounded-[28px] border border-slate-700/70 bg-slate-900/80 p-8 shadow-[0_18px_45px_rgba(15,23,42,0.07)] transition-transform hover:-translate-y-[2px]">
                  <div className="flex items-start justify-between">
                     <div className="space-y-1">
                        <div className="flex items-center gap-2">
                           <Box className="w-3 h-3 text-amber-500" />
                           <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Package</span>
                        </div>
                        <h3 className="text-2xl font-semibold tracking-tight text-slate-100">{dl.title}</h3>
                     </div>
                     <div className="flex flex-col items-end gap-1">
                        <span className={`rounded-full px-3 py-1 text-[9px] font-semibold uppercase tracking-widest ${dl.status === 'STABLE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                           {dl.status}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{dl.speed}</span>
                     </div>
                  </div>

                  <div className="space-y-3">
                     <div className="flex justify-between text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        <span>Deployment_Progress</span>
                        <span className="text-slate-100">{dl.progress}%</span>
                     </div>
                     <div className="relative h-2 overflow-hidden bg-slate-200">
                        <TacticalBar 
                           value={dl.progress}
                           className="h-full"
                           color={dl.status === 'STABLE' ? 'bg-emerald-500' : 'bg-amber-500'}
                        />
                        <div className="absolute inset-0 w-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                     </div>
                  </div>

                  <div className="flex gap-4 border-t border-slate-700/60 pt-4">
                     <div className="flex-1 grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                           <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Allocated size</span>
                           <span className="text-[11px] font-semibold uppercase text-slate-100">{dl.size}</span>
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Verify status</span>
                           <span className="text-[11px] font-semibold uppercase text-emerald-600">Checksum ok</span>
                        </div>
                     </div>
                     <div className="flex gap-2">
                        <button className="rounded-full border border-slate-700/70 bg-slate-900 px-6 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 transition-colors hover:bg-slate-900/70">
                           Manage
                        </button>
                        {dl.progress < 100 && dl.progress > 0 && (
                           <button className="rounded-full border border-rose-200 bg-rose-50 px-6 py-2 text-[10px] font-semibold uppercase tracking-widest text-rose-600 transition-colors hover:bg-rose-100">
                              Abort
                           </button>
                        )}
                     </div>
                  </div>
               </div>
            ))}
         </div>

         <div className="col-span-4 space-y-1">
            <div className="space-y-8 rounded-[28px] border border-slate-700/70 bg-slate-900/75 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
               <div className="space-y-4">
                  <div className="flex items-center gap-2">
                     <HardDrive className="w-4 h-4 text-amber-500" />
                     <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Storage</span>
                  </div>
                  <div className="space-y-6">
                     <div className="space-y-2">
                        <div className="flex justify-between text-[9px] font-semibold uppercase tracking-widest text-slate-500">
                           <span>Allocated_Volume</span>
                           <span className="text-slate-100">428.4 GB / 1024 GB</span>
                        </div>
                        <div className="h-1 bg-slate-200">
                           <div className="h-full w-[42%] bg-amber-400" />
                        </div>
                     </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center gap-2">
                     <Cpu className="w-4 h-4 text-amber-500" />
                     <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">System health</span>
                  </div>
                  <div className="grid gap-2">
                     {[
                        { label: "File_System", status: "HEALTHY", icon: ShieldCheck },
                        { label: "Downlink_Lock", status: "STABLE", icon: Zap },
                        { label: "Checksum_Acc", status: "99.9%", icon: Database },
                     ].map(item => (
                        <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4">
                           <div className="flex items-center gap-3">
                              <item.icon className="w-3 h-3 text-slate-500" />
                              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{item.label}</span>
                           </div>
                           <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600">{item.status}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            <div className="space-y-4 rounded-[28px] border border-slate-700/70 bg-slate-900/75 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
               <p className="text-[10px] font-medium uppercase tracking-[0.2em] leading-loose text-slate-500">
                  NexusForge uses automated delta patching so only the parts that changed need to move.
               </p>
               <button className="w-full rounded-full border border-slate-700/70 bg-slate-900 py-4 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-100 transition-colors hover:bg-slate-900/70">
                  Run integrity check
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
