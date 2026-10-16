"use client";

import { useState } from "react";
import { OwnerEmpty } from "@/components/owner/owner-ui";
import { Freshness, OwnerFrame } from "@/components/owner/owner-frame";
import { useOwnerQuery } from "@/components/owner/use-owner-query";
import { formatDateTime } from "@/components/owner/format";
import type { Paged } from "@/lib/owner-api";

type AuditRow = {
  id: string;
  createdAt: string;
  operation: string;
  resourceType: string;
  resourceId: string;
  status: string;
  endpoint: string | null;
  method: string | null;
  actor: { id: string; username: string } | null;
  changedFields: string[];
};

const REFRESH_SECONDS = 30;

export default function OwnerAuditPage() {
  const [resourceType, setResourceType] = useState("");
  const [page, setPage] = useState(1);
  const query = useOwnerQuery<Paged<AuditRow>>("/audit", { params: { resourceType: resourceType || undefined, page, pageSize: 25 }, refetchMs: REFRESH_SECONDS * 1000 });
  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / 25)) : 1;

  return (
    <OwnerFrame title="Security & audit" subtitle="Who changed what. Owner-recorded expense changes are logged here with before and after values. Sign-in sessions are not listed here yet.">
      <Freshness updatedAt={query.dataUpdatedAt} isError={query.isError} isFetching={query.isFetching} hasData={Boolean(query.data)} intervalSeconds={REFRESH_SECONDS} />
      <section className="nexus-display-panel overflow-x-auto rounded-[24px] p-5">
        <label className="text-xs text-slate-400">
          Record type
          <select className="mt-1 block rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" value={resourceType} onChange={(event) => { setResourceType(event.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="Expense">Expenses</option>
            <option value="User">Users</option>
            <option value="Guild">Communities</option>
          </select>
        </label>
        {query.data && query.data.items.length === 0 ? <OwnerEmpty>No audit records match.</OwnerEmpty> : null}
        {query.data && query.data.items.length > 0 ? (
          <table className="mt-3 w-full min-w-[760px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-2 py-2">When</th><th className="px-2">Who</th><th className="px-2">Action</th><th className="px-2">Record</th><th className="px-2">Changed</th><th className="px-2">Result</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {query.data.items.map((row) => (
                <tr key={row.id} className="align-top text-slate-300">
                  <td className="px-2 py-2 text-xs whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                  <td className="px-2 text-xs">{row.actor?.username ?? "System"}</td>
                  <td className="px-2 text-xs">{row.operation} {row.method ? `· ${row.method}` : ""}</td>
                  <td className="px-2 text-xs">{row.resourceType}<span className="block font-mono text-[10px] text-slate-500">{row.resourceId}</span></td>
                  <td className="px-2 text-xs">{row.changedFields.join(", ") || "—"}</td>
                  <td className="px-2 text-xs">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-400">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">Next</button>
        </div>
      </section>
    </OwnerFrame>
  );
}
