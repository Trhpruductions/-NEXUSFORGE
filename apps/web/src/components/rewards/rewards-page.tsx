"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Award, Coins, Cpu, Loader2, ShoppingBag, Sparkles } from "lucide-react";
import { getEconomyAccounts, getUserMedals } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const panel = "rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4";
const sectionTitle = "nf-heading text-[13px] font-bold uppercase tracking-[0.18em] text-white";

const currencyMeta: Record<string, { label: string; hint: string }> = {
  NC: { label: "Vexora Coins", hint: "Spend in the Store" },
  FS: { label: "Forge Shards", hint: "Crafting and boosts" },
  AC: { label: "Aether Crystals", hint: "Premium drops" },
  FR: { label: "Reputation", hint: "Counts toward Points" },
};

function fmt(value: string | number) {
  return Number(value).toLocaleString();
}

export function RewardsPage() {
  const { accessToken, user } = useAuthStore();
  const accountsQuery = useQuery({
    queryKey: ["economy", user?.id, accessToken],
    queryFn: () => getEconomyAccounts(accessToken!, user!.id),
    enabled: Boolean(accessToken && user?.id),
  });
  const medalsQuery = useQuery({
    queryKey: ["medals", user?.id, accessToken],
    queryFn: () => getUserMedals(accessToken!, user!.id),
    enabled: Boolean(accessToken && user?.id),
  });

  const accounts = accountsQuery.data ?? [];
  const coins = accounts.find((account) => account.currencyType === "NC");
  const transactions = accounts.flatMap((account) => (account.transactions ?? []).map((entry) => ({ ...entry, currency: account.currencyType }))).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 12);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="nf-heading text-xl font-bold text-white">Rewards</h1>
        <p className="text-xs text-slate-400">Your balances, recent activity and achievements.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <section className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-[#0d1119] p-5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_30%,rgba(230,179,37,0.25),transparent_50%)]" />
            <div className="relative">
              <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-300"><Coins className="h-3.5 w-3.5" /> Wallet</p>
              {accountsQuery.isLoading ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading balances...</p>
              ) : (
                <>
                  <p className="nf-heading mt-2 text-4xl font-bold text-white">{fmt(coins?.balance ?? 0)} <span className="text-base text-amber-300">Vexora Coins</span></p>
                  <p className="text-xs text-slate-400">Lifetime earned: {fmt(coins?.lifetimeEarnings ?? 0)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href="/app/store" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-300"><ShoppingBag className="h-3.5 w-3.5" /> Spend in Store</Link>
                    <Link href="/app/mining" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:border-amber-400/50"><Cpu className="h-3.5 w-3.5" /> Mining rigs</Link>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(["NC", "FS", "AC", "FR"] as const).map((code) => {
              const account = accounts.find((entry) => entry.currencyType === code);
              const meta = currencyMeta[code];
              return (
                <div key={code} className={panel}>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{meta.label}</p>
                  <p className="nf-heading mt-1 text-xl font-bold text-white">{fmt(account?.balance ?? 0)}</p>
                  <p className="text-[11px] text-slate-500">{meta.hint}</p>
                </div>
              );
            })}
          </section>

          <section className={panel}>
            <h2 className={`${sectionTitle} mb-3`}>Recent activity</h2>
            {transactions.length ? (
              <ul className="space-y-1.5">
                {transactions.map((entry) => {
                  const credit = Number(entry.amount) >= 0;
                  return (
                    <li key={entry.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#11151e] px-3 py-2">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${credit ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" : "border-rose-400/40 bg-rose-500/10 text-rose-300"}`}>
                        {credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-white">{entry.reason}</span>
                        <span className="block text-[11px] text-slate-500">{new Date(entry.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                      </span>
                      <span className={`text-sm font-semibold ${credit ? "text-emerald-300" : "text-rose-300"}`}>{credit ? "+" : ""}{fmt(entry.amount)} {entry.currency}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No transactions yet. Purchases, mining yields and rewards show up here.</p>
            )}
          </section>
        </div>

        <aside className={panel}>
          <h2 className={`${sectionTitle} mb-3 inline-flex items-center gap-2`}><Award className="h-4 w-4 text-amber-300" /> Achievements</h2>
          {medalsQuery.isLoading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : medalsQuery.data?.medals.length ? (
            <ul className="space-y-2">
              {medalsQuery.data.medals.map((medal) => (
                <li key={medal.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#11151e] p-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/10 text-lg">{medal.icon ?? <Sparkles className="h-4 w-4 text-amber-300" />}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{medal.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">{medal.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No achievements yet. Play, post and join events to earn them.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
