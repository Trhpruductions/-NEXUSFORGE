"use client";

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
    <div className="flex h-full flex-col gap-4 text-slate-100">
      <div className="flex items-center justify-between gap-4 overflow-hidden rounded-[28px] border border-slate-700/70 bg-slate-900/75 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl md:p-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-1 w-10 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.45)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">Live now</span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-100">
            Live creators and active sessions
          </h1>
        </div>
        
        <div className="flex gap-4">
          <div className="flex flex-col items-end rounded-2xl border border-slate-700/70 bg-slate-900/70 px-6 py-3 backdrop-blur-md">
             <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Active broadcasts</span>
             <span className="text-[12px] font-semibold uppercase tracking-widest text-slate-100">{creators.length} sources</span>
          </div>
          <button className="rounded-full border border-slate-700/70 bg-slate-900 px-8 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 transition-colors hover:bg-slate-900/70">
            Partner program
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-6">
            <div className="h-16 w-16 animate-spin rounded-full border-2 border-slate-200 border-t-amber-500 shadow-sm" />
            <span className="animate-pulse text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Loading live sessions...</span>
          </div>
        </div>
      ) : creators.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-20">
           <div className="relative flex max-w-md flex-col items-center gap-8 overflow-hidden rounded-[32px] border border-slate-700/70 bg-slate-900/80 p-16 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
              <div className="absolute inset-0 -z-10 bg-amber-50" />
              <Radio className="w-16 h-16 animate-pulse text-slate-300" />
              <div className="space-y-3">
                <h3 className="text-2xl font-semibold tracking-tight text-slate-100">No active sessions</h3>
                <p className="text-[12px] font-medium uppercase tracking-wider leading-relaxed text-slate-500 opacity-80">
                  The live feed is currently quiet. Creators will appear here when they go live.
                </p>
              </div>
              <button className="rounded-full border border-slate-700/70 bg-slate-900 px-10 py-4 text-[11px] font-semibold uppercase tracking-widest text-slate-100 transition-colors hover:bg-slate-900/70">
                Refresh feed
              </button>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedCreators.map((creator) => (
            <div 
              key={creator.id} 
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-[28px] border transition-all duration-300 backdrop-blur-sm",
                creator.isFeatured 
                  ? "border-amber-200 bg-gradient-to-b from-white to-amber-50 shadow-[0_10px_30px_-15px_rgba(251,191,36,0.18)]" 
                  : "border-slate-700/70 bg-slate-900/80 hover:border-slate-900/20 hover:shadow-[0_0_30px_rgba(15,23,42,0.06)]"
              )}
            >
              {creator.isFeatured && (
                <div className="absolute top-0 left-0 z-40 h-[2px] w-full bg-amber-400" />
              )}

              <div className="absolute top-4 right-4 z-20">
                 <div className={cn(
                   "flex items-center gap-1.5 rounded-full border px-2 py-1 text-[8px] font-semibold uppercase tracking-widest backdrop-blur-md",
                   creator.livePlatform === "Kick" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
                   creator.livePlatform === "Twitch" ? "border-violet-200 bg-violet-50 text-violet-700" :
                   creator.livePlatform === "YouTube" ? "border-rose-200 bg-rose-50 text-rose-700" :
                   "border-slate-200 bg-slate-900/70 text-slate-400"
                 )}>
                   {creator.livePlatform === "Kick" && <Video className="w-2.5 h-2.5" /> }
                   {creator.livePlatform === "Twitch" && <Radio className="w-2.5 h-2.5" /> }
                   {creator.livePlatform === "YouTube" && <Play className="w-2.5 h-2.5" /> }
                   {creator.livePlatform}
                 </div>
              </div>

              <div className="relative aspect-video overflow-hidden border-b border-slate-700/60 bg-slate-900/80">
                 <div className="absolute inset-0 z-10 bg-gradient-to-t from-white/70 via-transparent to-transparent" />
                 
                 <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-widest text-rose-700 animate-pulse">
                       <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                       Live
                    </div>
                    <div className="rounded-full border border-slate-700/70 bg-slate-900/90 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-widest text-slate-300 backdrop-blur-md">
                       {creator.liveViewerCount} VIEWERS
                    </div>
                 </div>

                 <div className="absolute top-0 left-0 h-full w-full bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(255,255,255,0.55)_100%)] opacity-40 transition-opacity group-hover:opacity-20" />
              </div>

              <div className="flex flex-1 flex-col space-y-6 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900 text-emerald-500">
                      {creator.avatar ? (
                        <img src={creator.avatar} alt={creator.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-sm font-semibold">{creator.username.substring(0, 2).toUpperCase()}</div>
                      )}
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.7)]" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-semibold tracking-wider text-slate-100">{creator.username}</span>
                        {creator.isStaff && <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />}
                        {creator.isRep && <ShieldCheck className="w-3.5 h-3.5 text-sky-500" />}
                        {creator.isPartner && <Star className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />}
                        {creator.isFeatured && <Star className="w-3.5 h-3.5 animate-pulse fill-amber-500 text-amber-500" />}
                      </div>
                      <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 opacity-80">{creator.liveGameCategory}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                   <h3 className="min-h-[3rem] line-clamp-2 text-[12px] font-semibold leading-relaxed tracking-wide text-slate-100">
                     {creator.liveStreamTitle}
                   </h3>
                   
                   {creator.activityStatus && (
                     <div className="group/activity relative flex items-center gap-3 overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/70 px-4 py-2.5">
                        {creator.activityType === "MUSIC" ? <Music className="w-3 h-3 text-sky-500" /> : <Gamepad2 className="w-3 h-3 text-sky-500" />}
                        <span className="truncate text-[10px] font-semibold uppercase tracking-widest text-sky-600">
                          {creator.activityStatus}
                        </span>
                        <div className="absolute right-0 top-0 h-full w-1.5 bg-sky-200 transition-colors group-hover/activity:bg-sky-300" />
                     </div>
                   )}
                </div>

                <div className="mt-auto flex gap-2 border-t border-slate-700/60 pt-8">
                   {creator.liveStreamUrl && (
                     <Link 
                        href={creator.liveStreamUrl}
                        target="_blank"
                        className="group/btn flex flex-1 items-center justify-center gap-3 rounded-full border border-slate-700/70 bg-slate-900 py-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-100 transition-colors hover:bg-slate-900/70"
                      >
                       <Play className="w-3.5 h-3.5 fill-current transition-transform group-hover/btn:scale-125" /> Watch live
                     </Link>
                   )}
                  <button 
                    title="Follow Creator"
                    className="flex h-12 w-14 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900 text-slate-400 shadow-sm transition-colors hover:bg-rose-50 hover:text-rose-500"
                   >
                      <Heart className="w-4 h-4" />
                   </button>
                  <button 
                    title="Share Stream"
                    className="flex h-12 w-14 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900 text-slate-400 shadow-sm transition-colors hover:bg-violet-50 hover:text-violet-500"
                   >
                      <Share2 className="w-4 h-4" />
                   </button>
                </div>
              </div>

              <div className="pointer-events-none absolute inset-0 z-30 bg-[linear-gradient(rgba(255,255,255,0)_50%,rgba(15,23,42,0.05)_50%),linear-gradient(90deg,rgba(15,23,42,0.02),rgba(15,23,42,0.01),rgba(15,23,42,0.02))] bg-[length:100%_2px,3px_100%] opacity-30" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

