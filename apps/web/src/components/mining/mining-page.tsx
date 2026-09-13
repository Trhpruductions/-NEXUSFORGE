"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Cpu, Gauge, Loader2, Pickaxe, Plus, Power, Trash2, TrendingUp, X, Zap } from "lucide-react";
import { api, authHeaders, getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

type Rig = { rigId: string; name: string; tier: string; hashRate: number; efficiency: number; status: string; currentYield: string; purchasedAt: string; totalYield: string };
type Stats = { rigCount: number; activeRigs: number; totalHashRate: number; avgEfficiency: number; totalYield: string; pendingYield: string; estimatedHourlyIncome: string };
type Pricing = { tier: string; cost: string; hashRate: number; efficiency: number };

const panel = "rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4";
const sectionTitle = "nf-heading text-[13px] font-bold uppercase tracking-[0.18em] text-white";
const goldBtn = "inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300 disabled:opacity-50";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-amber-400/50 disabled:opacity-50";

const tierTone: Record<string, string> = {
  BASIC: "text-slate-300 border-slate-500/40",
  STANDARD: "text-sky-300 border-sky-400/40",
  ADVANCED: "text-fuchsia-300 border-fuchsia-400/40",
  ELITE: "text-amber-300 border-amber-400/50",
};

function fmt(value: string | number) {
  return Number(value).toLocaleString();
}

export function MiningPage() {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken, user } = useAuthStore();
  const [buyOpen, setBuyOpen] = useState(false);
  const [tier, setTier] = useState("BASIC");
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const headers = { headers: authHeaders(accessToken, csrfToken) };
  const rigsQuery = useQuery({ queryKey: ["mining-rigs", accessToken], queryFn: async () => (await api.get<{ rigs: Rig[] }>("/api/mining/rigs", headers)).data.rigs, enabled: Boolean(accessToken), refetchInterval: 30_000 });
  const statsQuery = useQuery({ queryKey: ["mining-stats", accessToken], queryFn: async () => (await api.get<Stats>("/api/mining/stats", headers)).data, enabled: Boolean(accessToken), refetchInterval: 30_000 });
  const pricingQuery = useQuery({ queryKey: ["mining-pricing"], queryFn: async () => (await api.get<Pricing[]>("/api/mining/pricing")).data });
  const coinsQuery = useQuery({
    queryKey: ["economy", user?.id, accessToken],
    queryFn: async () => (await api.get<Array<{ currencyType: string; balance: string }>>(`/api/economy/${user!.id}`, headers)).data,
    enabled: Boolean(accessToken && user?.id),
  });
  const coins = Number(coinsQuery.data?.find((account) => account.currencyType === "NC")?.balance ?? 0);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mining-rigs"] }),
      queryClient.invalidateQueries({ queryKey: ["mining-stats"] }),
      queryClient.invalidateQueries({ queryKey: ["economy"] }),
    ]);
  };

  const buyMutation = useMutation({
    mutationFn: () => api.post("/api/mining/rigs", { name: name.trim() || `${tier.charAt(0)}${tier.slice(1).toLowerCase()} rig`, tier }, headers),
    onSuccess: async () => {
      setBuyOpen(false);
      setName("");
      setNotice({ tone: "ok", text: "Rig deployed. It starts producing right away." });
      await invalidate();
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const harvestAllMutation = useMutation({
    mutationFn: async () => (await api.post<{ totalHarvested?: string; harvested?: string }>("/api/mining/harvest-all", {}, headers)).data,
    onSuccess: async (result) => {
      const amount = result.totalHarvested ?? result.harvested;
      setNotice({ tone: "ok", text: amount ? `Harvested ${fmt(amount)} Vexora Coins.` : "Harvest complete." });
      await invalidate();
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const harvestOneMutation = useMutation({
    mutationFn: (rigId: string) => api.post(`/api/mining/harvest/${rigId}`, {}, headers),
    onSuccess: invalidate,
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const decommissionMutation = useMutation({
    mutationFn: (rigId: string) => api.delete(`/api/mining/rigs/${rigId}`, headers),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Rig decommissioned. Part of the cost was refunded." });
      await invalidate();
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });

  const rigs = rigsQuery.data ?? [];
  const stats = statsQuery.data;
  const pending = Number(stats?.pendingYield ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="nf-heading text-xl font-bold text-white">Mining</h1>
          <p className="text-xs text-slate-400">Rigs earn Vexora Coins every hour. Harvest to move them into your wallet.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm font-semibold text-amber-100"><Coins className="h-4 w-4 text-amber-300" /> {fmt(coins)}</span>
          <button type="button" onClick={() => setBuyOpen(true)} className={goldBtn}><Plus className="h-3.5 w-3.5" /> Deploy rig</button>
        </div>
      </div>

      {notice ? (
        <div className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${notice.tone === "ok" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-rose-400/30 bg-rose-500/10 text-rose-100"}`}>
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} title="Dismiss"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total hash rate", value: `${fmt(stats?.totalHashRate ?? 0)} H/s`, icon: Gauge },
          { label: "Active rigs", value: `${stats?.activeRigs ?? 0}/${stats?.rigCount ?? 0}`, icon: Cpu },
          { label: "Est. hourly income", value: `${fmt(stats?.estimatedHourlyIncome ?? 0)} NC`, icon: TrendingUp },
          { label: "Ready to harvest", value: `${fmt(pending)} NC`, icon: Pickaxe },
        ].map((stat) => (
          <div key={stat.label} className={`${panel} flex items-center gap-3`}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300"><stat.icon className="h-5 w-5" /></span>
            <span>
              <span className="nf-heading block text-lg font-bold text-white">{statsQuery.isLoading ? "…" : stat.value}</span>
              <span className="block text-[11px] text-slate-400">{stat.label}</span>
            </span>
          </div>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className={panel}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className={sectionTitle}>Your rigs</h2>
            <button type="button" className={goldBtn} disabled={!pending || harvestAllMutation.isPending} onClick={() => harvestAllMutation.mutate()}>
              {harvestAllMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pickaxe className="h-3.5 w-3.5" />} Harvest all
            </button>
          </div>
          {rigsQuery.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading rigs...</p>
          ) : rigs.length ? (
            <ul className="grid gap-2 md:grid-cols-2">
              {rigs.map((rig) => (
                <li key={rig.rigId} className="rounded-xl border border-white/5 bg-[#11151e] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{rig.name}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em]">
                        <span className={cn("rounded-full border px-1.5", tierTone[rig.tier] ?? tierTone.BASIC)}>{rig.tier}</span>
                        <span className={rig.status === "ACTIVE" ? "text-emerald-300" : "text-slate-500"}>{rig.status.toLowerCase()}</span>
                      </p>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300"><Cpu className="h-4 w-4" /></span>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="rounded-lg bg-black/20 p-1.5"><dt className="text-slate-500">Hash</dt><dd className="text-white">{rig.hashRate} H/s</dd></div>
                    <div className="rounded-lg bg-black/20 p-1.5"><dt className="text-slate-500">Efficiency</dt><dd className="text-white">{Math.round(rig.efficiency * 100)}%</dd></div>
                    <div className="rounded-lg bg-black/20 p-1.5"><dt className="text-slate-500">Lifetime</dt><dd className="text-white">{fmt(rig.totalYield)}</dd></div>
                  </dl>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-amber-200">{fmt(rig.currentYield)} NC ready</span>
                    <div className="flex gap-1.5">
                      <button type="button" className={ghostBtn} disabled={Number(rig.currentYield) <= 0 || harvestOneMutation.isPending} onClick={() => harvestOneMutation.mutate(rig.rigId)}><Pickaxe className="h-3.5 w-3.5" /> Harvest</button>
                      <button type="button" className="rounded-lg border border-white/10 p-2 text-slate-500 hover:border-rose-400/50 hover:text-rose-300" title="Decommission (partial refund)" disabled={decommissionMutation.isPending} onClick={() => window.confirm(`Decommission ${rig.name}? Pending yield is harvested and part of the cost refunded.`) && decommissionMutation.mutate(rig.rigId)}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-300"><Power className="h-7 w-7" /></span>
              <p className="text-sm text-slate-300">No rigs yet.</p>
              <p className="text-xs text-slate-500">Deploy your first rig to start earning coins passively.</p>
            </div>
          )}
        </section>

        <aside className={panel}>
          <h2 className={`${sectionTitle} mb-3 inline-flex items-center gap-2`}><Zap className="h-4 w-4 text-amber-300" /> Rig tiers</h2>
          <ul className="space-y-2">
            {(pricingQuery.data ?? []).map((entry) => (
              <li key={entry.tier} className="flex items-center justify-between rounded-xl border border-white/5 bg-[#11151e] px-3 py-2">
                <span>
                  <span className={cn("rounded-full border px-1.5 text-[10px] uppercase tracking-[0.14em]", tierTone[entry.tier] ?? tierTone.BASIC)}>{entry.tier}</span>
                  <span className="mt-1 block text-[11px] text-slate-400">{entry.hashRate} H/s · {Math.round(entry.efficiency * 100)}% efficiency</span>
                </span>
                <span className="text-sm font-semibold text-amber-100">{fmt(entry.cost)} NC</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-slate-500">Yield per hour = hash rate × efficiency. Coins go to <Link href="/app/rewards" className="text-amber-300">Rewards</Link>.</p>
        </aside>
      </div>

      {buyOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setBuyOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-amber-500/25 bg-[#0d1119] p-5">
            <h3 className="nf-heading mb-3 text-base font-bold text-white">Deploy a rig</h3>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {(pricingQuery.data ?? []).map((entry) => {
                const affordable = coins >= Number(entry.cost);
                return (
                  <button key={entry.tier} type="button" onClick={() => setTier(entry.tier)} disabled={!affordable} className={cn("rounded-xl border p-3 text-left transition disabled:opacity-40", tier === entry.tier ? "border-amber-400 bg-amber-500/10" : "border-white/10 bg-[#11151e]")}>
                    <p className={cn("text-xs font-bold uppercase tracking-[0.14em]", (tierTone[entry.tier] ?? "").split(" ")[0])}>{entry.tier}</p>
                    <p className="text-[11px] text-slate-400">{entry.hashRate} H/s · {Math.round(entry.efficiency * 100)}%</p>
                    <p className="mt-1 text-sm font-semibold text-white">{fmt(entry.cost)} NC</p>
                  </button>
                );
              })}
            </div>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="Rig name (optional)" className="h-10 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm text-slate-100 outline-none focus:border-amber-400/60" />
            <p className="mt-2 text-[11px] text-slate-500">You have {fmt(coins)} NC.</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setBuyOpen(false)} className={ghostBtn}>Cancel</button>
              <button type="button" onClick={() => buyMutation.mutate()} disabled={buyMutation.isPending || coins < Number(pricingQuery.data?.find((entry) => entry.tier === tier)?.cost ?? Infinity)} className={goldBtn}>
                {buyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cpu className="h-3.5 w-3.5" />} Deploy
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
