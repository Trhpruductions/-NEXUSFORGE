"use client";

import { useState } from "react";
import { OwnerEmpty, OwnerStat, OwnerCard } from "@/components/owner/owner-ui";
import { Freshness, OwnerFrame } from "@/components/owner/owner-frame";
import { useOwnerQuery } from "@/components/owner/use-owner-query";
import { formatCount, formatDateTime } from "@/components/owner/format";
import type { Paged } from "@/lib/owner-api";

type Community = { id: string; name: string; createdAt: string; owner: { id: string; username: string }; memberCount: number; channelCount: number };
const REFRESH_SECONDS = 60;

export default function OwnerCommunitiesPage() {
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(1);
  const query = useOwnerQuery<Paged<Community>>("/communities", { params: { q: q || undefined, page, pageSize: 25 }, refetchMs: REFRESH_SECONDS * 1000 });
  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / 25)) : 1;

  return (
    <OwnerFrame title="Communities" subtitle="Forges on the platform with their owner, membership and channel counts. Message activity and reports are not shown here yet.">
      <Freshness updatedAt={query.dataUpdatedAt} isError={query.isError} isFetching={query.isFetching} hasData={Boolean(query.data)} intervalSeconds={REFRESH_SECONDS} />
      <OwnerCard title="Overview">
        <OwnerStat label="Communities" value={query.data ? formatCount(query.data.total) : "—"} />
        <OwnerStat label="Message and voice activity" value="Not shown" hint="Per-community message counts are not aggregated yet" />
      </OwnerCard>

      <section className="nexus-display-panel rounded-[24px] p-5">
        <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); setQ(draft.trim()); setPage(1); }}>
          <label className="text-xs text-slate-400">
            Search by name
            <input className="mt-1 block w-72 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" value={draft} onChange={(event) => setDraft(event.target.value)} />
          </label>
          <button type="submit" className="rounded-lg border border-amber-400/50 px-3 py-1.5 text-xs text-amber-100">Search</button>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-2 py-2">Community</th><th className="px-2">Owner</th><th className="px-2 text-right">Members</th><th className="px-2 text-right">Channels</th><th className="px-2">Created</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {query.isLoading ? <tr><td colSpan={5}><OwnerEmpty>Loading communities…</OwnerEmpty></td></tr> : null}
              {query.data && query.data.items.length === 0 ? <tr><td colSpan={5}><OwnerEmpty>No communities match.</OwnerEmpty></td></tr> : null}
              {query.data?.items.map((community) => (
                <tr key={community.id} className="text-slate-300">
                  <td className="px-2 py-2 text-slate-100">{community.name}</td>
                  <td className="px-2 text-xs">{community.owner.username}</td>
                  <td className="px-2 text-right tabular-nums">{formatCount(community.memberCount)}</td>
                  <td className="px-2 text-right tabular-nums">{formatCount(community.channelCount)}</td>
                  <td className="px-2 text-xs whitespace-nowrap">{formatDateTime(community.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-400">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">Next</button>
        </div>
      </section>
    </OwnerFrame>
  );
}
