"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Hash, Heart, Link2, MessageCircle, Mic2, Radio, ShoppingBag, Users, Wifi, Zap, Check } from "lucide-react";
import { getHomeSummary } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "VX"
  );
}

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const panel = "rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4";
const sectionTitle = "nf-heading text-[13px] font-bold uppercase tracking-[0.18em] text-white";

function Avatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full border border-amber-500/30 object-cover" />
  ) : (
    <span
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.32) }}
      className="flex shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-gradient-to-br from-slate-800 to-slate-900 font-bold text-amber-100"
    >
      {initials(name)}
    </span>
  );
}

export function HomeDashboard() {
  const { accessToken } = useAuthStore();
  const selectedForgeId = useWorkspaceStore((state) => state.selectedForgeId);
  const [copied, setCopied] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ["home-summary", selectedForgeId, accessToken],
    queryFn: () => getHomeSummary(accessToken!, selectedForgeId),
    enabled: Boolean(accessToken),
    refetchInterval: 45_000,
  });
  const data = summaryQuery.data;
  const forge = data?.forge ?? null;

  const copyInvite = async () => {
    if (!forge) return;
    const url = `${window.location.origin}/invite/${forge.inviteCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy your invite link", url);
    }
  };

  const stats = [
    { label: "Community Members", value: compact(data?.stats.members ?? 0), icon: Users },
    { label: "Online Now", value: compact(data?.stats.online ?? 0), icon: Wifi },
    { label: "Active Channels", value: String(data?.stats.channels ?? 0), icon: Hash },
    { label: "Upcoming Events", value: String(data?.stats.upcomingEvents ?? 0), icon: Calendar },
  ];

  const quickActions = [
    { label: copied ? "Invite link copied" : "Invite Friends", icon: copied ? Check : Link2, onClick: copyInvite },
    { label: "Join Voice Channel", icon: Mic2, href: selectedForgeId ? `/app/chat?forge=${selectedForgeId}&voice=1` : "/app/chat" },
    { label: "View Events", icon: Calendar, href: "/app/events" },
    { label: "Shop Store", icon: ShoppingBag, href: "/app/store" },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-[#0d1119]">
          {forge?.banner ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={forge.banner} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(230,179,37,0.22),transparent_55%),linear-gradient(160deg,#0f1420,#070a10_60%,#1a1206)]" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(230,179,37,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(230,179,37,0.06)_1px,transparent_1px)] bg-[size:36px_36px] opacity-40" />
          <div className="relative flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
            <Image src="/brand/vexora-mark-gold-256.png" alt="" width={72} height={72} className="mb-3 h-[72px] w-[72px] rounded-2xl border border-amber-500/40 object-cover shadow-[0_0_30px_rgba(230,179,37,0.35)]" />
            <h1 className="nf-heading text-3xl font-black uppercase tracking-[0.2em] text-white sm:text-4xl">{forge?.name ?? "Vexora Gaming"}</h1>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-300">
              {forge?.description || "Built for gamers. Connected by community."}
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className={`${panel} flex items-center gap-3`}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300">
                <stat.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="nf-heading block text-xl font-bold text-white">{summaryQuery.isLoading ? "…" : stat.value}</span>
                <span className="block text-[11px] text-slate-400">{stat.label}</span>
              </span>
            </div>
          ))}
        </section>

        {/* Featured event */}
        <section className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-[#0d1119]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_50%,rgba(230,179,37,0.25),transparent_45%)]" />
          <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-300">
                {data?.featuredEvent ? (data.featuredEvent.status === "LIVE" ? "Live now" : "Featured event") : "Events"}
              </p>
              {data?.featuredEvent ? (
                <>
                  <h2 className="nf-heading mt-2 text-2xl font-bold uppercase tracking-wide text-white">{data.featuredEvent.title}</h2>
                  <p className="mt-2 max-w-lg text-sm text-slate-300">{data.featuredEvent.description || "Join the squad for the next community session."}</p>
                  <p className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-amber-300" /> {formatEventDate(data.featuredEvent.startsAt)}</span>
                    <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-amber-300" /> {data.featuredEvent._count.participants} going</span>
                    {data.featuredEvent.game ? <span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-amber-300" /> {data.featuredEvent.game}</span> : null}
                  </p>
                  <Link href="/app/events" className="mt-4 inline-flex items-center rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300">
                    View details
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="nf-heading mt-2 text-2xl font-bold uppercase tracking-wide text-white">Community game night</h2>
                  <p className="mt-2 max-w-lg text-sm text-slate-300">No events are scheduled yet. Create the first one and it will be featured here for the whole forge.</p>
                  <Link href="/app/events" className="mt-4 inline-flex items-center rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300">
                    Schedule an event
                  </Link>
                </>
              )}
            </div>
            <div className="hidden h-36 w-52 items-center justify-center rounded-2xl border border-amber-500/30 bg-[radial-gradient(circle,rgba(230,179,37,0.35),transparent_70%)] md:flex">
              <Image src="/brand/vexora-mark-gold-256.png" alt="" width={96} height={96} className="h-24 w-24 rounded-2xl object-cover opacity-90" />
            </div>
          </div>
        </section>

        {/* Activity + creators */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className={panel}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className={sectionTitle}>Recent Activity</h3>
              <Link href={selectedForgeId ? `/app/chat?forge=${selectedForgeId}` : "/app/chat"} className="text-[11px] uppercase tracking-[0.16em] text-amber-300 hover:text-amber-200">Open chat</Link>
            </div>
            <ul className="space-y-3">
              {(data?.recentActivity ?? []).map((item) => (
                <li key={item.id} className="flex gap-3">
                  <Avatar src={item.author?.avatar} name={item.author?.username ?? "?"} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-400">
                      <span className="text-sm font-semibold text-white">{item.author?.displayName || item.author?.username || "Unknown"}</span>
                      <span>{timeAgo(item.createdAt)}</span>
                    </p>
                    <p className="truncate text-sm text-slate-200">
                      {item.content} <Link href={`/app/chat?forge=${selectedForgeId}&channel=${item.channel.id}`} className="text-amber-300">#{item.channel.name}</Link>
                    </p>
                    <p className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {item.reactions}</span>
                      <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {item.replies}</span>
                    </p>
                  </div>
                </li>
              ))}
              {!data?.recentActivity?.length && !summaryQuery.isLoading ? <li className="text-sm text-slate-500">No messages yet. Say hello in a channel.</li> : null}
            </ul>
          </div>

          <div className={panel}>
            <h3 className={`${sectionTitle} mb-3`}>Top Creators</h3>
            <ul className="space-y-2.5">
              {(data?.topCreators ?? []).map((creator, index) => (
                <li key={creator.id}>
                  <Link href={`/app/profile?user=${creator.id}`} className="flex items-center gap-3 rounded-lg px-1 py-1 transition hover:bg-white/[0.03]">
                    <span className="w-4 text-[11px] font-bold text-amber-400">{index + 1}</span>
                    <Avatar src={creator.avatar} name={creator.username} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{creator.displayName || creator.username}</span>
                      {creator.live ? <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-400">Live · {compact(creator.viewers)}</span> : null}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Users className="h-3 w-3" /> {compact(creator.followers)}</span>
                  </Link>
                </li>
              ))}
              {!data?.topCreators?.length && !summaryQuery.isLoading ? <li className="text-sm text-slate-500">No creators yet.</li> : null}
            </ul>
          </div>
        </section>
      </div>

      {/* Right column */}
      <aside className="space-y-4">
        <div className={panel}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className={sectionTitle}>Live Now</h3>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-rose-400"><Radio className="h-3 w-3" /> {data?.liveNow.length ?? 0}</span>
          </div>
          {data?.liveNow.length ? (
            <ul className="space-y-3">
              {data.liveNow.map((live) => (
                <li key={live.id} className="overflow-hidden rounded-xl border border-white/5 bg-[#11151e]">
                  <div className="relative h-24 bg-[radial-gradient(circle_at_30%_30%,rgba(230,179,37,0.3),transparent_60%),linear-gradient(160deg,#141a26,#0b0e15)]">
                    <span className="absolute left-2 top-2 rounded bg-rose-500 px-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white">Live</span>
                    <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 text-[10px] text-white">{compact(live.liveViewerCount)} watching</span>
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-sm font-semibold text-white">{live.liveStreamTitle || `${live.username} is live`}</p>
                    <p className="truncate text-[11px] text-slate-400">{[live.liveGameCategory, live.livePlatform].filter(Boolean).join(" · ") || live.username}</p>
                    {live.liveStreamUrl ? (
                      <a href={live.liveStreamUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300 hover:text-amber-200">Watch</a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Nobody is streaming right now. Go live from your profile to show up here.</p>
          )}
        </div>

        <div className={panel}>
          <h3 className={`${sectionTitle} mb-3`}>Quick Actions</h3>
          <div className="space-y-2">
            {quickActions.map((action) =>
              action.href ? (
                <Link key={action.label} href={action.href} className="flex items-center gap-3 rounded-lg border border-white/5 bg-[#11151e] px-3 py-2.5 text-sm text-slate-200 transition hover:border-amber-400/50 hover:text-white">
                  <action.icon className="h-4 w-4 text-amber-300" /> {action.label}
                </Link>
              ) : (
                <button key={action.label} type="button" onClick={action.onClick} className="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-[#11151e] px-3 py-2.5 text-left text-sm text-slate-200 transition hover:border-amber-400/50 hover:text-white">
                  <action.icon className="h-4 w-4 text-amber-300" /> {action.label}
                </button>
              ),
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
