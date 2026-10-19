"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Loader2, Send } from "lucide-react";
import { getCoinHistory, type CoinHistoryKind, type CoinTransaction } from "@/lib/api";
import { useAuthStore, useQueryScope } from "@/store/auth-store";

const tabs: Array<{ key: CoinHistoryKind; label: string }> = [
  { key: "all", label: "All" },
  { key: "in", label: "Received" },
  { key: "out", label: "Spent & sent" },
];

function describe(entry: CoinTransaction) {
  if (entry.type === "TRANSFER_OUT" && entry.counterpartyUsername) return `Sent to @${entry.counterpartyUsername}`;
  if (entry.type === "TRANSFER_IN" && entry.counterpartyUsername) return `From @${entry.counterpartyUsername}`;
  return entry.reason ?? (Number(entry.amount) >= 0 ? "Credit" : "Debit");
}

export function CoinHistory({ className = "" }: { className?: string }) {
  const { accessToken } = useAuthStore();
  const queryScope = useQueryScope();
  const [kind, setKind] = useState<CoinHistoryKind>("all");
  const query = useInfiniteQuery({
    queryKey: ["coin-history", kind, queryScope],
    queryFn: ({ pageParam }) => getCoinHistory(accessToken!, { cursor: pageParam, kind }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(accessToken),
  });
  const entries = query.data?.pages.flatMap((page) => page.transactions) ?? [];

  return (
    <section className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="nf-heading text-[13px] font-bold uppercase tracking-[0.18em] text-white">Coin history</h2>
        <div className="flex gap-1 rounded-lg border border-white/5 bg-[#0a0d14] p-0.5" role="tablist" aria-label="Filter coin history">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={kind === tab.key}
              onClick={() => setKind(tab.key)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${kind === tab.key ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading history...</p>
      ) : entries.length ? (
        <>
          <ul className="space-y-1.5">
            {entries.map((entry) => {
              const credit = Number(entry.amount) >= 0;
              const transfer = entry.type === "TRANSFER_IN" || entry.type === "TRANSFER_OUT";
              return (
                <li key={entry.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#11151e] px-3 py-2">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${credit ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" : "border-rose-400/40 bg-rose-500/10 text-rose-300"}`}>
                    {transfer && !credit ? <Send className="h-3.5 w-3.5" /> : credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-white">{describe(entry)}</span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {new Date(entry.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      {entry.note ? <span className="italic text-slate-400"> · &ldquo;{entry.note}&rdquo;</span> : null}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className={`block text-sm font-semibold ${credit ? "text-emerald-300" : "text-rose-300"}`}>{credit ? "+" : ""}{Number(entry.amount).toLocaleString()}</span>
                    {entry.balanceAfter !== null ? <span className="block text-[10px] text-slate-600">bal {Number(entry.balanceAfter).toLocaleString()}</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
          {query.hasNextPage ? (
            <button
              type="button"
              onClick={() => void query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300 hover:border-amber-400/50 disabled:opacity-50"
            >
              {query.isFetchingNextPage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Load more
            </button>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-slate-500">
          {kind === "all" ? "No coin activity yet. Rewards, purchases and transfers show up here." : kind === "in" ? "Nothing received yet." : "Nothing spent or sent yet."}
        </p>
      )}
    </section>
  );
}
