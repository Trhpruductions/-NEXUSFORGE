"use client";

import { useState } from "react";
import { OwnerCard, OwnerEmpty, OwnerStat } from "@/components/owner/owner-ui";
import { Freshness, OwnerFrame } from "@/components/owner/owner-frame";
import { useOwnerQuery } from "@/components/owner/use-owner-query";
import { ModeToggle } from "@/components/owner/mode-toggle";
import { formatCents, formatChange, formatCount } from "@/components/owner/format";
import { PERIODS, type FinanceSummary, type OwnerMode, type PeriodValue } from "@/lib/owner-api";

const REFRESH_SECONDS = 30;

export default function OwnerFinancePage() {
  const [mode, setMode] = useState<OwnerMode>("live");
  const [period, setPeriod] = useState<PeriodValue>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const customReady = period !== "custom" || (customFrom && customTo && customTo > customFrom);

  const params = {
    mode,
    period,
    ...(period === "custom" && customFrom && customTo ? { from: new Date(customFrom).toISOString(), to: new Date(customTo).toISOString() } : {}),
  };
  const query = useOwnerQuery<FinanceSummary>("/finance/summary", { params, refetchMs: REFRESH_SECONDS * 1000, enabled: Boolean(customReady) });
  const data = query.data;
  const t = data?.totals;
  const p = data?.previousTotals;

  return (
    <OwnerFrame
      title="Finance"
      subtitle="Money collected from verified Stripe records. Pending and failed payments are shown separately and never counted as revenue. Test-mode money never appears in Live."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Freshness updatedAt={query.dataUpdatedAt} isError={query.isError} isFetching={query.isFetching} hasData={Boolean(data)} intervalSeconds={REFRESH_SECONDS} />
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {mode === "test" ? (
        <div className="rounded-2xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">Test mode: these figures come from Stripe test-mode records only. They are not live revenue.</div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-400">
          Period
          <select className="mt-1 block rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" value={period} onChange={(event) => setPeriod(event.target.value as PeriodValue)}>
            {PERIODS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {period === "custom" ? (
          <>
            <label className="text-xs text-slate-400">
              From
              <input type="date" className="mt-1 block rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
            </label>
            <label className="text-xs text-slate-400">
              To (exclusive)
              <input type="date" className="mt-1 block rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
            </label>
            {!customReady ? <span className="text-xs text-amber-200">Choose a from and to date, with to after from.</span> : null}
          </>
        ) : null}
        {data?.period.start ? <span className="text-xs text-slate-400">{new Date(data.period.start).toLocaleDateString()} – {data.period.end ? new Date(data.period.end).toLocaleDateString() : "now"} (UTC)</span> : null}
      </div>

      {query.isError && !data ? <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">Could not load financial totals.</div> : null}
      {!data && !query.isError ? <OwnerEmpty>Loading financial records…</OwnerEmpty> : null}

      {t ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <OwnerCard title="Collected">
              <OwnerStat label="Gross sales" value={formatCents(t.grossCents)} hint={`${formatCount(t.capturedCount)} captured payments`} />
              <OwnerStat label="Refunds issued" value={`−${formatCents(t.refundCents)}`} hint={`${formatCount(t.refundCount)} refund records`} />
              <OwnerStat label="Lost disputes" value={`−${formatCents(t.lostDisputeCents)}`} hint={`${formatCount(t.lostDisputeCount)} lost`} />
              <OwnerStat label="Processing fees" value={`−${formatCents(t.feeCents)}`} hint={`Reported for ${formatCount(t.feeKnownCount)} of ${formatCount(t.capturedCount)} payments`} />
              <div className="border-t border-white/10 pt-2">
                <OwnerStat label="Net collected" value={formatCents(t.netCents)} hint="Gross − refunds − lost disputes − fees" />
                {p ? <p className="mt-1 text-right text-[11px] text-slate-500">{formatChange(t.netCents, p.netCents)}</p> : null}
              </div>
            </OwnerCard>

            <OwnerCard title="Recorded profit">
              <OwnerStat label="Net collected" value={formatCents(t.netCents)} />
              <OwnerStat label="Operating expenses" value={`−${formatCents(t.operatingExpenseCents)}`} hint={`${formatCount(t.operatingExpenseCount)} expense records`} />
              <div className="border-t border-white/10 pt-2">
                <OwnerStat label={data?.coverage.profitLabel ?? "Recorded profit based on available data"} value={formatCents(t.recordedProfitCents)} />
              </div>
              <p className="text-[11px] text-slate-500">Expenses are entered in Expenses &amp; profit. Payment-processing fees are not entered as expenses here, because Stripe fees are already deducted above.</p>
            </OwnerCard>

            <OwnerCard title="Not yet collected">
              <OwnerStat label="Pending" value={formatCents(t.pendingCents)} hint={`${formatCount(t.pendingCount)} awaiting confirmation`} />
              <OwnerStat label="Failed payments" value={formatCount(t.failedCount)} />
              <OwnerStat label="Open disputes (at risk)" value={formatCents(t.openDisputeCents)} hint={`${formatCount(t.openDisputeCount)} open, not deducted from net`} />
              <OwnerStat label="Settlement balance" value="Not connected" hint={data?.provider.settlementBalance} />
            </OwnerCard>

            <OwnerCard title="Recurring revenue">
              <OwnerStat label="MRR" value={formatCents(data!.recurring.mrrCents)} hint={`${formatCount(data!.recurring.subscriptionsWithRevenueBasis)} subscriptions with a captured charge`} />
              <OwnerStat label="ARR" value={formatCents(data!.recurring.arrCents)} />
              <OwnerStat label="Active subscriptions" value={formatCount(data!.recurring.activeSubscriptions)} hint={`${formatCount(data!.subscriptions.pastDue)} past due`} />
              <p className="text-[11px] text-slate-500">{data!.recurring.assumption}</p>
            </OwnerCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <section className="nexus-display-panel overflow-x-auto rounded-[24px] p-5">
              <h2 className="text-sm font-semibold text-slate-100">Revenue by product and provider</h2>
              {data!.breakdown.length === 0 ? <OwnerEmpty>No captured payments in this period and mode.</OwnerEmpty> : null}
              {data!.breakdown.length > 0 ? (
                <table className="mt-3 w-full min-w-[520px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    <tr><th className="px-2 py-2">Product</th><th className="px-2">Type</th><th className="px-2">Provider</th><th className="px-2 text-right">Payments</th><th className="px-2 text-right">Gross</th><th className="px-2 text-right">Fees</th></tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data!.breakdown.map((row) => (
                      <tr key={`${row.featureCode}-${row.kind}-${row.provider}`} className="text-slate-300">
                        <td className="px-2 py-2 text-slate-100">{row.featureCode}</td>
                        <td className="px-2 text-xs">{row.kind.replace("_", " ").toLowerCase()}</td>
                        <td className="px-2 text-xs">{row.provider}</td>
                        <td className="px-2 text-right tabular-nums">{formatCount(row.count)}</td>
                        <td className="px-2 text-right tabular-nums">{formatCents(row.grossCents)}</td>
                        <td className="px-2 text-right tabular-nums">{formatCents(row.feeCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </section>

            <OwnerCard title="Subscriptions (current)">
              <OwnerStat label="Active or trialing" value={formatCount(data!.subscriptions.active)} />
              <OwnerStat label="Past due" value={formatCount(data!.subscriptions.pastDue)} />
              <OwnerStat label="Canceled or expired" value={formatCount(data!.subscriptions.canceled)} hint="Lost recurring revenue" />
              {data!.subscriptions.byTier.map((row) => (
                <OwnerStat key={row.tier} label={`${row.tier} tier`} value={formatCount(row.count)} />
              ))}
            </OwnerCard>
          </div>

          <section className="nexus-display-panel rounded-[24px] p-5">
            <h2 className="text-sm font-semibold text-slate-100">Gross collected per day</h2>
            {data!.trend.length === 0 ? <OwnerEmpty>No captured payments in this period.</OwnerEmpty> : <TrendBars points={data!.trend} />}
          </section>

          <section className="nexus-display-panel rounded-[24px] p-5 text-sm text-slate-300">
            <h2 className="text-sm font-semibold text-slate-100">Data sources and limits</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-400">
              <li>Payments and refunds come from Stripe webhooks recorded in this application. Last processed event: {data!.provider.lastSyncedAt ? new Date(data!.provider.lastSyncedAt).toLocaleString() : "none recorded"}.</li>
              <li>Stripe configuration: {data!.provider.configured ? "API key set" : "API key missing"}, {data!.provider.webhookConfigured ? "webhook secret set" : "webhook secret missing"}.</li>
              <li>Fees are shown only where Stripe reported them ({formatCount(data!.coverage.capturedPaymentsWithFee)} of {formatCount(data!.coverage.capturedPayments)} captured payments).</li>
              <li>Each period is compared with the previous window of the same length. Refunds and disputes are dated by the day they were recorded.</li>
            </ul>
          </section>
        </>
      ) : null}
    </OwnerFrame>
  );
}

function TrendBars({ points }: { points: Array<{ day: string; grossCents: number }> }) {
  const max = Math.max(1, ...points.map((point) => point.grossCents));
  return (
    <div className="mt-4 flex h-40 items-end gap-1" role="img" aria-label="Gross collected per day">
      {points.map((point) => (
        <div key={point.day} className="group relative flex-1 rounded-t bg-amber-400/70" style={{ height: `${Math.max(4, (point.grossCents / max) * 100)}%` }}>
          <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-2 py-0.5 text-[10px] text-slate-100 group-hover:block">
            {point.day}: {formatCents(point.grossCents)}
          </span>
        </div>
      ))}
    </div>
  );
}
