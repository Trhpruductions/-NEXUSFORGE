"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Coins, Heart, MessageCircle, Newspaper, Ticket, Timer } from "lucide-react";
import { getJackpotCurrent, listPosts } from "@/lib/api";
import { plainText } from "@/lib/plain-text";
import { alpha, hues, hueFor } from "@/lib/colors";
import { useAuthStore, useQueryScope } from "@/store/auth-store";

const panel = "relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1119]/85 p-4 backdrop-blur";
const sectionTitle = "nf-heading flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white";

function tint(base: string) {
  return { backgroundImage: `radial-gradient(circle at 0% 0%, ${alpha(base, 0.16)}, transparent 55%)`, boxShadow: `inset 0 2px 0 ${alpha(base, 0.55)}` };
}

/** Optional Home widget: the newest posts from people you follow (yours included). */
export function LatestPostsWidget() {
  const { accessToken } = useAuthStore();
  const queryScope = useQueryScope();
  const query = useQuery({
    queryKey: ["home-latest-posts", queryScope],
    queryFn: () => listPosts(accessToken!, { scope: "following", limit: 4 }),
    enabled: Boolean(accessToken),
    refetchInterval: 60_000,
  });
  const posts = query.data?.posts ?? [];
  return (
    <div className={panel} style={tint(hues.sky.base)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className={sectionTitle}>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: alpha(hues.sky.base, 0.18), color: hues.sky.light }}><Newspaper className="h-4 w-4" /></span>
          Latest posts
        </h3>
        <Link href="/app/feed" className="text-[11px] uppercase tracking-[0.16em] text-sky-300 hover:text-sky-200">Feed</Link>
      </div>
      {posts.length ? (
        <ul className="space-y-2.5">
          {posts.map((post) => (
            <li key={post.id} className="rounded-lg border border-white/5 bg-[#11151e]/80 px-3 py-2" style={{ boxShadow: `inset 3px 0 0 ${alpha(hueFor(post.author.id).base, 0.7)}` }}>
              <p className="text-[11px] text-slate-500"><span className="font-semibold" style={{ color: hueFor(post.author.id).light }}>{post.author.displayName || post.author.username}</span></p>
              <p className="line-clamp-2 text-sm text-slate-200">{plainText(post.content)}</p>
              <p className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3 text-rose-400" /> {post._count.likes}</span>
                <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3 text-sky-400" /> {post._count.comments ?? 0}</span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">{query.isLoading ? "Loading..." : <>Nothing yet. Follow players or <Link href="/app/feed" className="text-amber-300">browse the feed</Link>.</>}</p>
      )}
    </div>
  );
}

/** Optional Home widget: the current jackpot round at a glance. */
export function JackpotWidget() {
  const { accessToken } = useAuthStore();
  const queryScope = useQueryScope();
  const query = useQuery({
    queryKey: ["jackpot", queryScope],
    queryFn: () => getJackpotCurrent(accessToken!),
    enabled: Boolean(accessToken),
    refetchInterval: 15_000,
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const round = query.data?.round;
  const msLeft = round ? Math.max(0, new Date(round.closesAt).getTime() - now) : 0;
  const clock = `${String(Math.floor(msLeft / 60_000)).padStart(2, "0")}:${String(Math.floor((msLeft % 60_000) / 1000)).padStart(2, "0")}`;

  return (
    <div className={panel} style={{ ...tint(hues.amber.base), backgroundImage: `radial-gradient(circle at 100% 0%, ${alpha(hues.orange.base, 0.22)}, transparent 50%), radial-gradient(circle at 0% 100%, ${alpha(hues.pink.base, 0.14)}, transparent 50%)` }}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className={sectionTitle}>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: alpha(hues.amber.base, 0.2), color: hues.amber.light }}><Coins className="h-4 w-4" /></span>
          Hourly jackpot
        </h3>
        {round ? <span className="text-[11px] text-slate-500">#{round.number}</span> : null}
      </div>
      {round && query.data ? (
        <>
          <p className="nf-heading bg-gradient-to-r from-amber-200 via-amber-400 to-orange-400 bg-clip-text text-2xl font-bold text-transparent">{Number(round.projectedPayout).toLocaleString()} <span className="text-xs">coins</span></p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3 text-amber-300" /> {msLeft ? clock : "Drawing..."}</span>
            <span className="inline-flex items-center gap-1"><Ticket className="h-3 w-3 text-pink-300" /> {query.data.myTickets ? `${query.data.myTickets} yours` : `${round.totalTickets} sold`}</span>
          </p>
          <Link href="/app/rewards" className="mt-3 inline-flex items-center rounded-lg bg-gradient-to-r from-amber-300 via-orange-400 to-pink-500 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 shadow-[0_0_16px_rgba(251,138,60,0.35)] hover:brightness-110">
            {query.data.myTickets ? "Buy more" : "Get tickets"}
          </Link>
        </>
      ) : (
        <p className="text-sm text-slate-500">Loading...</p>
      )}
    </div>
  );
}
