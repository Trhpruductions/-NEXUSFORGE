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
    <div className="flex flex-col gap-4 text-slate-100">
      <div className="flex items-center justify-between gap-4 rounded-[28px] border border-slate-700/70 bg-slate-900/75 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
         <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="h-1 w-8 rounded-full bg-amber-400" />
               <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-500">Friends</span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-100">
               People you keep in reach
            </h1>
         </div>
         <div className="flex gap-2">
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900 px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 transition-colors hover:bg-slate-900/70">
               <UserPlus className="w-3 h-3" /> Add friend
            </button>
            <div className="mx-2 h-12 w-px bg-slate-300/40" />
            <div className="flex flex-col items-end rounded-2xl border border-slate-700/70 bg-slate-900/70 px-4 py-2">
               <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Active comms</span>
               <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600">18 online</span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
         <div className="col-span-9 space-y-1">
            <div className="grid grid-cols-2 gap-4">
               {friends.map((friend, idx) => (
                  <div key={idx} className="group relative overflow-hidden rounded-[28px] border border-slate-700/70 bg-slate-900/80 p-8 shadow-[0_18px_45px_rgba(15,23,42,0.07)] transition-transform hover:-translate-y-[2px] space-y-8">
                     <div className="absolute top-0 left-0 h-full w-1 bg-amber-400 opacity-0 transition-opacity group-hover:opacity-100" />
                     
                     <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                           <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900/80 text-[11px] font-semibold text-amber-700">
                              {friend.name[0]}
                           </div>
                           <div>
                              <h3 className="text-2xl font-semibold tracking-tight text-slate-100">{friend.name}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                 <span className={`text-[9px] font-semibold uppercase tracking-widest ${friend.status === 'IDLE_THROTTLE' ? 'text-slate-500' : 'text-emerald-600'}`}>
                                    {friend.status}
                                 </span>
                                 <span className="border border-slate-700/60 bg-slate-900/70 px-2 text-[8px] font-semibold uppercase tracking-widest text-slate-500">
                                    {friend.node}
                                 </span>
                              </div>
                           </div>
                        </div>
                        <div className="flex flex-col items-end text-right">
                           <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Game</span>
                           <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600">{friend.game}</span>
                        </div>
                     </div>

                     <div className="grid grid-cols-3 gap-2 border-t border-slate-700/60 pt-6">
                        <button className="flex items-center justify-center gap-2 rounded-full border border-slate-700/70 bg-slate-900 py-2 text-[9px] font-semibold uppercase tracking-widest text-slate-400 transition-colors hover:bg-slate-900/70">
                           <MessageSquare className="w-3 h-3" /> Message
                        </button>
                        <button className="flex items-center justify-center gap-2 rounded-full border border-slate-700/70 bg-slate-900 py-2 text-[9px] font-semibold uppercase tracking-widest text-slate-400 transition-colors hover:bg-slate-900/70">
                           <Zap className="w-3 h-3 text-amber-500" /> Invite
                        </button>
                        <button className="flex items-center justify-center gap-2 rounded-full border border-slate-700/70 bg-slate-900 py-2 text-[9px] font-semibold uppercase tracking-widest text-slate-400 transition-colors hover:bg-slate-900/70">
                           <Shield className="w-3 h-3 text-slate-500" /> View
                        </button>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         <div className="col-span-3 space-y-1">
            <div className="space-y-6 rounded-[28px] border border-slate-700/70 bg-slate-900/75 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
               <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Recent activity</span>
               </div>
               <div className="space-y-4">
                  {[
                     { msg: "Incoming link from Void X", type: "Invite" },
                     { msg: "ArcticWolf joined Arena 1", type: "Sync" },
                     { msg: "Permission requested for Luna", type: "Access" },
                  ].map((event, i) => (
                     <div key={i} className="flex flex-col gap-1 border-l border-slate-700/70 pl-4 py-1">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-100">{event.msg}</p>
                        <p className="text-[8px] font-semibold uppercase text-amber-600">{event.type}</p>
                     </div>
                  ))}
               </div>
            </div>

            <div className="space-y-4 rounded-[28px] border border-slate-700/70 bg-slate-900/75 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
               <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-300">Presence</span>
               </div>
               <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 text-center">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-100">Visible</span>
                  <div className="h-1 w-full overflow-hidden bg-slate-200">
                     <div className="h-full w-full animate-pulse bg-emerald-500" />
                  </div>
                  <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-slate-500">Broadcasting status</span>
               </div>
               <button className="w-full rounded-full border border-slate-700/70 bg-slate-900 py-4 text-[9px] font-semibold uppercase tracking-widest text-slate-300 transition-colors hover:bg-slate-900/70">
                  Go offline
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
