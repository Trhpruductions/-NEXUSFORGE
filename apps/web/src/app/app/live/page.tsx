"use client";

import { useEffect, useState } from "react";
import { 
  Users, 
  Play, 
  ExternalLink, 
  Hash, 
  Radio, 
  Trophy, 
  Star, 
  ShieldCheck, 
  Share2, 
  Heart,
  Music,
  Gamepad2,
  Video
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";
import { getLiveCreators } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export default function LiveNowPage() {
  const { accessToken, csrfToken } = useAuthStore();

  const { data: creators = [], isLoading } = useQuery({
    queryKey: ["live-creators"],
    queryFn: () => getLiveCreators(accessToken!, csrfToken!),
    enabled: !!accessToken && !!csrfToken,
    refetchInterval: 30000 // Refresh every 30s
  });

  // Sort featured creators to the top
  const sortedCreators = [...creators].sort((a, b) => {
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;
    return (b.liveViewerCount || 0) - (a.liveViewerCount || 0);
  });

  return (
    <div className="flex flex-col gap-1 h-full bg-[#02060c]">
      {/* HEADER: COMMAND SCAN */}
      <div className="p-8 border border-white/10 bg-black/60 flex items-center justify-between relative overflow-hidden backdrop-blur-3xl">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-nexus-cyan/50 to-transparent animate-scan" />
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-1 bg-nexus-cyan shadow-[0_0_10px_rgba(0,242,255,0.6)]" />
            <span className="text-[11px] font-black text-nexus-cyan uppercase tracking-[0.4em] nexus-text-pop">Broadcast_Matrix_v3.0</span>
          </div>
          <h1 className="text-4xl font-black uppercase text-white italic tracking-tighter drop-shadow-lg">
            Live_<span className="text-nexus-cyan nexus-text-vibrant">Intelligence</span>_Feed
          </h1>
        </div>
        
        <div className="flex gap-4">
          <div className="px-6 py-3 border border-white/10 bg-white/5 flex flex-col items-end backdrop-blur-md">
             <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active_Broadcasts</span>
             <span className="text-[12px] text-nexus-cyan font-black uppercase tracking-widest nexus-text-pop">{creators.length} SOURCES</span>
          </div>
          <button className="px-8 py-3 bg-nexus-purple/10 text-nexus-purple text-[10px] font-black uppercase tracking-[0.2em] hover:bg-nexus-purple hover:text-white transition-all border border-nexus-purple/30">
            Partner_Program
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 border-2 border-nexus-cyan/20 border-t-nexus-cyan animate-spin rounded-none shadow-[0_0_20px_rgba(0,242,255,0.2)]" />
            <span className="text-[11px] font-black text-nexus-cyan uppercase tracking-[0.3em] animate-pulse">Scanning_Airwaves...</span>
          </div>
        </div>
      ) : creators.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-20">
           <div className="p-16 border border-white/10 bg-black/60 flex flex-col items-center gap-8 max-w-md text-center backdrop-blur-2xl nexus-corner-tick relative overflow-hidden">
              <div className="absolute inset-0 bg-nexus-purple/5 -z-10" />
              <Radio className="w-16 h-16 text-slate-800 animate-pulse" />
              <div className="space-y-3">
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter nexus-text-vibrant">No_Active_Signals</h3>
                <p className="text-[12px] text-slate-400 font-bold uppercase tracking-wider leading-relaxed opacity-80">
                  The broadcast matrix is currently empty. All creators are currently offline or in stealth mode.
                </p>
              </div>
              <button className="px-10 py-5 bg-white/5 border border-white/20 text-[11px] font-black text-white uppercase tracking-widest hover:border-nexus-cyan/50 hover:text-nexus-cyan transition-all backdrop-blur-md">
                Refresh_Matrix
              </button>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-2">
          {sortedCreators.map((creator) => (
            <div 
              key={creator.id} 
              className={cn(
                "group relative border-2 flex flex-col transition-all duration-300 overflow-hidden backdrop-blur-sm",
                creator.isFeatured 
                  ? "border-nexus-gold/40 bg-[linear-gradient(180deg,rgba(251,191,36,0.08)_0%,rgba(0,0,0,0.6)_100%)] shadow-[0_10px_30px_-15px_rgba(251,191,36,0.3)]" 
                  : "border-white/10 bg-black/60 hover:border-nexus-cyan/50 hover:shadow-[0_0_30px_rgba(0,242,255,0.1)]"
              )}
            >
              {/* FEATURED INDICATOR */}
              {creator.isFeatured && (
                <div className="absolute top-0 left-0 w-full h-[2px] bg-emerald-500/50 z-40" />
              )}

              {/* PLATFORM OVERLAY */}
              <div className="absolute top-4 right-4 z-20">
                 <div className={cn(
                   "px-2 py-1 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-white/10 backdrop-blur-md",
                   creator.livePlatform === "Kick" ? "bg-[#53FC18] text-black border-[#53FC18]/50" :
                   creator.livePlatform === "Twitch" ? "bg-[#9146FF] text-white border-[#9146FF]/50" :
                   creator.livePlatform === "YouTube" ? "bg-red-600 text-white border-red-500/50" :
                   "bg-slate-800 text-white"
                 )}>
                   {creator.livePlatform === "Kick" && <Video className="w-2.5 h-2.5" /> }
                   {creator.livePlatform === "Twitch" && <Radio className="w-2.5 h-2.5" /> }
                   {creator.livePlatform === "YouTube" && <Play className="w-2.5 h-2.5" /> }
                   {creator.livePlatform}
                 </div>
              </div>

              {/* THUMBNAIL AREA */}
              <div className="relative aspect-video bg-slate-950 border-b border-white/10 overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 z-10" />
                 
                 {/* LIVE TAG */}
                 <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-600 text-white text-[8px] font-black uppercase tracking-widest animate-pulse border border-red-500/50">
                       <div className="w-1.5 h-1.5 rounded-full bg-white" />
                       LIVE
                    </div>
                    <div className="px-2 py-0.5 bg-black/80 text-white text-[8px] font-black uppercase tracking-widest border border-white/10 backdrop-blur-md">
                       {creator.liveViewerCount} VIEWERS
                    </div>
                 </div>

                 <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.8)_100%)] opacity-40 group-hover:opacity-20 transition-opacity" />
              </div>

              {/* CREATOR INFO */}
              <div className="p-6 flex flex-col flex-1 space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-slate-900 border border-white/10 flex items-center justify-center text-emerald-500 relative shrink-0 overflow-hidden">
                      {creator.avatar ? (
                        <img src={creator.avatar} alt={creator.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-sm font-black italic">{creator.username.substring(0, 2).toUpperCase()}</div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-nexus-cyan border-2 border-slate-950 rounded-none shadow-[0_0_12px_rgba(0,242,255,1)]" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-black text-white uppercase tracking-wider truncate drop-shadow-sm">{creator.username}</span>
                        {creator.isStaff && <ShieldCheck className="w-3.5 h-3.5 text-nexus-gold drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]" />}
                        {creator.isRep && <ShieldCheck className="w-3.5 h-3.5 text-nexus-cyan drop-shadow-[0_0_5px_rgba(0,242,255,0.5)]" />}
                        {creator.isPartner && <Star className="w-3.5 h-3.5 text-nexus-crimson fill-nexus-crimson" />}
                        {creator.isFeatured && <Star className="w-3.5 h-3.5 text-nexus-gold fill-nexus-gold animate-pulse" />}
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mt-0.5 opacity-80">{creator.liveGameCategory}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                   <h3 className="text-[12px] font-black text-white leading-relaxed uppercase tracking-wide line-clamp-2 min-h-[3rem] opacity-90">
                     {creator.liveStreamTitle}
                   </h3>
                   
                   {/* ACTIVITY POPUP STYLE */}
                   {creator.activityStatus && (
                     <div className="flex items-center gap-3 py-2.5 px-4 bg-white/5 border border-white/10 nexus-corner-tick relative overflow-hidden group/activity">
                        {creator.activityType === "MUSIC" ? <Music className="w-3 h-3 text-nexus-cyan" /> : <Gamepad2 className="w-3 h-3 text-nexus-cyan" />}
                        <span className="text-[10px] font-black text-nexus-cyan uppercase tracking-widest truncate nexus-text-pop">
                          {creator.activityStatus}
                        </span>
                        <div className="absolute right-0 top-0 w-1.5 h-full bg-nexus-cyan/20 group-hover/activity:bg-nexus-cyan/40 transition-colors" />
                     </div>
                   )}
                </div>

                <div className="mt-auto pt-8 border-t border-white/10 flex gap-2">
                   {creator.liveStreamUrl && (
                     <Link 
                        href={creator.liveStreamUrl}
                        target="_blank"
                        className="flex-1 py-4 bg-nexus-cyan text-black font-black uppercase tracking-[0.25em] text-[11px] hover:bg-white transition-all flex items-center justify-center gap-3 shadow-[0_5px_15px_-5px_rgba(0,242,255,0.4)] group/btn"
                      >
                       <Play className="w-3.5 h-3.5 fill-current transition-transform group-hover/btn:scale-125" /> Watch_Live
                     </Link>
                   )}
                   <button 
                      title="Follow Creator"
                      className="w-14 h-12 border border-white/10 bg-white/5 flex items-center justify-center hover:bg-nexus-crimson/10 hover:border-nexus-crimson/30 transition-all text-slate-400 hover:text-nexus-crimson"
                   >
                      <Heart className="w-4 h-4" />
                   </button>
                   <button 
                      title="Share Stream"
                      className="w-14 h-12 border border-white/10 bg-white/5 flex items-center justify-center hover:bg-nexus-purple/10 hover:border-nexus-purple/30 transition-all text-slate-400 hover:text-nexus-purple"
                   >
                      <Share2 className="w-4 h-4" />
                   </button>
                </div>
              </div>

              {/* SCANLINE OVERLAY */}
              <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] z-30 bg-[length:100%_2px,3px_100%] opacity-30" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

