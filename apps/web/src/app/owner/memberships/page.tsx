"use client";

import { useState } from "react";
import { OwnerCard, OwnerStat } from "@/components/owner/owner-ui";
import { Freshness, OwnerFrame } from "@/components/owner/owner-frame";
import { useOwnerQuery } from "@/components/owner/use-owner-query";
import { ModeToggle } from "@/components/owner/mode-toggle";
import { formatCount } from "@/components/owner/format";
import type { MembershipSummary, OwnerMode } from "@/lib/owner-api";

const REFRESH_SECONDS = 60;

export default function OwnerMembershipsPage() {
  const [mode, setMode] = useState<OwnerMode>("live");
  const query = useOwnerQuery<MembershipSummary>("/memberships", { params: { mode }, refetchMs: REFRESH_SECONDS * 1000 });
  const data = query.data;
  const t = data?.totals;
  const r = data?.reconciliation;

  return (
    <OwnerFrame title="Memberships" subtitle="Who has access and whether a paid record backs it. A manual or legacy premium flag is never counted as a paid subscriber.">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Freshness updatedAt={query.dataUpdatedAt} isError={query.isError} isFetching={query.isFetching} hasData={Boolean(data)} intervalSeconds={REFRESH_SECONDS} />
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <OwnerCard title="Accounts">
          <OwnerStat label="Total accounts" value={t ? formatCount(t.totalAccounts) : "—"} />
          <OwnerStat label="Free (no premium flag)" value={t ? formatCount(t.freeAccounts) : "—"} />
          <OwnerStat label="Premium flag set" value={t ? formatCount(t.premiumFlagAccounts) : "—"} hint="Includes manual and legacy grants" />
          <OwnerStat label="Suspended" value={t ? formatCount(t.suspendedAccounts) : "—"} />
        </OwnerCard>
        <OwnerCard title="Paid subscriptions">
          <OwnerStat label="Active or trialing" value={t ? formatCount(t.paidSubscribersActive) : "—"} hint={`${mode} mode billing records`} />
          <OwnerStat label="Past due" value={t ? formatCount(t.pastDue) : "—"} />
          <OwnerStat label="Canceled or expired" value={t ? formatCount(t.canceledOrExpired) : "—"} />
          <OwnerStat label="Lifetime members" value="Not tracked" hint={t?.lifetime} />
        </OwnerCard>
        <OwnerCard title="Reconciliation">
          <OwnerStat label="Premium with a billing record" value={r ? formatCount(r.premiumWithBillingRecord) : "—"} />
          <OwnerStat label="Premium without a billing record" value={r ? formatCount(r.premiumWithoutBillingRecord) : "—"} hint="Manual, legacy, or bypass" />
          <OwnerStat label="Premium without a verified payment" value={r ? formatCount(r.premiumWithoutVerifiedPayment) : "—"} />
          <OwnerStat label="Accounts with a verified payment" value={r ? formatCount(r.accountsWithVerifiedPayment) : "—"} />
        </OwnerCard>
      </div>

      {r ? <p className="text-xs text-slate-400">{r.note}</p> : null}

      <section className="nexus-display-panel rounded-[24px] p-5">
        <h2 className="text-sm font-semibold text-slate-100">Premium accounts by tier</h2>
        {data && data.premiumByTier.length === 0 ? <p className="mt-2 text-sm text-slate-400">No premium accounts.</p> : null}
        <ul className="mt-2 grid gap-2 md:grid-cols-4">
          {data?.premiumByTier.map((row) => (
            <li key={row.tier} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <span className="text-slate-400">{row.tier}</span> <span className="float-right tabular-nums text-slate-100">{formatCount(row.count)}</span>
            </li>
          ))}
        </ul>
      </section>
    </OwnerFrame>
  );
}
