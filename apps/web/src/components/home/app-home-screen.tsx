"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { listForges } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { LayoutGrid, Users, History, ArrowRight, Zap, Target, ShieldCheck, Cpu, Database } from "lucide-react";

const CreateServerModal = dynamic(
  () => import("@/components/modals/create-server-modal").then((mod) => ({ default: mod.CreateServerModal })),
  { loading: () => null }
);

const fallbackServers = [
  { name: "Apex Legion", online: 48, tag: "APX", integrity: 98 },
  { name: "Nexus Prime", online: 32, tag: "NXS", integrity: 100 },
  { name: "Outlaw Crew", online: 17, tag: "OTL", integrity: 94 },
  { name: "Nightfall", online: 24, tag: "NIT", integrity: 99 },
];

export function AppHomeScreen() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);

  const forgesQuery = useQuery({
    queryKey: ["home-forges", accessToken],
    queryFn: () => listForges(accessToken!),
    enabled: Boolean(accessToken),
  });

  const servers = useMemo(() => {
    const apiForges = forgesQuery.data?.forges ?? [];
    if (!apiForges.length) return fallbackServers;
    return apiForges.slice(0, 4).map((forge) => ({
      name: forge.name,
      online: forge.inviteJoinCount ?? 0,
      tag: forge.name.substring(0,3).toUpperCase(),
      integrity: 100
    }));
  }, [forgesQuery.data]);

  return (
    <div className="flex flex-col gap-1">
      {/* HEADER: COMMANDER HUD OVERVIEW */}
      <div className="p-8 border border-white/10 bg-black/60 flex items-center justify-between nexus-corner-tick relative overflow-hidden backdrop-blur-xl">
         <div className="absolute top-0 right-0 w-64 h-64 bg-nexus-cyan/5 blur-[100px] -z-10" />
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-10 h-1 bg-nexus-gold shadow-[0_0_10px_rgba(251,191,36,0.6)]" />
               <span className="text-[11px] font-black text-nexus-gold uppercase tracking-[0.4em] nexus-text-pop">Comm_Center_v6.0</span>
            </div>
            <h1 className="text-4xl font-black uppercase text-white italic tracking-tighter drop-shadow-lg">
               Commander_<span className="text-nexus-cyan nexus-text-vibrant">Dashboard</span>
            </h1>
         </div>
         <div className="flex gap-8">
            <div className="flex flex-col items-end">
               <span className="text-[10px] text-nexus-purple font-black uppercase tracking-widest opacity-80">Global_Precision</span>
               <span className="text-[13px] text-white font-black uppercase tracking-widest flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                  <Target className="w-4 h-4 text-nexus-gold" /> 99.99%
               </span>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex flex-col items-end">
               <span className="text-[10px] text-nexus-purple font-black uppercase tracking-widest opacity-80">Active_Sessions</span>
               <span className="text-[13px] text-nexus-cyan font-black uppercase tracking-widest flex items-center gap-2 nexus-text-pop">
                  <Users className="w-4 h-4" /> 12,504 NODES
               </span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-1">
         {/* LEFT COLUMN: CORE CHANNELS */}
         <div className="col-span-12 lg:col-span-8 space-y-1">
            <div className="p-14 border border-white/10 bg-black/60 relative overflow-hidden group nexus-corner-tick backdrop-blur-3xl">
               <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none group-hover:opacity-[0.07] transition-opacity">
                  <ShieldCheck className="w-80 h-80 text-nexus-gold" />
               </div>
               
               <div className="relative z-10 space-y-10">
                  <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-nexus-gold/10 border border-nexus-gold/30 text-[10px] font-black text-nexus-gold uppercase tracking-widest nexus-text-pop">
                     <Zap className="w-3 h-3 animate-pulse" /> Core_System_Initialized
                  </div>
                  <h2 className="text-7xl font-black text-white italic uppercase tracking-tighter max-w-xl leading-[0.85] drop-shadow-2xl">
                     Initialize <br/> <span className="text-nexus-gold nexus-text-pop">Node_Protocols</span>
                  </h2>
                  <p className="max-w-md text-[12px] text-slate-300 uppercase font-black leading-relaxed tracking-[0.12em] opacity-80">
                     Your commander instance is currently synchronized with the primary grid. All communication lanes are secured with <span className="text-nexus-cyan">Nexus_Industrial</span> encryption.
                  </p>
                  
                  <div className="flex gap-5">
                     <Link href="/app/games" className="px-10 py-5 bg-nexus-gold text-black text-[12px] font-black uppercase tracking-[0.2em] hover:bg-white transition-all flex items-center gap-4 shadow-[0_10px_20px_-10px_rgba(251,191,36,0.4)] group">
                        Deploy_Arenas <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                     </Link>
                     <button 
                        onClick={() => setIsCreateServerOpen(true)}
                        className="px-10 py-5 border border-white/20 text-white text-[12px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all backdrop-blur-md"
                     >
                        New_Server_Link
                     </button>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-3 gap-1">
               {[
                  { label: "Community", icon: Users, val: "1,245", sub: "Global_Members" },
                  { label: "Assets", icon: Database, val: "4.2TB", sub: "Cloud_Sync_Data" },
                  { label: "Core_Load", icon: Cpu, val: "12%", sub: "Processing_Idle" },
               ].map(stat => (
                  <div key={stat.label} className="p-8 border border-white/10 bg-black/40 space-y-4">
                     <stat.icon className="w-5 h-5 text-amber-500" />
                     <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{stat.label}</p>
                        <p className="text-2xl font-black text-white uppercase italic tracking-tighter">{stat.val}</p>
                        <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest mt-1">{stat.sub}</p>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         {/* RIGHT COLUMN: CLUSTERS & LOGS */}
         <div className="col-span-12 lg:col-span-4 space-y-1">
            <div className="p-8 border border-white/10 bg-black/60 shadow-[inset_0_0_40px_rgba(0,0,0,0.4)] space-y-8 nexus-corner-tick backdrop-blur-3xl">
               <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-nexus-gold drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]" />
                  <span className="text-[11px] font-black text-white uppercase tracking-[0.3em] nexus-text-pop">Active_Clusters</span>
               </div>
               <div className="space-y-2">
                  {servers.map(server => (
                     <div key={server.name} className="p-5 border border-white/5 bg-white/5 hover:bg-white/10 hover:border-nexus-gold/30 transition-all flex items-center justify-between cursor-pointer group nexus-corner-tick relative overflow-hidden">
                        <div className="absolute inset-0 bg-nexus-gold/0 group-hover:bg-nexus-gold/[0.02] transition-colors" />
                        <div className="flex items-center gap-5 relative z-10">
                           <div className="w-12 h-12 border border-white/10 bg-slate-900/80 flex items-center justify-center text-[11px] font-black group-hover:text-nexus-gold group-hover:border-nexus-gold/40 transition-all shadow-inner">
                              {server.tag}
                           </div>
                           <div>
                              <p className="text-[11px] text-white font-black uppercase tracking-widest group-hover:nexus-text-gold transition-all">{server.name}</p>
                              <p className="text-[9px] text-nexus-cyan font-bold uppercase tracking-widest opacity-80">{server.online} NODES_CONNECTED</p>
                           </div>
                        </div>
                        <div className="text-right relative z-10">
                           <p className="text-[9px] text-nexus-purple font-black uppercase opacity-60">Integrity</p>
                           <p className="text-[11px] text-emerald-400 font-black nexus-text-pop">{server.integrity}%</p>
                        </div>
                     </div>
                  ))}
               </div>
               <button className="w-full py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border border-white/10 hover:border-nexus-gold/50 hover:text-nexus-gold hover:bg-nexus-gold/5 transition-all backdrop-blur-md">
                  Browse_All_Clusters
               </button>
            </div>

            <div className="p-8 border border-white/10 bg-black/60 shadow-[inset_0_0_40px_rgba(0,0,0,0.4)] space-y-8 nexus-corner-tick backdrop-blur-3xl">
               <div className="flex items-center gap-3">
                  <History className="w-5 h-5 text-nexus-purple drop-shadow-[0_0_8px_rgba(168,85,247,0.3)]" />
                  <span className="text-[11px] font-black text-white uppercase tracking-[0.3em] nexus-text-pop">Tactical_Logs</span>
               </div>
               <div className="space-y-5">
                  {[
                     { msg: "NODE_ALPHA connected to US_WEST", time: "2m ago", color: "border-nexus-cyan" },
                     { msg: "BLOCK_UPDATE v2.1 synced", time: "14m ago", color: "border-nexus-gold" },
                     { msg: "CORE_SECURITY heartbeat OK", time: "30m ago", color: "border-nexus-purple" },
                  ].map((log, i) => (
                     <div key={i} className={cn("flex flex-col gap-1.5 border-l-2 pl-5 py-2 group cursor-default transition-all hover:bg-white/5", log.color)}>
                        <p className="text-[10px] text-white font-bold uppercase tracking-wider group-hover:text-nexus-cyan transition-colors">{log.msg}</p>
                        <p className="text-[9px] text-slate-500 uppercase font-black opacity-60">{log.time}</p>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      </div>

      <CreateServerModal isOpen={isCreateServerOpen} onClose={() => setIsCreateServerOpen(false)} />
    </div>
  );
}
