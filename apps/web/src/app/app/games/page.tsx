"use client";

import { Gamepad2, Users, Search, Play, Star, Trophy, Target } from "lucide-react";

const hubs = [
  { name: "Call of Duty: MWIII", genre: "FPS", players: "1.2K", status: "READY" },
  { name: "Rocket League", genre: "SPORTS", players: "892", status: "SYNCED" },
  { name: "Minecraft", genre: "SURVIVAL", players: "2.1K", status: "READY" },
  { name: "Valorant", genre: "COMPETITIVE", players: "3.4K", status: "CONNECTED" },
  { name: "Elden Ring", genre: "RPG", players: "1.7K", status: "READY" },
];

export default function GamesPage() {
  return (
      <div className="cinematic-stage metal-corners flex flex-col gap-4 text-slate-100 nf-content-rhythm">
         <div className="cinematic-particles" />
         <div className="forge-frame flex flex-col justify-between gap-4 rounded-[28px] p-5 backdrop-blur-xl md:p-8 lg:flex-row lg:items-center">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="h-1 w-8 rounded-full bg-sky-400" />
               <span className="nf-type-eyebrow text-slate-300">Game library</span>
            </div>
            <h1 className="nf-type-title text-slate-100 md:text-4xl">
               Competitive and social hubs
            </h1>
         </div>
         <div className="flex flex-wrap items-center gap-2 md:gap-3 lg:flex-nowrap">
            <button className="forge-btn-secondary inline-flex items-center gap-2 rounded-full px-4 py-3 text-[10px] font-semibold uppercase tracking-widest transition-colors md:px-6 nf-interact">
               <Target className="w-3 h-3" /> Quick match
            </button>
            <div className="hidden h-12 w-px bg-slate-300/40 lg:block lg:mx-1" />
            <div className="forge-panel flex min-w-[160px] flex-col items-end rounded-2xl px-3 py-2 md:px-4">
               <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Players online</span>
               <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">12,452 active</span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
         <div className="xl:col-span-8 2xl:col-span-9 space-y-3">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
               {hubs.map((hub, idx) => (
                  <div key={idx} className="forge-frame group space-y-6 overflow-hidden rounded-[28px] p-5 transition-transform duration-300 hover:-translate-y-[2px] md:p-7 nf-interact">
                     <div className="flex items-start justify-between">
                        <div className="space-y-1">
                           <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">{hub.genre}</span>
                           <h3 className="text-xl font-semibold tracking-tight text-slate-100 md:text-2xl xl:text-3xl leading-[0.95] break-words">{hub.name}</h3>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center border border-slate-700/70 bg-slate-900">
                           <Gamepad2 className="w-5 h-5 text-sky-300 transition-colors" />
                        </div>
                     </div>

                     <div className="relative h-36 overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-900/80 md:h-44 xl:h-48">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(56,189,248,0.12),transparent_35%)]" />
                        <div className="absolute bottom-4 left-4 flex gap-4">
                           <div className="rounded-full border border-emerald-400/45 bg-emerald-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                              {hub.status}
                           </div>
                           <div className="flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-300">
                              <Users className="w-3 h-3" /> {hub.players}
                           </div>
                        </div>
                     </div>

                     <div className="flex gap-2">
                        <button className="forge-btn-primary flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors md:py-4 nf-interact">
                           <Play className="w-3 h-3 fill-current" /> Launch
                        </button>
                        <button 
                           title="Favorite"
                           className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900 transition-colors hover:bg-slate-900/70 nf-interact"
                        >
                           <Star className="w-4 h-4 text-slate-500" />
                        </button>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         <div className="xl:col-span-4 2xl:col-span-3 space-y-3">
            <div className="forge-frame space-y-6 rounded-[28px] p-5 md:p-6">
               <div className="flex items-center gap-2 text-amber-500">
                  <Trophy className="w-4 h-4" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Top players</span>
               </div>
               <div className="space-y-1">
                  {[
                     { user: "Void_1", score: "482k", rank: 1 },
                     { user: "Neon_A", score: "475k", rank: 2 },
                     { user: "Crusade", score: "461k", rank: 3 },
                  ].map(item => (
                     <div key={item.user} className="forge-panel flex items-center justify-between rounded-2xl p-3 md:p-4">
                        <div className="flex items-center gap-3">
                           <span className="text-[10px] font-semibold text-slate-500">0{item.rank}</span>
                           <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-100">{item.user}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-amber-300">{item.score}</span>
                     </div>
                  ))}
               </div>
            </div>

            <div className="forge-frame space-y-4 rounded-[28px] p-5 md:p-6">
               <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-amber-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Recent searches</span>
               </div>
               <div className="flex flex-wrap gap-2">
                  {["#FPS", "#MMO", "#ASSETS", "#COOP"].map((tag) => (
                     <span key={tag} className="cursor-pointer rounded-full border border-slate-700/70 bg-slate-900 px-3 py-1 text-[9px] font-semibold uppercase tracking-widest text-slate-300 transition-colors hover:border-sky-400/50 hover:text-sky-200 nf-interact">
                        {tag}
                     </span>
                  ))}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
