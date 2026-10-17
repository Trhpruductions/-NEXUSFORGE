"use client";

import Link from "next/link";
import { useState } from "react";
import { OwnerEmpty } from "@/components/owner/owner-ui";
import { Freshness, OwnerFrame } from "@/components/owner/owner-frame";
import { useOwnerQuery } from "@/components/owner/use-owner-query";
import { formatCount, formatDateTime } from "@/components/owner/format";
import type { Paged, UserRow } from "@/lib/owner-api";

const REFRESH_SECONDS = 30;

export default function OwnerUsersPage() {
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(1);
  const query = useOwnerQuery<Paged<UserRow>>("/users", { params: { q: q || undefined, page, pageSize: 25 }, refetchMs: REFRESH_SECONDS * 1000 });
  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / 25)) : 1;

  return (
    <OwnerFrame title="Users" subtitle="Search accounts and open one to see its membership, payments and audit history. Online means active in the last 5 minutes.">
      <Freshness updatedAt={query.dataUpdatedAt} isError={query.isError} isFetching={query.isFetching} hasData={Boolean(query.data)} intervalSeconds={REFRESH_SECONDS} />

      <section className="nexus-display-panel rounded-[24px] p-5">
        <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); setQ(draft.trim()); setPage(1); }}>
          <label className="text-xs text-slate-400">
            Search by username, email or user ID
            <input className="mt-1 block w-72 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" value={draft} onChange={(event) => setDraft(event.target.value)} />
          </label>
          <button type="submit" className="rounded-lg border border-amber-400/50 px-3 py-1.5 text-xs text-amber-100">Search</button>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
              <tr><th className="px-2 py-2">User</th><th className="px-2">Role</th><th className="px-2">Membership</th><th className="px-2">Status</th><th className="px-2">Joined</th><th className="px-2">Last seen</th></tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {query.isLoading ? <tr><td colSpan={6}><OwnerEmpty>Loading users…</OwnerEmpty></td></tr> : null}
              {query.data && query.data.items.length === 0 ? <tr><td colSpan={6}><OwnerEmpty>No accounts match this search.</OwnerEmpty></td></tr> : null}
              {query.data?.items.map((user) => (
                <tr key={user.id} className="text-slate-300 hover:bg-white/5">
                  <td className="px-2 py-2"><Link href={`/owner/users/${user.id}`} className="text-slate-100 hover:text-amber-200">{user.username}</Link><span className="block text-[11px] text-slate-500">{user.email}</span></td>
                  <td className="px-2 text-xs">{user.appRole}</td>
                  <td className="px-2 text-xs">{user.premium ? user.premiumTier : "Free"}</td>
                  <td className="px-2 text-xs">{user.suspendedAt ? <span className="text-rose-200">Suspended</span> : user.online ? <span className="text-emerald-200">Online</span> : "Offline"}</td>
                  <td className="px-2 text-xs whitespace-nowrap">{formatDateTime(user.createdAt)}</td>
                  <td className="px-2 text-xs whitespace-nowrap">{formatDateTime(user.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>{query.data ? `${formatCount(query.data.total)} accounts` : ""}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>
    </OwnerFrame>
  );
}
