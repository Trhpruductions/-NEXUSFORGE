"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { OwnerCard as Card, OwnerNav, OwnerStat as Stat } from "@/components/owner/owner-ui";
import { formatCents, formatCount } from "@/components/owner/format";
import { getOwnerOverview } from "@/lib/owner-api";

export default function OwnerOverviewPage() {
  const { accessToken, user, hydrated } = useAuthStore();
  const isOwner = user?.appRole === "OWNER";

  const overviewQuery = useQuery({
    queryKey: ["owner-overview", accessToken],
    queryFn: () => getOwnerOverview(accessToken!),
    enabled: Boolean(accessToken && isOwner),
    refetchInterval: 30_000,
  });

  if (hydrated && !isOwner) {
    return (
      <ExperienceShell eyebrow="Owner Console" title="Owner access required" subtitle="This console shows platform revenue and operations. Only the owner account can open it.">
        <p className="text-sm text-slate-300">Sign in with the owner account to continue.</p>
      </ExperienceShell>
    );
  }

  const data = overviewQuery.data;
  const today = data?.revenue.today;
  const month = data?.revenue.month;

  return (
    <ExperienceShell
      eyebrow="Owner Console"
      title="Platform Overview"
      subtitle="Every figure is read from the database. Revenue counts only payments Stripe has captured."
      metrics={[
        { label: "Users", value: data ? formatCount(data.users.total) : "—", tone: "cyan" },
        { label: "Active 24h", value: data ? formatCount(data.users.active24h) : "—", tone: "emerald" },
        { label: "Revenue today", value: today ? formatCents(today.grossCents) : "—", tone: "amber" },
      ]}
    >
      <OwnerNav active="overview" />

      {overviewQuery.isError ? (
        <div className="nexus-display-panel rounded-[24px] p-5 text-sm text-rose-200">Could not load the overview. Check the API and try again.</div>
      ) : null}

      {data?.alerts.length ? (
        <section className="mb-4 grid gap-2">
          {data.alerts.map((alert) => (
            <div
              key={alert.message}
              className={alert.level === "critical" ? "rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100" : "rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"}
            >
              {alert.message}
            </div>
          ))}
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Users">
          <Stat label="Total" value={data ? formatCount(data.users.total) : "—"} />
          <Stat label="Active last 24h" value={data ? formatCount(data.users.active24h) : "—"} />
          <Stat label="Active last 7 days" value={data ? formatCount(data.users.active7d) : "—"} />
        </Card>
        <Card title="Communities">
          <Stat label="Forges" value={data ? formatCount(data.communities.forges) : "—"} />
        </Card>
        <Card title="Subscriptions">
          <Stat label="Active" value={data ? formatCount(data.subscriptions.active) : "—"} />
          <Stat label="Past due" value={data ? formatCount(data.subscriptions.pastDue) : "—"} />
          <Stat label="Canceled or expired" value={data ? formatCount(data.subscriptions.canceled) : "—"} />
        </Card>
        <Card title="Revenue (last 30 days)">
          <Stat label="Gross collected" value={month ? formatCents(month.grossCents) : "—"} />
          <Stat label="Net collected" value={month ? formatCents(month.netCents) : "—"} />
          <Stat label="Pending (not collected)" value={month ? formatCents(month.pendingCents) : "—"} />
        </Card>
      </div>

      <section className="nexus-display-panel mt-4 rounded-[24px] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">Recent administrative activity</h2>
          <Link href="/owner/financial" className="text-xs text-amber-200 hover:text-amber-100">Financial details →</Link>
        </div>
        {data && data.recentAdminActions.length === 0 ? <p className="mt-3 text-sm text-slate-400">No audited administrative actions yet.</p> : null}
        {data && data.recentAdminActions.length > 0 ? (
          <ul className="mt-3 divide-y divide-white/5 text-sm">
            {data.recentAdminActions.map((action) => (
              <li key={action.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-slate-300">
                <span className="text-slate-100">{action.operation}</span>
                <span>{action.resourceType}</span>
                <span className="text-slate-500">{new Date(action.createdAt).toLocaleString()}</span>
                <span className="text-slate-500">{action.status}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </ExperienceShell>
  );
}
