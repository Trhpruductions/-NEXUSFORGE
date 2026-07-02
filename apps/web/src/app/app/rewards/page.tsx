"use client";

import { CreditCard, Zap, Star, Shield, Cpu, LayoutGrid, ArrowRight, Database } from "lucide-react";

const rewards = [
  { title: "PREMIUM_IDENT_BADGE", cost: "250", type: "IDENTITY" },
  { title: "CUSTOM_AVATAR_VAULT", cost: "180", type: "ASSET" },
  { title: "NODE_CLUSTER_BOOST", cost: "320", type: "NETWORK" },
  { title: "SECURE_TAG_OVERLAY", cost: "450", type: "IDENTITY" },
];

export default function RewardsPage() {
  return (
    <div className="flex flex-col gap-1">
      {/* HEADER: VAULT CONTROL */}
      <div className="p-8 border border-white/10 bg-black/40 flex items-center justify-between">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-8 h-1 bg-amber-500" />
               <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Vault_Acquisition_v1.0</span>
            </div>
            <h1 className="text-4xl font-black uppercase text-white italic tracking-tighter">
               Resource_Exchange_Protocol
            </h1>
         </div>
         <div className="flex gap-4">
            <div className="px-4 py-2 border border-white/5 bg-white/5 flex flex-col items-end">
               <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Available_Yield</span>
               <span className="text-[14px] text-amber-500 font-black uppercase tracking-widest flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-mono">NF</span> 1,245,612
               </span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-1">
         {/* REWARD MODULES */}
         <div className="col-span-12 lg:col-span-9 space-y-1">
            <div className="grid grid-cols-2 gap-1">
               {rewards.map((item, idx) => (
                  <div key={idx} className="p-10 border border-white/10 bg-black/40 space-y-10 group hover:bg-white/5 transition-all relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                        <Database className="w-48 h-48 text-amber-500" />
                     </div>
                     
                     <div className="space-y-2 relative z-10">
                        <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{item.type}_ENCRYPTION</span>
                        <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter">{item.title}</h3>
                     </div>

                     <div className="flex items-end justify-between relative z-10">
                        <div className="space-y-1">
                           <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Acquisition_Cost</p>
                           <p className="text-3xl font-black text-white uppercase italic tracking-tighter">
                              {item.cost} <span className="text-amber-500 text-sm">XP</span>
                           </p>
                        </div>
                        <button className="px-8 py-4 bg-amber-500 text-black text-[11px] font-black uppercase tracking-[0.2em] hover:bg-amber-400 transition-all flex items-center gap-2">
                           Acquire <ArrowRight className="w-4 h-4" />
                        </button>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         {/* WALLET & STATUS */}
         <div className="col-span-12 lg:col-span-3 space-y-1">
            <div className="p-8 border border-white/10 bg-black/40 space-y-8">
               <div className="space-y-4">
                  <div className="flex items-center gap-2">
                     <CreditCard className="w-4 h-4 text-amber-500" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">Secure_Wallet</span>
                  </div>
                  <div className="p-6 border border-white/5 bg-white/2 space-y-4">
                     <div>
                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Accumulated_XP</p>
                        <p className="text-3xl font-black text-white italic tracking-tighter">2,450.00</p>
                     </div>
                     <div className="h-1 bg-white/5 overflow-hidden">
                        <div className="h-full bg-amber-500 w-[65%]" />
                     </div>
                     <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest">Level_Progress: 65% to Commander_Tier_III</p>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center gap-2">
                     <Zap className="w-4 h-4 text-emerald-500" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">Active_Perks</span>
                  </div>
                  <div className="space-y-2">
                     {[
                        { label: "XP_Multiplier", val: "1.15x", active: true },
                        { label: "Priority_Link", val: "ENABLE", active: true },
                        { label: "Cloak_Protocol", val: "SHED", active: false },
                     ].map(perk => (
                        <div key={perk.label} className="p-4 border border-white/5 bg-white/5 flex items-center justify-between">
                           <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{perk.label}</span>
                           <span className={`text-[9px] font-black uppercase tracking-widest ${perk.active ? 'text-emerald-500' : 'text-slate-700'}`}>
                              {perk.val}
                           </span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            <div className="p-8 border border-white/10 bg-black/40 text-center space-y-4">
               <Cpu className="w-8 h-8 text-amber-500/20 mx-auto" />
               <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] leading-relaxed">
                  Earn XP by maintaining node uptime and contributing to secure cluster discussions.
               </p>
               <button className="w-full py-4 border border-amber-500/20 text-amber-500 text-[9px] font-black uppercase tracking-[0.3em] hover:bg-amber-500 hover:text-black transition-all">
                  Boost_Yield
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
