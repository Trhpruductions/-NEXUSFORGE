"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Backpack, Check, Coins, Crown, Footprints, Glasses, HardHat, Loader2, Search, Shirt, ShoppingBag, Sparkles, Sword, X } from "lucide-react";
import { getCosmeticCatalog, getCosmeticInventory, purchaseCosmetic, setLoadoutSlot, type CosmeticItem, type CosmeticRarity, type CosmeticSlot } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

type Filter = "all" | "outfits" | "accessories" | "cosmetics" | "emotes";

const filters: Array<{ id: Filter; label: string; slots: CosmeticSlot[] | null }> = [
  { id: "all", label: "All", slots: null },
  { id: "outfits", label: "Outfits", slots: ["TOP", "BOTTOM", "SHOES"] },
  { id: "accessories", label: "Accessories", slots: ["HEAD", "FACE", "BACK", "ACCESSORY"] },
  { id: "cosmetics", label: "Cosmetics", slots: ["HEAD", "FACE"] },
  { id: "emotes", label: "Emotes", slots: ["EMOTE"] },
];

const slotMeta: Record<CosmeticSlot, { label: string; icon: typeof Shirt }> = {
  HEAD: { label: "Head", icon: HardHat },
  FACE: { label: "Face", icon: Glasses },
  TOP: { label: "Top", icon: Shirt },
  BOTTOM: { label: "Bottom", icon: Sword },
  SHOES: { label: "Shoes", icon: Footprints },
  BACK: { label: "Back", icon: Backpack },
  ACCESSORY: { label: "Accessory", icon: Crown },
  EMOTE: { label: "Emote", icon: Sparkles },
};

const rarityMeta: Record<CosmeticRarity, { label: string; tone: string; glow: string }> = {
  COMMON: { label: "Common", tone: "text-slate-300 border-slate-500/40", glow: "rgba(148,163,184,0.25)" },
  RARE: { label: "Rare", tone: "text-sky-300 border-sky-400/40", glow: "rgba(56,189,248,0.3)" },
  EPIC: { label: "Epic", tone: "text-fuchsia-300 border-fuchsia-400/40", glow: "rgba(217,70,239,0.3)" },
  LEGENDARY: { label: "Legendary", tone: "text-amber-300 border-amber-400/50", glow: "rgba(230,179,37,0.35)" },
  MYTHIC: { label: "Mythic", tone: "text-rose-300 border-rose-400/50", glow: "rgba(244,63,94,0.35)" },
};

const panel = "rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4";
const sectionTitle = "nf-heading text-[13px] font-bold uppercase tracking-[0.18em] text-white";

function errorText(error: unknown) {
  if (axios.isAxiosError(error)) return (error.response?.data as { error?: string } | undefined)?.error ?? error.message;
  return error instanceof Error ? error.message : "Something went wrong";
}

function ItemArt({ item, size = 96 }: { item: CosmeticItem; size?: number }) {
  const Icon = slotMeta[item.slot].icon;
  const accent = item.metadata?.accent ?? "#e6b325";
  return item.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.imageUrl} alt="" style={{ width: size, height: size }} className="rounded-xl object-cover" />
  ) : (
    <div
      style={{ width: size, height: size, background: `radial-gradient(circle at 30% 30%, ${accent}33, transparent 60%), linear-gradient(160deg, ${item.color ?? "#1e293b"}, #0b0e15)` }}
      className="flex items-center justify-center rounded-xl border border-white/10"
    >
      <Icon className="h-1/2 w-1/2" style={{ color: accent }} />
    </div>
  );
}

export function WardrobePage({ mode }: { mode: "wardrobe" | "store" }) {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const query = useQuery({
    queryKey: ["cosmetics", mode, accessToken],
    queryFn: () => (mode === "store" ? getCosmeticCatalog(accessToken!) : getCosmeticInventory(accessToken!)),
    enabled: Boolean(accessToken),
  });
  const catalogQuery = useQuery({
    queryKey: ["cosmetics", "store", accessToken],
    queryFn: () => getCosmeticCatalog(accessToken!),
    enabled: Boolean(accessToken && mode === "wardrobe"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["cosmetics"] });

  const equipMutation = useMutation({
    mutationFn: (input: { slot: CosmeticSlot; itemId: string | null }) => setLoadoutSlot(accessToken!, csrfToken!, input.slot, input.itemId),
    onSuccess: invalidate,
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const buyMutation = useMutation({
    mutationFn: (itemId: string) => purchaseCosmetic(accessToken!, csrfToken!, itemId),
    onSuccess: async (result) => {
      setNotice({ tone: "ok", text: `${result.item.name} added to your wardrobe.` });
      await invalidate();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  const items = useMemo(() => {
    const list = query.data?.items ?? [];
    const slots = filters.find((entry) => entry.id === filter)?.slots;
    const term = search.trim().toLowerCase();
    return list.filter((item) => (!slots || slots.includes(item.slot)) && (!term || item.name.toLowerCase().includes(term) || item.rarity.toLowerCase().includes(term)));
  }, [query.data, filter, search]);

  const loadout = query.data?.loadout ?? {};
  const allItems = mode === "store" ? query.data?.items ?? [] : [...(query.data?.items ?? []), ...(catalogQuery.data?.items ?? [])];
  const itemById = new Map(allItems.map((item) => [item.id, item] as const));
  const coins = query.data?.coins ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="nf-heading text-xl font-bold text-white">{mode === "store" ? "Store" : "Wardrobe & Inventory"}</h1>
          <p className="text-xs text-slate-400">{mode === "store" ? "Outfits, cosmetics and emotes. Spend Vexora Coins." : "Outfits. Cosmetics. Collectibles."}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm font-semibold text-amber-100">
            <Coins className="h-4 w-4 text-amber-300" /> {coins.toLocaleString()} <span className="text-[10px] uppercase tracking-[0.16em] text-amber-300/80">Vexora Coins</span>
          </span>
          <Link href={mode === "store" ? "/app/wardrobe" : "/app/store"} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:border-amber-400/50">
            {mode === "store" ? <><Shirt className="h-3.5 w-3.5" /> Wardrobe</> : <><ShoppingBag className="h-3.5 w-3.5" /> Store</>}
          </Link>
        </div>
      </div>

      {notice ? (
        <div className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${notice.tone === "ok" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-rose-400/30 bg-rose-500/10 text-rose-100"}`}>
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} title="Dismiss"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-xl border border-white/5 bg-[#0d1119] p-1">
              {filters.map((entry) => (
                <button key={entry.id} type="button" onClick={() => setFilter(entry.id)} className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${filter === entry.id ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"}`}>
                  {entry.label}
                </button>
              ))}
            </div>
            <div className="relative ml-auto w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search items..." className="h-9 w-full rounded-full border border-white/10 bg-[#11151e] pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60" />
            </div>
          </div>

          {query.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading items...</p>
          ) : items.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {items.map((item) => {
                const rarity = rarityMeta[item.rarity];
                const canAfford = coins >= item.priceCoins;
                return (
                  <div key={item.id} className="group relative overflow-hidden rounded-xl border border-white/5 bg-[#11151e] p-3 transition hover:border-amber-400/40" style={{ boxShadow: item.equipped ? `0 0 0 1px ${rarity.glow}, 0 0 24px ${rarity.glow}` : undefined }}>
                    <div className="flex items-center justify-center py-2"><ItemArt item={item} /></div>
                    <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                    <div className="mt-0.5 flex items-center justify-between">
                      <span className={`rounded-full border px-2 text-[10px] font-semibold uppercase tracking-[0.12em] ${rarity.tone}`}>{rarity.label}</span>
                      <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{slotMeta[item.slot].label}</span>
                    </div>
                    {item.description ? <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">{item.description}</p> : null}
                    <div className="mt-3">
                      {item.owned ? (
                        item.equipped ? (
                          <button type="button" onClick={() => equipMutation.mutate({ slot: item.slot, itemId: null })} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-200 transition hover:bg-emerald-500/20">
                            <Check className="h-3.5 w-3.5" /> Equipped
                          </button>
                        ) : (
                          <button type="button" disabled={equipMutation.isPending} onClick={() => equipMutation.mutate({ slot: item.slot, itemId: item.id })} className="inline-flex w-full items-center justify-center rounded-lg bg-amber-400 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300 disabled:opacity-50">
                            Equip
                          </button>
                        )
                      ) : (
                        <button type="button" disabled={buyMutation.isPending || !canAfford} onClick={() => buyMutation.mutate(item.id)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50" title={canAfford ? "Buy" : "Not enough coins"}>
                          <Coins className="h-3.5 w-3.5" /> {item.priceCoins === 0 ? "Claim" : item.priceCoins.toLocaleString()}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`${panel} text-sm text-slate-500`}>
              {mode === "store" ? "No items match." : (
                <>Nothing here yet. Browse the <Link href="/app/store" className="text-amber-300">Store</Link> to pick up your first pieces.</>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className={panel}>
            <h2 className={`${sectionTitle} mb-3`}>Current Loadout</h2>
            <ul className="space-y-1.5">
              {(Object.keys(slotMeta) as CosmeticSlot[]).map((slot) => {
                const meta = slotMeta[slot];
                const item = loadout[slot] ? itemById.get(loadout[slot]!) : undefined;
                return (
                  <li key={slot} className="flex items-center gap-3 rounded-lg border border-white/5 bg-[#11151e] px-2.5 py-2">
                    {item ? <ItemArt item={item} size={34} /> : <span className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-dashed border-white/10 text-slate-600"><meta.icon className="h-4 w-4" /></span>}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">{meta.label}</span>
                      <span className={`block truncate text-sm ${item ? "text-white" : "text-slate-600"}`}>{item?.name ?? "Empty"}</span>
                    </span>
                    {item ? (
                      <button type="button" onClick={() => equipMutation.mutate({ slot, itemId: null })} className="text-slate-500 hover:text-rose-300" title="Unequip"><X className="h-3.5 w-3.5" /></button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] text-slate-500">Loadout saves automatically and shows on your profile and avatar.</p>
          </div>
          <div className={panel}>
            <h2 className={`${sectionTitle} mb-2`}>Earn coins</h2>
            <p className="text-sm text-slate-400">Vexora Coins come from mining rigs, jackpots and community rewards.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/app/mining" className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:border-amber-400/50">Mining</Link>
              <Link href="/app/rewards" className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:border-amber-400/50">Rewards</Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
