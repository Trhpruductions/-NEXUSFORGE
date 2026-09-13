"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Eye, Loader2, Radio, Square, X } from "lucide-react";
import { getApiErrorMessage, getLiveCreators, getProfileSummary, setLiveStatus, type User } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth-store";
import { resolveClipEmbed } from "@/components/media/clip-embed";

const panel = "rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4";
const inputClass = "h-10 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60";
const goldBtn = "inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300 disabled:opacity-50";

const platforms = ["Vexora", "Twitch", "Kick", "YouTube", "TikTok"] as const;

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "VX";
}

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function elapsed(iso?: string | null) {
  if (!iso) return "";
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function LivePage() {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken, user } = useAuthStore();
  const [platform, setPlatform] = useState<(typeof platforms)[number]>("Vexora");
  const [title, setTitle] = useState("");
  const [game, setGame] = useState("");
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [watchingId, setWatchingId] = useState<string | null>(null);

  const liveQuery = useQuery({
    queryKey: ["live-creators", accessToken],
    queryFn: () => getLiveCreators(accessToken!, csrfToken ?? ""),
    enabled: Boolean(accessToken),
    refetchInterval: 20_000,
  });
  const meQuery = useQuery({
    queryKey: ["profile-summary", "me", accessToken],
    queryFn: () => getProfileSummary(accessToken!, "me"),
    enabled: Boolean(accessToken),
  });
  const me = meQuery.data?.user;
  const iAmLive = me?.creatorStatus === "LIVE";

  // Watching inside Vexora counts as a real viewer; counts update live for everyone.
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    const onViewers = () => void queryClient.invalidateQueries({ queryKey: ["live-creators"] });
    socket.on("live:viewers", onViewers);
    if (watchingId) socket.emit("stream:watch", watchingId);
    return () => {
      socket.off("live:viewers", onViewers);
      if (watchingId) socket.emit("stream:unwatch", watchingId);
    };
  }, [accessToken, watchingId, queryClient]);

  useEffect(() => {
    if (!me) return;
    if (me.liveStreamTitle) setTitle(me.liveStreamTitle);
    if (me.liveGameCategory) setGame(me.liveGameCategory);
    if (me.liveStreamUrl) setUrl(me.liveStreamUrl);
    if (me.livePlatform && (platforms as readonly string[]).includes(me.livePlatform)) setPlatform(me.livePlatform as (typeof platforms)[number]);
  }, [me]);

  const liveMutation = useMutation({
    mutationFn: (live: boolean) => setLiveStatus(accessToken!, csrfToken!, { live, platform, title: title.trim() || undefined, game: game.trim() || undefined, url: url.trim() || undefined }),
    onSuccess: async (_result, live) => {
      setNotice(live ? "You are live. Your stream shows on Home and your profile." : "Stream ended.");
      await queryClient.invalidateQueries({ queryKey: ["live-creators"] });
      await queryClient.invalidateQueries({ queryKey: ["profile-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["home-summary"] });
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const creators = (liveQuery.data ?? []) as User[];
  const watching = watchingId ? creators.find((creator) => creator.id === watchingId) ?? null : null;
  const watchingEmbed = watching?.liveStreamUrl ? resolveClipEmbed(watching.liveStreamUrl) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="nf-heading text-xl font-bold text-white">Live Now</h1>
          <p className="text-xs text-slate-400">Creators streaming right now across Vexora Gaming.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-rose-200"><Radio className="h-3.5 w-3.5" /> {creators.length} live</span>
      </div>

      {notice ? (
        <div className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {notice}
          <button type="button" onClick={() => setNotice(null)} title="Dismiss"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {watching ? (
            <div className="overflow-hidden rounded-2xl border border-rose-400/40 bg-[#0d1119]">
              {watchingEmbed && watchingEmbed.kind === "iframe" ? (
                <iframe src={watchingEmbed.src} title={watching.liveStreamTitle ?? "Live stream"} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen className="aspect-video w-full bg-black" />
              ) : watchingEmbed && watchingEmbed.kind === "video" ? (
                <video src={watchingEmbed.src} autoPlay controls playsInline className="aspect-video w-full bg-black" />
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_40%,rgba(244,63,94,0.18),transparent_60%),#0b0e15] text-center">
                  <Radio className="h-8 w-8 text-rose-400" />
                  <p className="text-sm text-slate-300">{watching.livePlatform ?? "This platform"} does not allow embedding here.</p>
                  {watching.liveStreamUrl ? <a href={watching.liveStreamUrl} target="_blank" rel="noopener noreferrer" className={goldBtn}>Open on {watching.livePlatform ?? "platform"} <ExternalLink className="h-3 w-3" /></a> : null}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 border-t border-white/5 p-3">
                <span className="inline-flex items-center gap-1 rounded bg-rose-500 px-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white"><Radio className="h-3 w-3" /> Live</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{watching.liveStreamTitle || `${watching.username} is live`}</p>
                  <p className="truncate text-[11px] text-slate-400">{[watching.displayName || watching.username, watching.liveGameCategory, watching.livePlatform].filter(Boolean).join(" · ")} · <Eye className="inline h-3 w-3" /> {compact(watching.liveViewerCount ?? 0)} watching</p>
                </div>
                {watching.liveStreamUrl ? <a href={watching.liveStreamUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:border-amber-400/50">Open <ExternalLink className="h-3 w-3" /></a> : null}
                <button type="button" onClick={() => setWatchingId(null)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:border-rose-400/50"><X className="h-3 w-3" /> Close</button>
              </div>
            </div>
          ) : null}
          {liveQuery.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading streams...</p>
          ) : creators.length ? (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {creators.map((creator) => (
                <div key={creator.id} className="overflow-hidden rounded-2xl border border-amber-500/15 bg-[#0d1119] transition hover:border-amber-400/50">
                  <div className="relative h-36 bg-[radial-gradient(circle_at_30%_30%,rgba(230,179,37,0.3),transparent_60%),linear-gradient(160deg,#141a26,#0b0e15)]">
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded bg-rose-500 px-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white"><Radio className="h-3 w-3" /> Live</span>
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded bg-black/60 px-1.5 text-[10px] text-white"><Eye className="h-3 w-3" /> {compact(creator.liveViewerCount ?? 0)}</span>
                    <span className="absolute bottom-3 right-3 rounded bg-black/60 px-1.5 text-[10px] text-slate-200">{elapsed(creator.liveStartedAt)}</span>
                  </div>
                  <div className="flex gap-3 p-3">
                    {creator.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={creator.avatar} alt="" className="h-10 w-10 rounded-full border border-rose-400/50 object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-400/50 bg-slate-800 text-xs font-bold text-amber-100">{initials(creator.username)}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{creator.liveStreamTitle || `${creator.username} is live`}</p>
                      <p className="truncate text-[11px] text-slate-400">{[creator.displayName || creator.username, creator.liveGameCategory, creator.livePlatform].filter(Boolean).join(" · ")}</p>
                      <div className="mt-2 flex gap-1.5">
                        <button type="button" onClick={() => setWatchingId(creator.id)} className={goldBtn}>{watchingId === creator.id ? "Watching" : "Watch"}</button>
                        <Link href={`/app/profile?user=${creator.id}`} className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:border-amber-400/50">Profile</Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`${panel} flex flex-col items-center py-12 text-center`}>
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300"><Radio className="h-7 w-7" /></span>
              <p className="text-sm text-slate-300">Nobody is live right now.</p>
              <p className="text-xs text-slate-500">Be the first. Set your stream details on the right and go live.</p>
            </div>
          )}
        </div>

        <aside className={`${panel} ${iAmLive ? "border-rose-400/40" : ""}`}>
          <h2 className="nf-heading mb-1 text-[13px] font-bold uppercase tracking-[0.18em] text-white">{iAmLive ? "You are live" : "Go live"}</h2>
          <p className="mb-3 text-xs text-slate-400">{iAmLive ? `Streaming for ${elapsed(me?.liveStartedAt)} on ${me?.livePlatform}.` : "Tell the community where to watch you."}</p>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {platforms.map((entry) => (
                <button key={entry} type="button" onClick={() => setPlatform(entry)} disabled={iAmLive} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${platform === entry ? "border-amber-400 bg-amber-500/10 text-amber-100" : "border-white/10 text-slate-400"} disabled:opacity-60`}>{entry}</button>
              ))}
            </div>
            <input className={inputClass} placeholder="Stream title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={140} disabled={iAmLive} />
            <input className={inputClass} placeholder="Game or category" value={game} onChange={(event) => setGame(event.target.value)} maxLength={80} disabled={iAmLive} />
            <input className={inputClass} placeholder="Stream URL (https://...)" value={url} onChange={(event) => setUrl(event.target.value)} disabled={iAmLive} />
            {iAmLive ? (
              <button type="button" onClick={() => liveMutation.mutate(false)} disabled={liveMutation.isPending} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-500 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white hover:bg-rose-400 disabled:opacity-50">
                {liveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />} End stream
              </button>
            ) : (
              <button type="button" onClick={() => liveMutation.mutate(true)} disabled={liveMutation.isPending || !user} className={`${goldBtn} w-full justify-center`}>
                {liveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />} Go live
              </button>
            )}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">The viewer count is the number of people watching your stream inside Vexora right now.</p>
        </aside>
      </div>
    </div>
  );
}
