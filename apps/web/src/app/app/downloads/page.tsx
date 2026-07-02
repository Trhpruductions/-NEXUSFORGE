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
    <div className="flex flex-col gap-1">
      {/* HEADER: RESOURCE ALLOCATION */}
      <div className="p-8 border border-white/10 bg-black/40 flex items-center justify-between">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-8 h-1 bg-amber-500" />
               <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Payload_Manager_v1.2</span>
            </div>
            <h1 className="text-4xl font-black uppercase text-white italic tracking-tighter">
               Resource_Deployment
            </h1>
         </div>
         <div className="flex gap-4">
            <div className="px-4 py-2 border border-white/5 bg-white/5 flex flex-col items-end">
               <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Global_Status</span>
               <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-amber-500 animate-pulse" /> Active_Downlink
               </span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-1">
         {/* ACTIVE PAYLOADS */}
         <div className="col-span-8 space-y-1">
            {downloads.map((dl, idx) => (
               <div key={idx} className="p-8 border border-white/10 bg-black/40 space-y-6 group">
                  <div className="flex justify-between items-start">
                     <div className="space-y-1">
                        <div className="flex items-center gap-2">
                           <Box className="w-3 h-3 text-amber-500" />
                           <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Package_Identifier</span>
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase italic tracking-wider">{dl.title}</h3>
                     </div>
                     <div className="flex flex-col items-end gap-1">
                        <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest ${dl.status === 'STABLE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                           {dl.status}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{dl.speed}</span>
                     </div>
                  </div>

                  <div className="space-y-3">
                     <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <span>Deployment_Progress</span>
                        <span className="text-white">{dl.progress}%</span>
                     </div>
                     <div className="h-2 bg-white/5 relative overflow-hidden">
                        <TacticalBar 
                           value={dl.progress}
                           className="h-full"
                           color={dl.status === 'STABLE' ? 'bg-emerald-500' : 'bg-amber-500'}
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-full animate-[shimmer_2s_infinite]" />
                     </div>
                  </div>

                  <div className="flex gap-4 pt-4 border-t border-white/5">
                     <div className="flex-1 grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                           <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Allocated_Size</span>
                           <span className="text-[11px] text-white font-bold uppercase">{dl.size}</span>
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Verify_Status</span>
                           <span className="text-[11px] text-emerald-500 font-bold uppercase">CHECKSUM_OK</span>
                        </div>
                     </div>
                     <div className="flex gap-2">
                        <button className="px-6 py-2 border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-black transition-all">
                           Manage_FS
                        </button>
                        {dl.progress < 100 && dl.progress > 0 && (
                           <button className="px-6 py-2 border border-rose-500/20 bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all">
                              Abort
                           </button>
                        )}
                     </div>
                  </div>
               </div>
            ))}
         </div>

         {/* STORAGE METRICS */}
         <div className="col-span-4 space-y-1">
            <div className="p-8 border border-white/10 bg-black/40 space-y-8">
               <div className="space-y-4">
                  <div className="flex items-center gap-2">
                     <HardDrive className="w-4 h-4 text-amber-500" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">Storage_Interface</span>
                  </div>
                  <div className="space-y-6">
                     <div className="space-y-2">
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500">
                           <span>Allocated_Volume</span>
                           <span className="text-white">428.4 GB / 1024 GB</span>
                        </div>
                        <div className="h-1 bg-white/5">
                           <div className="h-full bg-amber-500/50 w-[42%]" />
                        </div>
                     </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center gap-2">
                     <Cpu className="w-4 h-4 text-amber-500" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">System_Integrity</span>
                  </div>
                  <div className="grid gap-2">
                     {[
                        { label: "File_System", status: "HEALTHY", icon: ShieldCheck },
                        { label: "Downlink_Lock", status: "STABLE", icon: Zap },
                        { label: "Checksum_Acc", status: "99.9%", icon: Database },
                     ].map(item => (
                        <div key={item.label} className="p-4 border border-white/5 bg-white/5 flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <item.icon className="w-3 h-3 text-slate-500" />
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</span>
                           </div>
                           <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{item.status}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            <div className="p-8 border border-white/10 bg-slate-900 space-y-4">
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] leading-loose">
                  NexusForge uses automated delta-patching. Only modified binary blocks are synchronized during payload updates.
               </p>
               <button className="w-full py-4 border border-amber-500 text-amber-500 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-amber-500 hover:text-black transition-all">
                  Run_Integrity_Check
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
