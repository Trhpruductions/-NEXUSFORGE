"use client";

import { Users, Search, UserPlus, MessageSquare, Shield, Activity, Target, Zap } from "lucide-react";

const friends = [
  { name: "ArcticWolf", status: "ACTIVE", game: "VALORANT", node: "US_EAST_01" },
  { name: "LunaKnight", status: "IN_ARENA", game: "APEX_LEGENDS", node: "EU_WEST_04" },
  { name: "NightHawk", status: "ACTIVE", game: "LOL_STAGING", node: "INTERNAL_HUB" },
  { name: "PixelPirate", status: "IDLE_THROTTLE", game: "ROCKET_LEAGUE", node: "SATELLITE" },
  { name: "Ghostly", status: "LOBBY_SYNC", game: "MINECRAFT", node: "PRIVATE_VAULT" },
];

export default function FriendsPage() {
  return (
    <div className="flex flex-col gap-1">
      {/* HEADER: SQUAD COMMAND */}
      <div className="p-8 border border-white/10 bg-black/40 flex items-center justify-between">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="w-8 h-1 bg-amber-500" />
               <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em]">Node_Roster_v2.0</span>
            </div>
            <h1 className="text-4xl font-black uppercase text-white italic tracking-tighter">
               Squad_Initialization
            </h1>
         </div>
         <div className="flex gap-2">
            <button className="px-6 py-3 border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest hover:border-amber-500/50 hover:bg-amber-500/10 transition-all flex items-center gap-2">
               <UserPlus className="w-3 h-3" /> Link_New_Node
            </button>
            <div className="h-12 w-px bg-white/10 mx-2" />
            <div className="px-4 py-2 border border-white/5 bg-white/5 flex flex-col items-end">
               <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Active_Comms</span>
               <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">18 SYNCHRONIZED</span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-1">
         {/* FRIEND LISTING GRID */}
         <div className="col-span-9 space-y-1">
            <div className="grid grid-cols-2 gap-1">
               {friends.map((friend, idx) => (
                  <div key={idx} className="p-8 border border-white/10 bg-black/40 space-y-8 group hover:bg-white/5 transition-all relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                     
                     <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 border border-white/10 bg-slate-950 flex items-center justify-center text-[11px] font-black text-amber-500">
                              {friend.name[0]}
                           </div>
                           <div>
                              <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">{friend.name}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                 <span className={`text-[9px] font-black uppercase tracking-widest ${friend.status === 'IDLE_THROTTLE' ? 'text-slate-500' : 'text-emerald-500'}`}>
                                    {friend.status}
                                 </span>
                                 <span className="text-[8px] text-slate-600 font-black uppercase tracking-widest px-2 border border-white/5 bg-white/5">
                                    {friend.node}
                                 </span>
                              </div>
                           </div>
                        </div>
                        <div className="flex flex-col items-end text-right">
                           <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Sector</span>
                           <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest">{friend.game}</span>
                        </div>
                     </div>

                     <div className="grid grid-cols-3 gap-2 pt-6 border-t border-white/5">
                        <button className="py-2 border border-white/10 bg-white/5 text-[9px] font-black text-white uppercase tracking-widest hover:border-amber-500/50 hover:bg-amber-500/10 transition-all flex items-center justify-center gap-2">
                           <MessageSquare className="w-3 h-3" /> COMM
                        </button>
                        <button className="py-2 border border-white/10 bg-white/5 text-[9px] font-black text-white uppercase tracking-widest hover:border-amber-500/50 hover:bg-amber-500/10 transition-all flex items-center justify-center gap-2">
                           <Zap className="w-3 h-3 text-amber-500" /> INVITE
                        </button>
                        <button className="py-2 border border-white/10 bg-white/5 text-[9px] font-black text-white uppercase tracking-widest hover:border-amber-500/50 hover:bg-amber-500/10 transition-all flex items-center justify-center gap-2">
                           <Shield className="w-3 h-3 text-slate-500" /> IDENT
                        </button>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         {/* SOCIAL LOGS & RECENT INVITES */}
         <div className="col-span-3 space-y-1">
            <div className="p-8 border border-white/10 bg-black/40 space-y-6">
               <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-500" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Interlink_Events</span>
               </div>
               <div className="space-y-4">
                  {[
                     { msg: "Incoming Link from VOID_X", type: "INVITE" },
                     { msg: "ARCTICWOLF joined ARENA_1", type: "SYNC" },
                     { msg: "Requesting PERM: LUNA", type: "ACCESS" },
                  ].map((event, i) => (
                     <div key={i} className="flex flex-col gap-1 border-l border-white/10 pl-4 py-1">
                        <p className="text-[9px] text-white font-bold uppercase tracking-wider">{event.msg}</p>
                        <p className="text-[8px] text-amber-500 uppercase font-black">{event.type}</p>
                     </div>
                  ))}
               </div>
            </div>

            <div className="p-8 border border-white/10 bg-black/40 space-y-4">
               <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Global_Presence</span>
               </div>
               <div className="p-4 bg-slate-950 border border-white/5 flex flex-col items-center justify-center gap-2 text-center">
                  <span className="text-[11px] text-white font-black uppercase tracking-widest italic">COMMANDER_VISIBLE</span>
                  <div className="w-full h-1 bg-white/5 overflow-hidden">
                     <div className="h-full bg-emerald-500 w-full animate-pulse" />
                  </div>
                  <span className="text-[8px] text-slate-500 font-black uppercase tracking-[0.2em]">BROADCASTING NODE STATUS</span>
               </div>
               <button className="w-full py-4 border border-white/10 text-white text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all">
                  Go_Offline_Mask
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
