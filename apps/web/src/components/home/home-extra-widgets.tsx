"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Heart, MessageCircle, Ticket, Timer } from "lucide-react";
import { getJackpotCurrent, listPosts } from "@/lib/api";
import { plainText } from "@/lib/plain-text";
import { useAuthStore } from "@/store/auth-store";

const panel = "rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4";
const sectionTitle = "nf-heading text-[13px] font-bold uppercase tracking-[0.18em] text-white";

/** Optional Home widget: the newest posts from people you follow (yours included). */
export function LatestPostsWidget() {
  const { accessToken } = useAuthStore();
  const query = useQuery({
    queryKey: ["home-latest-posts", accessToken],
    queryFn: () => listPosts(accessToken!, { scope: "following", limit: 4 }),
    enabled: Boolean(accessToken),
    refetchInterval: 60_000,
  });
  const posts = query.data?.posts ?? [];
  return (
    <div className={panel}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className={sectionTitle}>Latest posts</h3>
        <Link href="/app/feed" className="text-[11px] uppercase tracking-[0.16em] text-amber-300 hover:text-amber-200">Feed</Link>
      </div>
      {posts.length ? (
        <ul className="space-y-2.5">
          {posts.map((post) => (
            <li key={post.id} className="rounded-lg border border-white/5 bg-[#11151e] px-3 py-2">
              <p className="text-[11px] text-slate-500"><span className="font-semibold text-slate-200">{post.author.displayName || post.author.username}</span></p>
              <p className="line-clamp-2 text-sm text-slate-200">{plainText(post.content)}</p>
              <p className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {post._count.likes}</span>
                <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {post._count.comments ?? 0}</span>
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
  const query = useQuery({
    queryKey: ["jackpot", accessToken],
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
    <div className={panel}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className={sectionTitle}>Hourly jackpot</h3>
        {round ? <span className="text-[11px] text-slate-500">#{round.number}</span> : null}
      </div>
      {round && query.data ? (
        <>
          <p className="nf-heading text-2xl font-bold text-white">{Number(round.projectedPayout).toLocaleString()} <span className="text-xs text-amber-300">coins</span></p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3 text-amber-300" /> {msLeft ? clock : "Drawing..."}</span>
            <span className="inline-flex items-center gap-1"><Ticket className="h-3 w-3 text-amber-300" /> {query.data.myTickets ? `${query.data.myTickets} yours` : `${round.totalTickets} sold`}</span>
          </p>
          <Link href="/app/rewards" className="mt-3 inline-flex items-center rounded-lg bg-amber-400 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-300">
            {query.data.myTickets ? "Buy more" : "Get tickets"}
          </Link>
        </>
      ) : (
        <p className="text-sm text-slate-500">Loading...</p>
      )}
    </div>
  );
}
