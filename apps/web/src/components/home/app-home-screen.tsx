"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { listForges } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { LayoutGrid, Users, History, ArrowRight, Sparkles, Target, ShieldCheck, Cpu, Database } from "lucide-react";

const CreateServerModal = dynamic(
  () => import("@/components/modals/create-server-modal").then((mod) => ({ default: mod.CreateServerModal })),
  { loading: () => null }
);

const fallbackServers = [
   { name: "Studio North", online: 48, tag: "NTH", integrity: 98 },
   { name: "North Loop", online: 32, tag: "LOP", integrity: 100 },
   { name: "Field Notes", online: 17, tag: "FLD", integrity: 94 },
   { name: "Quiet Harbor", online: 24, tag: "HRB", integrity: 99 },
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
      <div className="cinematic-stage metal-corners flex flex-col gap-4 text-slate-100 nf-content-rhythm">
         <div className="cinematic-particles" />
      <div className="forge-frame relative rounded-[28px] p-8 backdrop-blur-xl">
         <div className="absolute top-0 right-0 h-64 w-64 -z-10 blur-[110px] bg-rose-500/25" />
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="h-1 w-10 rounded-full bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.62)]" />
               <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-amber-200/85">Command overview</span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-100 md:text-5xl">
               Rise. Fight. <span className="text-amber-300">Conquer.</span>
            </h1>
         </div>
         <div className="flex gap-8">
            <div className="flex flex-col items-end">
               <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 opacity-90">Forge integrity</span>
               <span className="flex items-center gap-2 text-[13px] font-semibold tracking-widest text-slate-100">
                  <Target className="h-4 w-4 text-amber-500" /> 99.99%
               </span>
            </div>
            <div className="h-10 w-px bg-slate-600/60" />
            <div className="flex flex-col items-end">
               <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 opacity-90">Active operators</span>
               <span className="flex items-center gap-2 text-[13px] font-semibold tracking-widest text-slate-100">
                  <Users className="h-4 w-4 text-rose-400" /> 12,504
               </span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
         <div className="col-span-12 lg:col-span-8 space-y-1">
            <div className="forge-frame relative rounded-[30px] p-10 backdrop-blur-3xl md:p-14">
               <div className="pointer-events-none absolute top-0 right-0 p-12 opacity-[0.09] transition-opacity group-hover:opacity-[0.14]">
                  <ShieldCheck className="h-80 w-80 text-rose-300" />
               </div>
               
               <div className="relative z-10 space-y-10">
                  <div className="forge-chip inline-flex items-center gap-3 rounded-full px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest shadow-sm">
                     <Sparkles className="h-3 w-3" /> Workspace ready
                  </div>
                  <h2 className="max-w-xl text-5xl font-semibold tracking-tight text-slate-50 md:text-7xl md:leading-[0.9]">
                     Enter the <br/> command <span className="text-amber-300">grid</span>
                  </h2>
                  <p className="max-w-md text-sm leading-7 text-slate-300">
                     Tactical operations, ranked progression, and social command channels now run inside a cinematic battle-console surface.
                  </p>
                  
                  <div className="flex gap-5">
                     <Link href="/app/games" className="forge-btn-primary nf-interact group inline-flex items-center gap-3 rounded-full px-6 py-3.5 text-[12px] font-semibold uppercase tracking-[0.18em] transition-transform hover:-translate-y-0.5">
                        Join the battle <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                     </Link>
                     <button 
                        onClick={() => setIsCreateServerOpen(true)}
                        className="forge-btn-secondary nf-interact rounded-full px-6 py-3.5 text-[12px] font-semibold uppercase tracking-[0.18em] transition-colors"
                     >
                        Create war-room
                     </button>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-3 gap-1">
               {[
                  { label: "Members", icon: Users, val: "1,245", sub: "online units" },
                  { label: "Storage", icon: Database, val: "4.2TB", sub: "vault reserve" },
                  { label: "Load", icon: Cpu, val: "12%", sub: "combat runtime" },
               ].map(stat => (
                  <div key={stat.label} className="forge-panel nf-interact space-y-4 rounded-[22px] p-6">
                     <stat.icon className="h-5 w-5 text-amber-300" />
                     <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{stat.label}</p>
                        <p className="text-2xl font-semibold tracking-tight text-slate-100">{stat.val}</p>
                        <p className="mt-1 text-[8px] font-semibold uppercase tracking-widest text-slate-500">{stat.sub}</p>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         <div className="col-span-12 lg:col-span-4 space-y-1">
            <div className="forge-frame space-y-8 rounded-[28px] p-8 backdrop-blur-3xl">
               <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-amber-300" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-300">Featured communities</span>
               </div>
               <div className="space-y-2">
                  {servers.map(server => (
                     <div key={server.name} className="forge-panel nf-interact group relative flex cursor-pointer items-center justify-between overflow-hidden rounded-2xl px-5 py-4 transition-colors">
                        <div className="absolute inset-0 bg-amber-300/0 transition-colors group-hover:bg-amber-300/[0.05]" />
                        <div className="flex items-center gap-5 relative z-10">
                           <div className="flex h-12 w-12 items-center justify-center border border-slate-600/70 bg-slate-900/70 text-[11px] font-semibold text-slate-200 transition-all group-hover:border-amber-300/60 group-hover:text-amber-100 shadow-sm">
                              {server.tag}
                           </div>
                           <div>
                              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-100 transition-colors group-hover:text-amber-100">{server.name}</p>
                              <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 opacity-90">{server.online} connected</p>
                           </div>
                        </div>
                        <div className="text-right relative z-10">
                           <p className="text-[9px] font-semibold uppercase opacity-70 text-slate-500">Integrity</p>
                           <p className="text-[11px] font-semibold text-emerald-400">{server.integrity}%</p>
                        </div>
                     </div>
                  ))}
               </div>
               <button className="forge-btn-secondary nf-interact w-full rounded-full py-4 text-[10px] font-semibold uppercase tracking-[0.3em] transition-colors">
                  Browse all spaces
               </button>
            </div>

            <div className="forge-frame space-y-8 rounded-[28px] p-8 backdrop-blur-3xl">
               <div className="flex items-center gap-3">
                  <History className="h-5 w-5 text-rose-300" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-300">Recent activity</span>
               </div>
               <div className="space-y-5">
                  {[
                     { msg: "North Loop shared a new update", time: "2m ago", color: "border-sky-400" },
                     { msg: "Team summary synced", time: "14m ago", color: "border-amber-400" },
                     { msg: "Workspace heartbeat is stable", time: "30m ago", color: "border-emerald-400" },
                  ].map((log, i) => (
                     <div key={i} className={cn("group flex cursor-default flex-col gap-1.5 border-l-2 py-2 pl-5 transition-all hover:bg-slate-800/20", log.color)}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-200 transition-colors group-hover:text-slate-100">{log.msg}</p>
                        <p className="text-[9px] font-semibold uppercase opacity-70 text-slate-500">{log.time}</p>
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
