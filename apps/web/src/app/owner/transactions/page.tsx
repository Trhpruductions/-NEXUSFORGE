"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { OwnerEmpty } from "@/components/owner/owner-ui";
import { Freshness, OwnerFrame } from "@/components/owner/owner-frame";
import { useOwnerQuery } from "@/components/owner/use-owner-query";
import { ModeToggle } from "@/components/owner/mode-toggle";
import { formatCents, formatCount, formatDateTime } from "@/components/owner/format";
import { ownerGet, type OwnerMode, type Paged, type TransactionDetail, type TransactionRow } from "@/lib/owner-api";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

const REFRESH_SECONDS = 30;
const STATUS_OPTIONS = ["", "SUCCEEDED", "PENDING", "FAILED", "REFUNDED", "DISPUTED"] as const;
const KIND_OPTIONS = ["", "SUBSCRIPTION", "RENEWAL", "ONE_TIME", "COIN_PACK"] as const;

const STATUS_TONE: Record<string, string> = {
  SUCCEEDED: "text-emerald-200 border-emerald-400/40",
  PENDING: "text-sky-200 border-sky-400/40",
  FAILED: "text-rose-200 border-rose-400/40",
  REFUNDED: "text-violet-200 border-violet-400/40",
  DISPUTED: "text-amber-200 border-amber-400/40",
};

export default function OwnerTransactionsPage() {
  const { accessToken } = useAuthStore();
  const [mode, setMode] = useState<OwnerMode>("live");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const pageSize = 25;

  const params = {
    mode,
    page,
    pageSize,
    ...(status ? { status } : {}),
    ...(kind ? { kind } : {}),
    ...(from ? { from: new Date(from).toISOString() } : {}),
    ...(to ? { to: new Date(`${to}T23:59:59.999Z`).toISOString() } : {}),
    ...(q ? { q } : {}),
  };

  const query = useOwnerQuery<Paged<TransactionRow>>("/finance/transactions", { params, refetchMs: REFRESH_SECONDS * 1000 });
  const detail = useQuery({
    queryKey: ["owner-transaction", selected, accessToken],
    queryFn: () => ownerGet<TransactionDetail>(accessToken!, `/finance/transactions/${selected}`),
    enabled: Boolean(accessToken && selected),
    placeholderData: keepPreviousData,
  });

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / pageSize)) : 1;
  const resetPage = () => setPage(1);

  return (
    <OwnerFrame title="Transactions" subtitle="Every recorded payment, with its gross, refunds, fees and net. Open a row to see its refunds, disputes and subscription.">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Freshness updatedAt={query.dataUpdatedAt} isError={query.isError} isFetching={query.isFetching} hasData={Boolean(query.data)} intervalSeconds={REFRESH_SECONDS} />
        <ModeToggle mode={mode} onChange={(value) => { setMode(value); resetPage(); setSelected(null); }} />
      </div>

      <section className="nexus-display-panel rounded-[24px] p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-400">
            Status
            <select className="mt-1 block rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" value={status} onChange={(event) => { setStatus(event.target.value); resetPage(); }}>
              {STATUS_OPTIONS.map((value) => <option key={value || "all"} value={value}>{value || "All statuses"}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Type
            <select className="mt-1 block rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" value={kind} onChange={(event) => { setKind(event.target.value); resetPage(); }}>
              {KIND_OPTIONS.map((value) => <option key={value || "all"} value={value}>{value ? value.replace("_", " ").toLowerCase() : "All types"}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            From
            <input type="date" className="mt-1 block rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" value={from} onChange={(event) => { setFrom(event.target.value); resetPage(); }} />
          </label>
          <label className="text-xs text-slate-400">
            To
            <input type="date" className="mt-1 block rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" value={to} onChange={(event) => { setTo(event.target.value); resetPage(); }} />
          </label>
          <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); setQ(searchDraft.trim()); resetPage(); }}>
            <label className="text-xs text-slate-400">
              Search
              <input className="mt-1 block w-60 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-slate-100" placeholder="User, email or Stripe ID" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
            </label>
            <button type="submit" className="rounded-lg border border-amber-400/50 px-3 py-1.5 text-xs text-amber-100">Apply</button>
          </form>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-2 py-2">Date</th><th className="px-2">Customer</th><th className="px-2">Product</th><th className="px-2">Status</th>
                <th className="px-2 text-right">Gross</th><th className="px-2 text-right">Refunded</th><th className="px-2 text-right">Fee</th><th className="px-2 text-right">Net</th><th className="px-2">Stripe ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {query.isLoading ? <tr><td colSpan={9}><OwnerEmpty>Loading transactions…</OwnerEmpty></td></tr> : null}
              {query.data && query.data.items.length === 0 ? <tr><td colSpan={9}><OwnerEmpty>No {mode === "live" ? "live" : "test-mode"} transactions match these filters.</OwnerEmpty></td></tr> : null}
              {query.data?.items.map((row) => (
                <tr key={row.id} onClick={() => setSelected(row.id)} className={cn("cursor-pointer align-top text-slate-300 hover:bg-white/5", selected === row.id && "bg-amber-400/10")}>
                  <td className="px-2 py-2 whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                  <td className="px-2"><span className="text-slate-100">{row.user.username}</span><span className="block text-[11px] text-slate-500">{row.user.email}</span></td>
                  <td className="px-2 text-xs">{row.featureCode}{row.tier ? ` · ${row.tier}` : ""}<span className="block text-[11px] text-slate-500">{row.kind.replace("_", " ").toLowerCase()}</span></td>
                  <td className="px-2"><span className={cn("inline-block rounded-full border px-2 py-0.5 text-[11px]", STATUS_TONE[row.status] ?? "border-white/10 text-slate-300")}>{row.status}</span></td>
                  <td className="px-2 text-right tabular-nums">{formatCents(row.grossCents, row.currency)}</td>
                  <td className="px-2 text-right tabular-nums">{row.refundedCents > 0 ? `−${formatCents(row.refundedCents, row.currency)}` : "—"}</td>
                  <td className="px-2 text-right tabular-nums">{row.feeReported ? formatCents(row.feeCents ?? 0, row.currency) : <span className="text-slate-500" title="Stripe did not report a fee for this payment">Not reported</span>}</td>
                  <td className="px-2 text-right tabular-nums text-slate-100">{formatCents(row.netCents, row.currency)}</td>
                  <td className="px-2 font-mono text-[11px] text-slate-500">{row.providerPaymentId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>{query.data ? `${formatCount(query.data.total)} transactions` : ""}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>

      {selected ? (
        <section className="nexus-display-panel rounded-[24px] p-5" aria-label="Transaction detail">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Transaction detail</h2>
            <button type="button" onClick={() => setSelected(null)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
          </div>
          {detail.isLoading ? <OwnerEmpty>Loading…</OwnerEmpty> : null}
          {detail.data ? <TransactionDetailView detail={detail.data} /> : null}
        </section>
      ) : null}
    </OwnerFrame>
  );
}

function TransactionDetailView({ detail }: { detail: TransactionDetail }) {
  const t = detail.transaction;
  return (
    <div className="mt-3 grid gap-4 text-sm md:grid-cols-2">
      <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1 text-xs text-slate-300">
        <dt className="text-slate-500">Status</dt><dd>{t.status}</dd>
        <dt className="text-slate-500">Mode</dt><dd>{t.livemode ? "Live" : "Test"}</dd>
        <dt className="text-slate-500">Provider</dt><dd>{t.provider}</dd>
        <dt className="text-slate-500">Customer</dt><dd>{t.user.username} ({t.user.email})</dd>
        <dt className="text-slate-500">Product</dt><dd>{t.featureCode}{t.tier ? ` · ${t.tier}` : ""}</dd>
        <dt className="text-slate-500">Gross</dt><dd>{formatCents(t.grossCents, t.currency)}</dd>
        <dt className="text-slate-500">Refunded</dt><dd>{formatCents(t.refundedCents, t.currency)}</dd>
        <dt className="text-slate-500">Fee</dt><dd>{t.feeCents !== null ? formatCents(t.feeCents, t.currency) : "Not reported by Stripe"}</dd>
        <dt className="text-slate-500">Net</dt><dd>{formatCents(t.netCents, t.currency)}</dd>
        <dt className="text-slate-500">Created</dt><dd>{formatDateTime(t.createdAt)}</dd>
        <dt className="text-slate-500">Updated</dt><dd>{formatDateTime(t.updatedAt)}</dd>
        <dt className="text-slate-500">Payment ID</dt><dd className="font-mono break-all">{t.providerPaymentId ?? "—"}</dd>
        <dt className="text-slate-500">Payment intent</dt><dd className="font-mono break-all">{t.providerPaymentIntentId ?? "—"}</dd>
        <dt className="text-slate-500">Subscription</dt><dd className="font-mono break-all">{t.providerSubscriptionId ?? "—"}</dd>
      </dl>
      <div className="space-y-3 text-xs text-slate-300">
        <div>
          <p className="text-slate-500">Refunds</p>
          {detail.refunds.length === 0 ? <p>None recorded.</p> : detail.refunds.map((refund) => (
            <p key={refund.id}>{formatCents(refund.amountCents, t.currency)} · {refund.status} · {formatDateTime(refund.createdAt)}</p>
          ))}
        </div>
        <div>
          <p className="text-slate-500">Disputes</p>
          {detail.disputes.length === 0 ? <p>None recorded.</p> : detail.disputes.map((dispute) => (
            <p key={dispute.id}>{formatCents(dispute.amountCents, t.currency)} · {dispute.status} ({dispute.providerStatus}) · {formatDateTime(dispute.createdAt)}</p>
          ))}
        </div>
        <div>
          <p className="text-slate-500">Subscription</p>
          {detail.subscription ? (
            <p>{detail.subscription.status} · {detail.subscription.tier} · {detail.subscription.interval.toLowerCase()}{detail.subscription.cancelAtPeriodEnd ? " · cancels at period end" : ""}{detail.subscription.currentPeriodEnd ? ` · renews ${formatDateTime(detail.subscription.currentPeriodEnd)}` : ""}</p>
          ) : <p>Not a subscription payment.</p>}
        </div>
      </div>
    </div>
  );
}
