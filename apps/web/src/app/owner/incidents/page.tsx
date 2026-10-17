"use client";

import { useState } from "react";
import { OwnerCard, OwnerEmpty } from "@/components/owner/owner-ui";
import { Freshness, OwnerFrame } from "@/components/owner/owner-frame";
import { useOwnerQuery } from "@/components/owner/use-owner-query";
import { formatDateTime } from "@/components/owner/format";
import type { OwnerOverview, Paged, WebhookRow } from "@/lib/owner-api";

const REFRESH_SECONDS = 30;

export default function OwnerIncidentsPage() {
  const [status, setStatus] = useState<"" | "PROCESSED" | "FAILED">("FAILED");
  const [page, setPage] = useState(1);
  const alerts = useOwnerQuery<OwnerOverview>("/overview", { params: { mode: "live" }, refetchMs: REFRESH_SECONDS * 1000 });
  const webhooks = useOwnerQuery<Paged<WebhookRow>>("/finance/webhooks", {
    params: { status: status || undefined, page, pageSize: 25 },
    refetchMs: REFRESH_SECONDS * 1000,
  });
  const totalPages = webhooks.data ? Math.max(1, Math.ceil(webhooks.data.total / 25)) : 1;

  return (
    <OwnerFrame title="Logs & incidents" subtitle="Current alerts, and the payment webhook ledger. Failed webhook deliveries are retried by Stripe until they succeed.">
      <Freshness updatedAt={webhooks.dataUpdatedAt} isError={webhooks.isError} isFetching={webhooks.isFetching} hasData={Boolean(webhooks.data)} intervalSeconds={REFRESH_SECONDS} />

      <OwnerCard title="Current alerts">
        {!alerts.data ? <OwnerEmpty>Loading alerts…</OwnerEmpty> : alerts.data.alerts.length === 0 ? <p className="text-sm text-emerald-100">No active alerts.</p> : (
          <ul className="space-y-2 text-sm">
            {alerts.data.alerts.map((alert) => (
              <li key={alert.message} className={alert.level === "critical" ? "text-rose-100" : "text-amber-100"}>{alert.level === "critical" ? "Critical: " : "Warning: "}{alert.message}</li>
            ))}
          </ul>
        )}
      </OwnerCard>

      <section className="nexus-display-panel rounded-[24px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-100">Payment webhook ledger</h2>
          <div className="flex gap-2 text-xs">
            {(["FAILED", "PROCESSED", ""] as const).map((value) => (
              <button key={value || "all"} type="button" aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }} className={`rounded-full border px-3 py-1 ${status === value ? "border-amber-400/60 text-amber-100" : "border-white/10 text-slate-300"}`}>
                {value || "All"}
              </button>
            ))}
          </div>
        </div>
        {webhooks.data?.items.length === 0 ? <OwnerEmpty>{status === "FAILED" ? "No failed webhook events." : "No webhook events recorded."}</OwnerEmpty> : null}
        {webhooks.data && webhooks.data.items.length > 0 ? (
          <ul className="mt-3 divide-y divide-white/5 text-sm">
            {webhooks.data.items.map((event) => (
              <li key={event.id} className="grid gap-1 py-2 md:grid-cols-[1fr_auto]">
                <div>
                  <span className="text-slate-100">{event.type}</span>
                  <span className="ml-2 font-mono text-[11px] text-slate-500">{event.providerEventId}</span>
                  {event.lastError ? <p className="text-xs text-rose-200">{event.lastError}</p> : null}
                  {event.note ? <p className="text-xs text-amber-200">{event.note}</p> : null}
                </div>
                <div className="text-xs text-slate-400 md:text-right">
                  <span className={event.status === "FAILED" ? "text-rose-200" : "text-emerald-200"}>{event.status}</span>
                  <span className="block">{formatDateTime(event.receivedAt)} · attempts {event.attempts}</span>
                </div>
              </li>
            ))}
          </ul>
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
