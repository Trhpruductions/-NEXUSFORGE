"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Server, LayoutGrid, Terminal, Shield, Plus, ArrowRight, Activity, Loader2 } from "lucide-react";
import { CreateServerModal } from "@/components/modals/create-server-modal";
import { listForges } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

export default function ServerPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { accessToken } = useAuthStore();

  const forgesQuery = useQuery({
    queryKey: ["forges", accessToken],
    queryFn: () => listForges(accessToken!),
    enabled: !!accessToken,
  });

  const forgeList = forgesQuery.data?.forges || [];

  return (
      <div className="cinematic-stage metal-corners flex flex-col gap-4 text-slate-100 nf-content-rhythm">
         <div className="cinematic-particles" />
      <CreateServerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      
         <div className="forge-frame flex flex-col justify-between gap-4 rounded-[28px] p-5 backdrop-blur-xl md:p-8 lg:flex-row lg:items-center">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="h-1 w-8 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]" />
               <span className="nf-type-eyebrow text-slate-300">Community overview</span>
            </div>
            <h1 className="nf-type-title text-slate-100 md:text-4xl">
               Tactical community spaces
            </h1>
         </div>
         <div className="flex w-full flex-wrap items-center gap-2 md:gap-3 lg:w-auto lg:flex-nowrap">
            <button 
               onClick={() => setIsModalOpen(true)}
               className="forge-btn-primary inline-flex items-center gap-2 rounded-full px-4 py-3 text-[10px] font-semibold uppercase tracking-widest transition-colors md:px-6 nf-interact"
            >
               <Plus className="w-3 h-3" /> New space
            </button>
            <Link href="/app/join" className="forge-btn-secondary inline-flex items-center gap-2 rounded-full px-4 py-3 text-[10px] font-semibold uppercase tracking-widest transition-colors md:px-6 nf-interact">
               <ArrowRight className="w-3 h-3" /> Join existing space
            </Link>
            <div className="hidden h-12 w-px bg-slate-300/40 lg:block lg:mx-1" />
            <div className="forge-panel ml-auto flex min-w-[160px] flex-col items-end rounded-2xl px-3 py-2 md:px-4">
               <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Spaces online</span>
               <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-100">{forgeList.length} available</span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
         <div className="xl:col-span-9 space-y-3">
            {forgesQuery.isLoading ? (
               <div className="forge-frame flex flex-col items-center justify-center gap-4 rounded-[28px] p-10 md:p-20">
                  <Loader2 className="w-8 h-8 animate-spin text-sky-300" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Loading spaces...</p>
               </div>
            ) : forgeList.length === 0 ? (
               <div className="forge-frame flex flex-col items-center justify-center gap-6 rounded-[28px] p-10 md:p-20">
                  <Server className="w-12 h-12 text-slate-300" />
                  <div className="text-center space-y-2">
                     <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">No spaces yet</p>
                     <button 
                        onClick={() => setIsModalOpen(true)}
                        className="text-[11px] font-semibold uppercase tracking-widest text-sky-300 transition-colors hover:text-sky-200"
                     >
                        Create the first space
                     </button>
                  </div>
               </div>
            ) : (
               <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {forgeList.map((forge: any, idx: number) => (
                     <div
                        key={forge.id}
                        className="forge-frame group relative overflow-hidden rounded-[28px] p-5 transition-transform duration-300 hover:-translate-y-[2px] md:p-7 nf-interact"
                     >
                        <div className="pointer-events-none absolute top-0 right-0 p-8 opacity-5 transition-opacity group-hover:opacity-10">
                           {forge.icon ? (
                              <img src={forge.icon} alt="" className="w-32 h-32 object-cover grayscale" />
                           ) : (
                              <Server className="w-32 h-32 text-amber-300" />
                           )}
                        </div>
                        
                        <div className="relative z-10 flex items-start justify-between">
                           <div className="space-y-1">
                              <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Space {idx.toString().padStart(2, '0')}</span>
                              <h3 className="text-xl font-semibold tracking-tight text-slate-100 md:text-2xl xl:text-3xl">{forge.name}</h3>
                           </div>
                           <div className="rounded-full border border-emerald-400/45 bg-emerald-500/15 px-3 py-1 text-[9px] font-semibold uppercase tracking-widest text-emerald-300">
                              Ready
                           </div>
                        </div>

                        <div className="relative z-10 grid grid-cols-1 gap-2 sm:grid-cols-3">
                           <div className="forge-panel rounded-2xl p-3 md:p-4">
                              <p className="text-[8px] font-semibold uppercase tracking-widest text-slate-500">Invite code</p>
                              <p className="font-mono text-xs font-semibold uppercase text-slate-100">{forge.inviteCode}</p>
                           </div>
                           <div className="forge-panel rounded-2xl p-3 md:p-4">
                              <p className="text-[8px] font-semibold uppercase tracking-widest text-slate-500">Created</p>
                              <p className="text-[10px] font-semibold uppercase text-slate-100">{new Date(forge.createdAt).toLocaleDateString()}</p>
                           </div>
                           <div className="forge-panel rounded-2xl p-3 md:p-4">
                              <p className="text-[8px] font-semibold uppercase tracking-widest text-slate-500">Latency</p>
                              <p className="text-xl font-semibold text-emerald-300">Low</p>
                           </div>
                        </div>

                        <div className="relative z-10 flex gap-2">
                        <Link 
                             href={`/forge/${forge.inviteCode}`}
                           className="forge-btn-secondary flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors md:py-4 nf-interact"
                           >
                              Open space <ArrowRight className="w-4 h-4" />
                           </Link>
                           <button 
                              title="Registry Details"
                              className="forge-btn-secondary flex h-14 w-14 items-center justify-center rounded-full transition-colors nf-interact"
                           >
                              <Shield className="w-4 h-4 text-slate-500" />
                           </button>
                        </div>
                     </div>
                  ))}
               </div>
            )}
         </div>

         <div className="xl:col-span-3 space-y-3">
            <div className="forge-frame space-y-8 rounded-[28px] p-5 md:p-8">
               <div className="space-y-4">
                  <div className="flex items-center gap-2">
                     <Terminal className="w-4 h-4 text-amber-500" />
                     <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Registry notes</span>
                  </div>
                  <div className="space-y-4">
                     <p className="text-[10px] font-medium uppercase tracking-widest leading-loose text-slate-500">
                        Everything is operating normally. The spaces below are ready to use and easy to revisit later.
                     </p>
                     <div className="forge-panel space-y-3 rounded-2xl p-4">
                        <div className="flex justify-between text-[9px] font-semibold uppercase text-slate-500">
                           <span>Global_Load</span>
                           <span className="text-amber-600">14.2%</span>
                        </div>
                        <div className="h-1 w-full bg-slate-700/70">
                           <div className="h-full w-[14%] bg-amber-400" />
                        </div>
                     </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center gap-2">
                     <Activity className="w-4 h-4 text-emerald-500" />
                     <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Uplink status</span>
                  </div>
                  <div className="grid gap-2">
                     {[
                        { label: "Gateway A", ping: "22ms" },
                        { label: "Bridge Local", ping: "8ms" },
                        { label: "Nexus Sat", ping: "145ms" },
                     ].map(item => (
                        <div key={item.label} className="forge-panel flex items-center justify-between rounded-2xl px-4 py-4 text-[10px] font-semibold uppercase tracking-widest">
                           <span className="text-slate-500">{item.label}</span>
                           <span className="text-slate-100">{item.ping}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            <div className="forge-frame space-y-4 rounded-[28px] p-5 text-center md:p-8">
               <LayoutGrid className="mx-auto h-8 w-8 text-sky-300/50" />
               <p className="text-[9px] font-semibold uppercase tracking-[0.2em] leading-relaxed text-slate-400">
                  Spaces are assigned to the nearest active group so it stays easy to pick up where you left off.
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}
