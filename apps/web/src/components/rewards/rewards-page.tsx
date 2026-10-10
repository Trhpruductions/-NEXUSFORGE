"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Check, Coins, Cpu, Flame, Gift, Loader2, Send, ShoppingBag, Sparkles } from "lucide-react";
import { claimDailyReward, getApiErrorMessage, getDailyReward, getEconomyAccounts, getUserMedals } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { CoinHistory } from "./coin-history";
import { JackpotPanel } from "./jackpot-panel";
import { SendCoinsDialog } from "./send-coins-dialog";

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
  const { accessToken, csrfToken, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [claimNotice, setClaimNotice] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const dailyQuery = useQuery({
    queryKey: ["daily-reward", accessToken],
    queryFn: () => getDailyReward(accessToken!),
    enabled: Boolean(accessToken),
  });
  const claimMutation = useMutation({
    mutationFn: () => claimDailyReward(accessToken!, csrfToken!),
    onSuccess: async (result) => {
      setClaimNotice(`+${Number(result.amount).toLocaleString()} Vexora Coins. Day ${result.streak} streak.`);
      await queryClient.invalidateQueries({ queryKey: ["daily-reward"] });
      await queryClient.invalidateQueries({ queryKey: ["economy"] });
    },
    onError: (error) => setClaimNotice(getApiErrorMessage(error)),
  });
  const daily = dailyQuery.data;
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
                    <button type="button" onClick={() => setSendOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100 hover:border-amber-300"><Send className="h-3.5 w-3.5" /> Send coins</button>
                    <Link href="/app/mining" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:border-amber-400/50"><Cpu className="h-3.5 w-3.5" /> Mining rigs</Link>
                  </div>
                </>
              )}
            </div>
          </section>

          <JackpotPanel balance={coins?.balance ?? "0"} />

          <section className={`${panel} flex flex-wrap items-center gap-4`}>
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${daily?.claimedToday ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" : "border-amber-400/50 bg-amber-500/10 text-amber-300"}`}>
              {daily?.claimedToday ? <Check className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className={sectionTitle}>Daily reward</h2>
              {daily ? (
                <p className="text-xs text-slate-400">
                  {daily.claimedToday ? `Claimed today. Next reward unlocks ${new Date(daily.nextResetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.` : `Claim ${Number(daily.nextAmount).toLocaleString()} Vexora Coins today.`}
                  {daily.streak ? <span className="ml-2 inline-flex items-center gap-1 text-amber-300"><Flame className="h-3 w-3" /> {daily.streak} day streak</span> : null}
                </p>
              ) : (
                <p className="text-xs text-slate-400">Loading...</p>
              )}
              {claimNotice ? <p className="mt-1 text-xs text-emerald-200">{claimNotice}</p> : null}
            </div>
            <button
              type="button"
              disabled={!daily || daily.claimedToday || claimMutation.isPending}
              onClick={() => claimMutation.mutate()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-300 disabled:opacity-50"
            >
              {claimMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />} {daily?.claimedToday ? "Claimed" : "Claim"}
            </button>
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

          <CoinHistory className={panel} />
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

      <SendCoinsDialog open={sendOpen} onClose={() => setSendOpen(false)} balance={coins?.balance ?? "0"} />
    </div>
  );
}
