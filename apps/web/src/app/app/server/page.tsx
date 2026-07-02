"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users, Server, LayoutGrid, Terminal, Shield, Plus, ArrowRight, Activity, Loader2 } from "lucide-react";
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
    <div className="flex flex-col gap-1">
      <CreateServerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      
      {/* HEADER: CLUSTER CONTROL */}
      <div className="p-8 border border-white/10 bg-black/40 flex items-center justify-between">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-8 h-1 bg-amber-500" />
               <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Cluster_Registry_v4.0</span>
            </div>
            <h1 className="text-4xl font-black uppercase text-white italic tracking-tighter">
               Community_Control_Surface
            </h1>
         </div>
         <div className="flex gap-2">
            <button 
               onClick={() => setIsModalOpen(true)}
               className="px-6 py-3 border border-amber-500/20 bg-amber-500/10 text-[10px] font-black text-amber-500 uppercase tracking-widest hover:bg-amber-500/20 transition-all flex items-center gap-2"
            >
               <Plus className="w-3 h-3 text-amber-500" /> Initialize_New_Forge
            </button>
            <Link href="/app/join" className="px-6 py-3 border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest hover:border-amber-500/50 hover:bg-amber-500/10 transition-all flex items-center gap-2">
               <ArrowRight className="w-3 h-3 text-slate-500" /> Connect_Existing_Node
            </Link>
            <div className="h-12 w-px bg-white/10 mx-2" />
            <div className="px-4 py-2 border border-white/5 bg-white/5 flex flex-col items-end">
               <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Active_Clusters</span>
               <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest">{forgeList.length} OPERATIONAL</span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-1">
         {/* CLUSTER MODULES */}
         <div className="col-span-9 space-y-1">
            {forgesQuery.isLoading ? (
               <div className="p-20 border border-white/10 bg-black/40 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Retrieving_Cluster_Manifest...</p>
               </div>
            ) : forgeList.length === 0 ? (
               <div className="p-20 border border-white/10 bg-black/40 flex flex-col items-center justify-center gap-6">
                  <Server className="w-12 h-12 text-slate-800" />
                  <div className="text-center space-y-2">
                     <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">No_Active_Nodes_Detected</p>
                     <button 
                        onClick={() => setIsModalOpen(true)}
                        className="text-amber-500 text-[11px] font-black uppercase tracking-widest hover:text-white transition-colors"
                     >
                        [INITIATE_FIRST_SEQUENCER]
                     </button>
                  </div>
               </div>
            ) : (
               <div className="grid grid-cols-2 gap-1">
                  {forgeList.map((forge: any, idx: number) => (
                     <div key={forge.id} className="p-8 border border-white/10 bg-black/40 space-y-8 group hover:bg-white/5 transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 pointer-events-none transition-opacity">
                           {forge.icon ? (
                              <img src={forge.icon} alt="" className="w-32 h-32 object-cover grayscale" />
                           ) : (
                              <Server className="w-32 h-32 text-amber-500" />
                           )}
                        </div>
                        
                        <div className="flex justify-between items-start relative z-10">
                           <div className="space-y-1">
                              <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">FORGE_NODE_{idx.toString().padStart(2, '0')}</span>
                              <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter">{forge.name}</h3>
                           </div>
                           <div className="px-3 py-1 border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest">
                              OPERATIONAL
                           </div>
                        </div>

                        <div className="grid grid-cols-3 gap-1 relative z-10">
                           <div className="p-4 border border-white/5 bg-slate-950">
                              <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Invite_Code</p>
                              <p className="text-xs font-black text-white font-mono uppercase">{forge.inviteCode}</p>
                           </div>
                           <div className="p-4 border border-white/5 bg-slate-950">
                              <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Created_At</p>
                              <p className="text-[10px] font-black text-white uppercase">{new Date(forge.createdAt).toLocaleDateString()}</p>
                           </div>
                           <div className="p-4 border border-white/5 bg-slate-950">
                              <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Latency</p>
                              <p className="text-xl font-black text-emerald-500">OPTIMAL</p>
                           </div>
                        </div>

                        <div className="flex gap-2 relative z-10">
                           <Link 
                             href={`/forge/${forge.inviteCode}`}
                             className="flex-1 py-4 bg-amber-500 text-black font-black uppercase tracking-[0.2em] text-[11px] hover:bg-amber-400 transition-all flex items-center justify-center gap-2"
                           >
                              Deploy_to_Cluster <ArrowRight className="w-4 h-4" />
                           </Link>
                           <button 
                              title="Registry Details"
                              className="w-14 h-14 border border-white/10 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"
                           >
                              <Shield className="w-4 h-4 text-slate-500" />
                           </button>
                        </div>
                     </div>
                  ))}
               </div>
            )}
         </div>


         {/* INFRASTRUCTURE MONITOR */}
         <div className="col-span-3 space-y-1">
            <div className="p-8 border border-white/10 bg-black/40 space-y-8">
               <div className="space-y-4">
                  <div className="flex items-center gap-2">
                     <Terminal className="w-4 h-4 text-amber-500" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">Registry_Diagnostics</span>
                  </div>
                  <div className="space-y-4">
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-loose">
                        All clusters are operating within normal architectural parameters. No desync detected across primary comm arrays.
                     </p>
                     <div className="p-4 bg-slate-950 border border-white/5 space-y-3">
                        <div className="flex justify-between text-[9px] font-black uppercase text-slate-500">
                           <span>Global_Load</span>
                           <span className="text-amber-500">14.2%</span>
                        </div>
                        <div className="w-full h-1 bg-white/5">
                           <div className="h-full bg-amber-500 w-[14%]" />
                        </div>
                     </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center gap-2">
                     <Activity className="w-4 h-4 text-emerald-500" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">Uplink_Telemetry</span>
                  </div>
                  <div className="grid gap-2">
                     {[
                        { label: "Gateway_A", ping: "22ms" },
                        { label: "Bridge_Local", ping: "8ms" },
                        { label: "Nexus_Sat", ping: "145ms" },
                     ].map(item => (
                        <div key={item.label} className="p-4 border border-white/5 bg-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                           <span className="text-slate-500">{item.label}</span>
                           <span className="text-white">{item.ping}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            <div className="p-8 border border-white/10 bg-amber-500/5 text-center space-y-4">
               <LayoutGrid className="w-8 h-8 text-amber-500/20 mx-auto" />
               <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] leading-relaxed">
                  Nodes are dynamically assigned to the nearest cluster to minimize interlink latency.
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}
