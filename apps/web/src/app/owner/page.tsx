"use client";

import Link from "next/link";
import { useState } from "react";
import { OwnerCard, OwnerEmpty, OwnerStat } from "@/components/owner/owner-ui";
import { Freshness, OwnerFrame } from "@/components/owner/owner-frame";
import { useOwnerQuery } from "@/components/owner/use-owner-query";
import { ModeToggle } from "@/components/owner/mode-toggle";
import { formatCents, formatCount, formatDateTime } from "@/components/owner/format";
import type { OwnerMode, OwnerOverview } from "@/lib/owner-api";
import { cn } from "@/lib/utils";

const REFRESH_SECONDS = 15;

const STATUS_TONE: Record<string, string> = {
  Online: "border-emerald-500/40 text-emerald-100",
  Degraded: "border-amber-500/50 text-amber-100",
  Offline: "border-rose-500/50 text-rose-100",
  Unknown: "border-slate-500/50 text-slate-200",
  "Not Configured": "border-slate-600/60 text-slate-400",
};

export default function OwnerOverviewPage() {
  const [mode, setMode] = useState<OwnerMode>("live");
  const query = useOwnerQuery<OwnerOverview>("/overview", { params: { mode }, refetchMs: REFRESH_SECONDS * 1000 });
  const data = query.data;

  return (
    <OwnerFrame title="Platform overview" subtitle="Operations, people and money for the whole Nexus Forge Gaming platform. Every figure comes from the application database or a live probe.">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Freshness updatedAt={query.dataUpdatedAt} isError={query.isError} isFetching={query.isFetching} hasData={Boolean(data)} intervalSeconds={REFRESH_SECONDS} />
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {data?.alerts.length ? (
        <section className="grid gap-2">
          {data.alerts.map((alert) => (
            <div key={alert.message} className={cn("rounded-2xl border px-4 py-3 text-sm", alert.level === "critical" ? "border-rose-500/40 bg-rose-500/10 text-rose-100" : "border-amber-500/40 bg-amber-500/10 text-amber-100")}>
              {alert.message}
            </div>
          ))}
        </section>
      ) : data ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-100">No active alerts.</div>
      ) : null}

      {query.isError && !data ? <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">Could not load the overview.</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OwnerCard title="Users">
          <OwnerStat label="Registered" value={data ? formatCount(data.users.registered) : "—"} />
          <OwnerStat label="Online now" value={data ? formatCount(data.users.onlineNow) : "—"} hint={data?.users.onlineDefinition} />
          <OwnerStat label="New in 24h" value={data ? formatCount(data.users.registeredLast24h) : "—"} />
          <OwnerStat label="New in 30 days" value={data ? formatCount(data.users.registeredLast30d) : "—"} />
        </OwnerCard>
        <OwnerCard title="Communities">
          <OwnerStat label="Forges" value={data ? formatCount(data.communities.forges) : "—"} />
        </OwnerCard>
        <OwnerCard title="Paid subscriptions">
          <OwnerStat label="Active or trialing" value={data ? formatCount(data.subscriptions.activePaid) : "—"} hint={`${mode} mode`} />
        </OwnerCard>
        <OwnerCard title="Revenue (this month)">
          <OwnerStat label="Gross collected" value={data ? formatCents(data.revenue.month.grossCents) : "—"} />
          <OwnerStat label="Net collected" value={data ? formatCents(data.revenue.month.netCents) : "—"} />
          <OwnerStat label="Recorded profit" value={data ? formatCents(data.revenue.month.recordedProfitCents) : "—"} hint="Based on recorded expenses" />
        </OwnerCard>
      </div>

      <section className="nexus-display-panel rounded-[24px] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">Service status</h2>
          <Link href="/owner/status" className="text-xs text-amber-200 hover:text-amber-100">All services →</Link>
        </div>
        {!data ? <OwnerEmpty>Checking services…</OwnerEmpty> : null}
        {data ? (
          <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {data.services.map((service) => (
              <li key={service.id} className={cn("flex items-start justify-between gap-3 rounded-xl border bg-black/20 px-3 py-2 text-sm", STATUS_TONE[service.status])}>
                <span>
                  <span className="block text-slate-100">{service.name}</span>
                  <span className="block text-[11px] text-slate-400">{service.detail}</span>
                </span>
                <span className="shrink-0 text-xs font-medium">{service.status}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="nexus-display-panel rounded-[24px] p-5">
        <h2 className="text-sm font-semibold text-slate-100">Recent administrative activity</h2>
        {data && data.recentAdminActions.length === 0 ? <p className="mt-3 text-sm text-slate-400">No audited administrative actions recorded yet.</p> : null}
        {data && data.recentAdminActions.length > 0 ? (
          <ul className="mt-3 divide-y divide-white/5 text-sm">
            {data.recentAdminActions.map((action) => (
              <li key={action.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-slate-300">
                <span className="text-slate-100">{action.operation}</span>
                <span>{action.resourceType}</span>
                <span className="text-slate-500">{formatDateTime(action.createdAt)}</span>
                <span className="text-slate-500">{action.status}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </OwnerFrame>
  );
}
