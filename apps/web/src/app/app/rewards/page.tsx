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
      <div className="cinematic-stage metal-corners flex flex-col gap-4 text-slate-100 nf-content-rhythm">
         <div className="cinematic-particles" />
         <div className="forge-frame flex items-center justify-between gap-4 rounded-[28px] p-6 backdrop-blur-xl">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="h-1 w-8 rounded-full bg-sky-400" />
               <span className="nf-type-eyebrow text-slate-300">Rewards</span>
            </div>
            <h1 className="nf-type-title text-slate-100">
               Progression and unlock exchange
            </h1>
         </div>
         <div className="flex gap-4">
            <div className="forge-panel flex flex-col items-end rounded-2xl px-4 py-2">
               <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Available points</span>
               <span className="flex items-center gap-2 text-[14px] font-semibold uppercase tracking-widest text-amber-300">
                  <span className="text-[10px] font-medium text-slate-500">NF</span> 1,245,612
               </span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
         <div className="col-span-12 lg:col-span-9 space-y-1">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
               {rewards.map((item, idx) => (
                  <div key={idx} className="forge-frame group relative overflow-hidden rounded-[28px] p-8 transition-transform hover:-translate-y-[2px] md:p-10 nf-interact">
                     <div className="pointer-events-none absolute top-0 right-0 p-10 opacity-[0.04] transition-opacity group-hover:opacity-[0.08]">
                        <Database className="w-48 h-48 text-amber-400" />
                     </div>
                     
                     <div className="space-y-2 relative z-10">
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">{item.type}</span>
                        <h3 className="text-3xl font-semibold tracking-tight text-slate-100">{item.title}</h3>
                     </div>

                     <div className="flex items-end justify-between relative z-10">
                        <div className="space-y-1">
                           <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Cost</p>
                           <p className="text-3xl font-semibold tracking-tight text-slate-100">
                              {item.cost} <span className="text-sm text-amber-300">XP</span>
                           </p>
                        </div>
                        <button className="forge-btn-secondary inline-flex items-center gap-2 rounded-full px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors md:px-8 md:py-4 nf-interact">
                           Claim <ArrowRight className="w-4 h-4" />
                        </button>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         <div className="col-span-12 lg:col-span-3 space-y-1">
            <div className="forge-frame space-y-8 rounded-[28px] p-6 backdrop-blur-xl">
               <div className="space-y-4">
                  <div className="flex items-center gap-2">
                     <CreditCard className="w-4 h-4 text-amber-500" />
                     <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Wallet</span>
                  </div>
                  <div className="forge-panel space-y-4 rounded-2xl p-6">
                     <div>
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Accumulated XP</p>
                        <p className="text-3xl font-semibold tracking-tight text-slate-100">2,450.00</p>
                     </div>
                     <div className="h-1 overflow-hidden bg-slate-200">
                        <div className="h-full w-[65%] bg-amber-400" />
                     </div>
                     <p className="text-[8px] font-semibold uppercase tracking-widest text-slate-500">65% to the next tier</p>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center gap-2">
                     <Zap className="w-4 h-4 text-emerald-500" />
                     <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Active perks</span>
                  </div>
                  <div className="space-y-2">
                     {[
                        { label: "XP_Multiplier", val: "1.15x", active: true },
                        { label: "Priority_Link", val: "ENABLE", active: true },
                        { label: "Cloak_Protocol", val: "SHED", active: false },
                     ].map(perk => (
                        <div key={perk.label} className="forge-panel flex items-center justify-between rounded-2xl p-4">
                           <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">{perk.label}</span>
                           <span className={`text-[9px] font-semibold uppercase tracking-widest ${perk.active ? 'text-emerald-600' : 'text-slate-500'}`}>
                              {perk.val}
                           </span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            <div className="forge-frame space-y-4 rounded-[28px] p-6 text-center backdrop-blur-xl">
               <Cpu className="mx-auto w-8 h-8 text-sky-300/45" />
               <p className="text-[9px] font-semibold uppercase tracking-[0.2em] leading-relaxed text-slate-400">
                  Earn XP by staying active and keeping the workspace up to date.
               </p>
               <button className="w-full rounded-full border border-slate-700/70 bg-slate-900 py-4 text-[9px] font-semibold uppercase tracking-[0.3em] text-slate-100 transition-colors hover:bg-slate-900/70 nf-interact">
                  Boost rewards
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
