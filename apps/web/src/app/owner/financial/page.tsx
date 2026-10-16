"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { OwnerCard, OwnerEmpty, OwnerNav, OwnerStat } from "@/components/owner/owner-ui";
import { formatCents, formatCount, formatDateTime } from "@/components/owner/format";
import {
  getOwnerFinanceSummary,
  getOwnerTransactions,
  getOwnerWebhooks,
  type FinanceWindow,
  type TransactionFilters,
} from "@/lib/owner-api";

const WINDOWS: Array<{ value: FinanceWindow; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "7 days" },
  { value: "month", label: "30 days" },
  { value: "all", label: "All time" },
];

const STATUS_OPTIONS = ["", "SUCCEEDED", "PENDING", "FAILED", "REFUNDED", "DISPUTED"] as const;
const KIND_OPTIONS = ["", "SUBSCRIPTION", "RENEWAL", "ONE_TIME", "COIN_PACK"] as const;

const STATUS_TONE: Record<string, string> = {
  SUCCEEDED: "text-emerald-200 border-emerald-400/40",
  PENDING: "text-sky-200 border-sky-400/40",
  FAILED: "text-rose-200 border-rose-400/40",
  REFUNDED: "text-violet-200 border-violet-400/40",
  DISPUTED: "text-amber-200 border-amber-400/40",
};

export default function OwnerFinancialPage() {
  const { accessToken, user, hydrated } = useAuthStore();
  const isOwner = user?.appRole === "OWNER";
  const enabled = Boolean(accessToken && isOwner);

  const [window, setWindow] = useState<FinanceWindow>("month");
  const [filters, setFilters] = useState<TransactionFilters>({ page: 1, pageSize: 25 });
  const [searchDraft, setSearchDraft] = useState("");
  const [webhookStatus, setWebhookStatus] = useState<"" | "PROCESSED" | "FAILED">("");
  const [webhookPage, setWebhookPage] = useState(1);

  const summaryQuery = useQuery({
    queryKey: ["owner-finance-summary", accessToken, window],
    queryFn: () => getOwnerFinanceSummary(accessToken!, window),
    enabled,
    refetchInterval: 30_000,
  });

  const transactionsQuery = useQuery({
    queryKey: ["owner-transactions", accessToken, filters],
    queryFn: () => getOwnerTransactions(accessToken!, filters),
    enabled,
    placeholderData: keepPreviousData,
  });

  const webhooksQuery = useQuery({
    queryKey: ["owner-webhooks", accessToken, webhookStatus, webhookPage],
    queryFn: () => getOwnerWebhooks(accessToken!, webhookStatus, webhookPage),
    enabled,
    refetchInterval: 30_000,
  });

  if (hydrated && !isOwner) {
    return (
      <ExperienceShell eyebrow="Owner Console" title="Owner access required" subtitle="Financial data is visible to the owner account only.">
        <p className="text-sm text-slate-300">Sign in with the owner account to continue.</p>
      </ExperienceShell>
    );
  }

  const totals = summaryQuery.data?.totals;
  const trend = summaryQuery.data?.trend ?? [];
  const maxTrend = Math.max(1, ...trend.map((point) => point.grossCents));
  const totalPages = transactionsQuery.data ? Math.max(1, Math.ceil(transactionsQuery.data.total / filters.pageSize)) : 1;

  return (
    <ExperienceShell
      eyebrow="Owner Console"
      title="Financial"
      subtitle="Collected funds are payments Stripe has captured. Pending and failed payments are shown separately and never added to revenue."
    >
      <OwnerNav active="financial" />

      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Revenue window">
        {WINDOWS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setWindow(option.value)}
            aria-pressed={window === option.value}
            className={`rounded-full border px-3 py-1 text-xs ${window === option.value ? "border-amber-400/60 bg-amber-400/15 text-amber-100" : "border-white/10 text-slate-300"}`}
          >
            {option.label}
          </button>
        ))}
        {summaryQuery.data?.provider ? (
          <span className="ml-auto text-xs text-slate-400">
            Stripe: {summaryQuery.data.provider.configured ? "API key set" : "API key missing"} · webhook {summaryQuery.data.provider.webhookConfigured ? "secret set" : "secret missing"}
          </span>
        ) : null}
      </div>

      {summaryQuery.isError ? <div className="mb-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">Could not load financial totals.</div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OwnerCard title="Collected">
          <OwnerStat label="Gross collected" value={totals ? formatCents(totals.grossCents) : "—"} hint={`${totals ? formatCount(totals.capturedCount) : "—"} payments`} />
          <OwnerStat label="Refunds" value={totals ? `−${formatCents(totals.refundCents)}` : "—"} hint={`${totals ? formatCount(totals.refundCount) : "—"} refunds`} />
          <OwnerStat label="Lost disputes" value={totals ? `−${formatCents(totals.lostDisputeCents)}` : "—"} hint={`${totals ? formatCount(totals.lostDisputeCount) : "—"} lost`} />
          <OwnerStat label="Stripe fees" value={totals ? `−${formatCents(totals.feeCents)}` : "—"} hint="Only where Stripe reported the fee" />
          <div className="border-t border-white/10 pt-2">
            <OwnerStat label="Net collected" value={totals ? formatCents(totals.netCents) : "—"} />
          </div>
        </OwnerCard>

        <OwnerCard title="Not collected">
          <OwnerStat label="Pending" value={totals ? formatCents(totals.pendingCents) : "—"} hint={`${totals ? formatCount(totals.pendingCount) : "—"} awaiting confirmation`} />
          <OwnerStat label="Failed attempts" value={totals ? formatCount(totals.failedCount) : "—"} />
          <OwnerStat label="Open disputes (at risk)" value={totals ? formatCents(totals.openDisputeCents) : "—"} hint={`${totals ? formatCount(totals.openDisputeCount) : "—"} open, not deducted from net`} />
        </OwnerCard>

        <OwnerCard title="Subscriptions">
          <OwnerStat label="Active or trialing" value={summaryQuery.data ? formatCount(summaryQuery.data.subscriptions.active) : "—"} />
          <OwnerStat label="Past due" value={summaryQuery.data ? formatCount(summaryQuery.data.subscriptions.pastDue) : "—"} />
          <OwnerStat label="Canceled or expired" value={summaryQuery.data ? formatCount(summaryQuery.data.subscriptions.canceled) : "—"} />
          {summaryQuery.data?.subscriptions.byTier.map((row) => (
            <OwnerStat key={row.tier} label={`${row.tier} tier`} value={formatCount(row.count)} />
          ))}
        </OwnerCard>

        <OwnerCard title="Gross by day">
          {trend.length === 0 ? (
            <OwnerEmpty>No collected payments in this window yet.</OwnerEmpty>
          ) : (
            <div className="flex h-28 items-end gap-1" role="img" aria-label="Gross collected per day">
              {trend.map((point) => (
                <div key={point.day} className="group relative flex-1 rounded-t bg-amber-400/70" style={{ height: `${Math.max(4, (point.grossCents / maxTrend) * 100)}%` }}>
                  <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-2 py-0.5 text-[10px] text-slate-100 group-hover:block">
                    {point.day}: {formatCents(point.grossCents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </OwnerCard>
      </div>

      <section className="nexus-display-panel mt-4 rounded-[24px] p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-400">
            Status
            <select
              className="mt-1 block rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100"
              value={filters.status ?? ""}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value || undefined, page: 1 }))}
            >
              {STATUS_OPTIONS.map((value) => (
                <option key={value || "all"} value={value}>{value || "All statuses"}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Product
            <select
              className="mt-1 block rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100"
              value={filters.kind ?? ""}
              onChange={(event) => setFilters((current) => ({ ...current, kind: event.target.value || undefined, page: 1 }))}
            >
              {KIND_OPTIONS.map((value) => (
                <option key={value || "all"} value={value}>{value || "All products"}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            From
            <input type="date" className="mt-1 block rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" value={filters.from ?? ""} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value || undefined, page: 1 }))} />
          </label>
          <label className="text-xs text-slate-400">
            To
            <input type="date" className="mt-1 block rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" value={filters.to ?? ""} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value || undefined, page: 1 }))} />
          </label>
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setFilters((current) => ({ ...current, q: searchDraft.trim() || undefined, page: 1 }));
            }}
          >
            <label className="text-xs text-slate-400">
              Search
              <input
                className="mt-1 block w-56 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100"
                placeholder="User, email, Stripe ID"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
              />
            </label>
            <button type="submit" className="rounded-lg border border-amber-400/50 px-3 py-1.5 text-xs text-amber-100">Apply</button>
          </form>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="py-2 px-2">Date</th>
                <th className="px-2">User</th>
                <th className="px-2">Product</th>
                <th className="px-2">Status</th>
                <th className="px-2 text-right">Amount</th>
                <th className="px-2 text-right">Refunded</th>
                <th className="px-2 text-right">Fee</th>
                <th className="px-2">Stripe ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactionsQuery.isLoading ? (
                <tr><td colSpan={8}><OwnerEmpty>Loading transactions…</OwnerEmpty></td></tr>
              ) : null}
              {transactionsQuery.data?.items.length === 0 ? (
                <tr><td colSpan={8}><OwnerEmpty>No transactions match these filters.</OwnerEmpty></td></tr>
              ) : null}
              {transactionsQuery.data?.items.map((row) => (
                <tr key={row.id} className="align-top text-slate-300">
                  <td className="px-2 py-2 whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                  <td className="px-2">
                    <span className="text-slate-100">{row.user.username}</span>
                    <span className="block text-[11px] text-slate-500">{row.user.email}</span>
                  </td>
                  <td className="px-2">
                    {row.kind.replace("_", " ").toLowerCase()}
                    <span className="block text-[11px] text-slate-500">{row.featureCode}{row.tier ? ` · ${row.tier}` : ""}</span>
                  </td>
                  <td className="px-2">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] ${STATUS_TONE[row.status] ?? "border-white/10 text-slate-300"}`}>{row.status}</span>
                    {row.disputes.length > 0 ? <span className="block text-[11px] text-amber-200">Dispute: {row.disputes[0].providerStatus}</span> : null}
                  </td>
                  <td className="px-2 text-right tabular-nums">{formatCents(row.amountCents, row.currency)}</td>
                  <td className="px-2 text-right tabular-nums">{row.refundedCents > 0 ? `−${formatCents(row.refundedCents, row.currency)}` : "—"}</td>
                  <td className="px-2 text-right tabular-nums">{row.feeCents != null ? formatCents(row.feeCents, row.currency) : "—"}</td>
                  <td className="px-2 font-mono text-[11px] text-slate-500">{row.providerPaymentId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>{transactionsQuery.data ? `${formatCount(transactionsQuery.data.total)} transactions` : ""}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">Previous</button>
            <span>Page {filters.page} of {totalPages}</span>
            <button type="button" disabled={filters.page >= totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>

      <section className="nexus-display-panel mt-4 rounded-[24px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-100">Payment webhook processing</h2>
          <div className="flex gap-2 text-xs">
            {(["", "PROCESSED", "FAILED"] as const).map((value) => (
              <button
                key={value || "all"}
                type="button"
                onClick={() => {
                  setWebhookStatus(value);
                  setWebhookPage(1);
                }}
                aria-pressed={webhookStatus === value}
                className={`rounded-full border px-3 py-1 ${webhookStatus === value ? "border-amber-400/60 text-amber-100" : "border-white/10 text-slate-300"}`}
              >
                {value || "All"}
              </button>
            ))}
          </div>
        </div>
        {webhooksQuery.data?.items.length === 0 ? <OwnerEmpty>No webhook deliveries recorded yet.</OwnerEmpty> : null}
        {webhooksQuery.data && webhooksQuery.data.items.length > 0 ? (
          <ul className="mt-3 divide-y divide-white/5 text-sm">
            {webhooksQuery.data.items.map((event) => (
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
        {webhooksQuery.data && webhooksQuery.data.total > webhooksQuery.data.pageSize ? (
          <div className="mt-3 flex justify-end gap-2 text-xs text-slate-400">
            <button type="button" disabled={webhookPage <= 1} onClick={() => setWebhookPage((page) => page - 1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">Previous</button>
            <button type="button" disabled={webhookPage * webhooksQuery.data.pageSize >= webhooksQuery.data.total} onClick={() => setWebhookPage((page) => page + 1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        ) : null}
      </section>
    </ExperienceShell>
  );
}
