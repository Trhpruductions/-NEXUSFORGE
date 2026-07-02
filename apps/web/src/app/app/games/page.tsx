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
    <div className="flex flex-col gap-1">
      {/* HEADER: ARENA COMMAND */}
      <div className="p-8 border border-white/10 bg-black/40 flex items-center justify-between">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-8 h-1 bg-amber-500" />
               <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Arena_Deployment_v3</span>
            </div>
            <h1 className="text-4xl font-black uppercase text-white italic tracking-tighter">
               Combat_Zones_&_Arcs
            </h1>
         </div>
         <div className="flex gap-2">
            <button className="px-6 py-3 border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest hover:border-amber-500/50 hover:bg-amber-500/10 transition-all flex items-center gap-2">
               <Target className="w-3 h-3" /> Auto_Match
            </button>
            <div className="h-12 w-px bg-white/10 mx-2" />
            <div className="px-4 py-2 border border-white/5 bg-white/5 flex flex-col items-end">
               <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Active_Players</span>
               <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">12,452 NODES</span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-1">
         {/* MAIN HUB GRID */}
         <div className="col-span-9 space-y-1">
            <div className="grid grid-cols-2 gap-1">
               {hubs.map((hub, idx) => (
                  <div key={idx} className="p-8 border border-white/10 bg-black/40 space-y-8 group hover:bg-white/5 transition-all">
                     <div className="flex justify-between items-start">
                        <div className="space-y-1">
                           <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">{hub.genre}_MODULE</span>
                           <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter">{hub.name}</h3>
                        </div>
                        <div className="w-10 h-10 border border-white/10 bg-slate-900 flex items-center justify-center">
                           <Gamepad2 className="w-5 h-5 text-amber-500/50 group-hover:text-amber-500 transition-colors" />
                        </div>
                     </div>

                     <div className="h-48 border border-white/5 bg-slate-950 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-4 left-4 flex gap-4">
                           <div className="px-3 py-1 bg-black/60 border border-white/10 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                              {hub.status}
                           </div>
                           <div className="px-3 py-1 bg-black/60 border border-white/10 text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                              <Users className="w-3 h-3" /> {hub.players}
                           </div>
                        </div>
                     </div>

                     <div className="flex gap-2">
                        <button className="flex-1 py-4 bg-amber-500 text-black font-black uppercase tracking-[0.2em] text-[11px] hover:bg-amber-400 transition-all flex items-center justify-center gap-2">
                           <Play className="w-3 h-3 fill-current" /> Initialize_Instance
                        </button>
                        <button 
                           title="Favorite"
                           className="w-14 h-14 border border-white/10 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"
                        >
                           <Star className="w-4 h-4 text-slate-500" />
                        </button>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         {/* RANKINGS & COMMS */}
         <div className="col-span-3 space-y-1">
            <div className="p-6 border border-white/10 bg-black/40 space-y-6">
               <div className="flex items-center gap-2 text-amber-500">
                  <Trophy className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Global_Leaders</span>
               </div>
               <div className="space-y-1">
                  {[
                     { user: "Void_1", score: "482k", rank: 1 },
                     { user: "Neon_A", score: "475k", rank: 2 },
                     { user: "Crusade", score: "461k", rank: 3 },
                  ].map(item => (
                     <div key={item.user} className="p-4 border border-white/5 bg-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <span className="text-[10px] font-black text-slate-600">0{item.rank}</span>
                           <span className="text-[10px] font-black text-white uppercase tracking-widest">{item.user}</span>
                        </div>
                        <span className="text-[10px] font-black text-amber-500">{item.score}</span>
                     </div>
                  ))}
               </div>
            </div>

            <div className="p-6 border border-white/10 bg-amber-500/5 space-y-4">
               <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-amber-500" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Recent_Searches</span>
               </div>
               <div className="flex flex-wrap gap-2">
                  {["#FPS", "#MMO", "#ASSETS", "#COOP"].map(tag => (
                     <span key={tag} className="px-3 py-1 border border-white/10 text-[9px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:border-amber-500/50 hover:text-amber-500">
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
