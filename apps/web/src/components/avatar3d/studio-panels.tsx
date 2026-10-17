"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage, getCosmeticInventory, setLoadoutSlot, type AvatarPreset, type CosmeticItem, type CosmeticSlot, type User } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { ALL_PART_OPTIONS, type RecentPick } from "@/components/avatar3d/studio-model";
import type { PartCategory } from "@/components/avatar3d/design";
import { isEmoteId, type EmoteId } from "@/components/avatar3d/emote-poses";
import { chip } from "@/components/avatar3d/avatar-builder-parts";

const RARITY_LABEL: Record<CosmeticItem["rarity"], string> = { COMMON: "Common", RARE: "Rare", EPIC: "Epic", LEGENDARY: "Legendary", MYTHIC: "Mythic" };

/** The part of the design a catalog item would wear, if it is one of the studio's parts. */
export function partForItem(item: Pick<CosmeticItem, "key">): { category: PartCategory; id: string; label: string } | null {
  const match = ALL_PART_OPTIONS.find((entry) => entry.option.catalogKey === item.key);
  return match ? { category: match.category, id: match.option.id, label: match.option.label } : null;
}

/** The account's owned catalog items, from the server. Nothing here is hardcoded. */
function useOwnedItems() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const query = useQuery({
    queryKey: ["avatar-inventory", accessToken],
    queryFn: () => getCosmeticInventory(accessToken!),
    enabled: Boolean(accessToken),
  });
  return { query, items: query.data?.items ?? [], loadout: query.data?.loadout ?? {} };
}

export const INVENTORY_TABS: ReadonlyArray<{ id: "all" | "tops" | "bottoms" | "shoes" | "accessories" | "emotes"; label: string; slots: readonly CosmeticSlot[] }> = [
  { id: "all", label: "All", slots: ["HEAD", "FACE", "TOP", "BOTTOM", "SHOES", "BACK", "ACCESSORY", "EMOTE"] },
  { id: "tops", label: "Tops", slots: ["TOP"] },
  { id: "bottoms", label: "Bottoms", slots: ["BOTTOM"] },
  { id: "shoes", label: "Shoes", slots: ["SHOES"] },
  { id: "accessories", label: "Accessories", slots: ["HEAD", "FACE", "BACK", "ACCESSORY"] },
  { id: "emotes", label: "Emotes", slots: ["EMOTE"] },
];

/** Owned items, filterable by slot. Wearable items can be worn in the draft; nothing here saves on its own. */
export function OwnedInventory({ onWear }: { onWear: (pick: RecentPick) => void }) {
  const { query, items } = useOwnedItems();
  const [tab, setTab] = useState<(typeof INVENTORY_TABS)[number]["id"]>("all");
  const slots = INVENTORY_TABS.find((entry) => entry.id === tab)!.slots;
  const visible = items.filter((item) => slots.includes(item.slot));

  return (
    <section aria-labelledby="owned-inventory-heading" className="vx-panel space-y-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="owned-inventory-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Owned inventory</h2>
        <Link href="/app/wardrobe" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200 hover:text-amber-100">View all</Link>
      </div>
      <div role="group" aria-label="Inventory type" className="flex flex-wrap gap-1.5">
        {INVENTORY_TABS.map((entry) => (
          <button key={entry.id} type="button" aria-pressed={tab === entry.id} onClick={() => setTab(entry.id)} className={chip(tab === entry.id)}>{entry.label}</button>
        ))}
      </div>
      {query.isLoading ? <p className="text-[11px] text-slate-500">Loading your items…</p> : null}
      {query.isError ? <p role="alert" className="text-[11px] text-rose-200">Your inventory could not be loaded. {getApiErrorMessage(query.error)}</p> : null}
      {!query.isLoading && !query.isError && visible.length === 0 ? (
        <p className="text-[11px] text-slate-500">
          You do not own any items in this group yet. Free parts are always available in the categories above; paid items are sold in the <Link href="/app/wardrobe" className="text-amber-200 underline">Wardrobe</Link>.
        </p>
      ) : null}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {visible.map((item) => {
          const part = partForItem(item);
          return (
            <li key={item.id} className="rounded-xl border border-white/10 bg-[#0d1119] p-2.5">
              <p className="truncate text-xs font-semibold text-white" title={item.name}>{item.name}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{RARITY_LABEL[item.rarity]}</p>
              {part ? (
                <button type="button" onClick={() => onWear({ category: part.category, id: part.id, label: part.label })} className={`${chip(false)} mt-2 w-full`}>Wear</button>
              ) : item.slot === "EMOTE" ? (
                <p className="mt-2 text-[10px] text-slate-500">Equip in Emotes</p>
              ) : (
                <p className="mt-2 text-[10px] text-slate-500">Owned, not a studio part yet</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Owned emotes, equipped to the account's loadout. Equipping saves to the server straight away, like the Wardrobe.
 * Preview plays an emote on the figure above, without changing what is equipped.
 */
export function EmotePanel({ onPreview }: { onPreview?: (id: EmoteId) => void }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const csrfToken = useAuthStore((state) => state.csrfToken);
  const queryClient = useQueryClient();
  const { query, items, loadout } = useOwnedItems();
  const emotes = items.filter((item) => item.slot === "EMOTE");
  const equipped = loadout.EMOTE ?? null;
  const equip = useMutation({
    mutationFn: (itemId: string | null) => {
      if (!accessToken || !csrfToken) throw new Error("Sign in to change your emote.");
      return setLoadoutSlot(accessToken, csrfToken, "EMOTE", itemId);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["avatar-inventory"] }),
  });

  return (
    <section aria-labelledby="emotes-heading" className="space-y-3">
      <h2 id="emotes-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Emotes</h2>
      <p className="text-[11px] leading-relaxed text-slate-500">An emote is worn on your profile and in voice rooms. Choose one you own, or none. Preview plays it on the figure above.</p>
      {query.isLoading ? <p className="text-[11px] text-slate-500">Loading your emotes…</p> : null}
      {!query.isLoading && emotes.length === 0 ? (
        <p className="text-[11px] text-slate-500">You do not own any emotes yet. Browse them in the <Link href="/app/wardrobe" className="text-amber-200 underline">Wardrobe</Link>.</p>
      ) : null}
      <ul className="grid gap-2">
        {emotes.map((item) => {
          const on = equipped === item.id;
          return (
            <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0d1119] p-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">{item.name}</span>
                <span className="block text-[10px] uppercase tracking-[0.14em] text-slate-400">{RARITY_LABEL[item.rarity]}{on ? " · Equipped" : ""}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {onPreview && isEmoteId(item.key) ? (
                  <button type="button" onClick={() => onPreview(item.key as EmoteId)} className={chip(false)} aria-label={`Preview ${item.name} on the figure`}>
                    Preview
                  </button>
                ) : null}
                <button type="button" aria-pressed={on} disabled={equip.isPending} onClick={() => equip.mutate(on ? null : item.id)} className={chip(on)}>
                  {on ? "Unequip" : "Equip"}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {equip.isError ? <p role="alert" className="text-[11px] text-rose-200">{getApiErrorMessage(equip.error)}</p> : null}
    </section>
  );
}

/** Where the person is, from the real account. No levels, friend counts or badges are shown until those exist. */
export function ProfileCard({ user }: { user: User | null }) {
  const name = user?.displayName || user?.username || "Your account";
  const online = user?.status === "ONLINE";
  const presence = !user ? "" : user.status === "ONLINE" ? "Online" : user.status === "IDLE" ? "Idle" : user.status === "DND" ? "Do not disturb" : "Offline";
  return (
    <section aria-labelledby="profile-preview-heading" className="vx-panel rounded-2xl p-4">
      <h2 id="profile-preview-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Profile preview</h2>
      <div className="mt-3 flex items-start gap-3">
        {user?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar} alt="" className="h-14 w-14 shrink-0 rounded-full border border-white/10 object-cover" />
        ) : (
          <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#11151e] text-lg font-bold text-slate-200">{name.slice(0, 1).toUpperCase()}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{name}</p>
          {user ? <p className="truncate text-[11px] text-slate-400">@{user.username}</p> : null}
          {user ? (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-300">
              <span aria-hidden className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400" : "bg-slate-500"}`} />
              {presence}
            </p>
          ) : null}
        </div>
      </div>
      {user?.bio ? <p className="mt-3 line-clamp-3 text-[11px] leading-relaxed text-slate-400">{user.bio}</p> : null}
      <Link href="/app/profile" className="mt-3 inline-flex text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200 hover:text-amber-100">Open your profile</Link>
    </section>
  );
}

/** The last few parts worn in this session. Choosing one wears it again in the draft. */
export function RecentlyUsed({ recent, onWear }: { recent: readonly RecentPick[]; onWear: (pick: RecentPick) => void }) {
  return (
    <section aria-labelledby="recently-used-heading" className="vx-panel rounded-2xl p-4">
      <h2 id="recently-used-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Recently used</h2>
      {recent.length === 0 ? (
        <p className="mt-2 text-[11px] text-slate-500">Parts you wear in this session appear here.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {recent.map((pick) => (
            <li key={`${pick.category}:${pick.id}`}>
              <button type="button" onClick={() => onWear(pick)} className={chip(false)}>{pick.label}</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Saved looks: how many slots are used, and the first few by name. The full list is on the Saved outfits page. */
export function SavedOutfitsSummary({ looks, maxLooks, mainId }: { looks: readonly AvatarPreset[]; maxLooks: number; mainId: string | null }) {
  return (
    <section aria-labelledby="saved-outfits-heading" className="vx-panel rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="saved-outfits-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Saved outfits</h2>
        <p className="text-[11px] text-slate-400">{looks.length} of {maxLooks} used</p>
      </div>
      {looks.length === 0 ? (
        <p className="mt-2 text-[11px] text-slate-500">Nothing saved yet. Build a look, then press Save avatar.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {looks.slice(0, 5).map((look) => (
            <li key={look.id}>
              <Link href={`/app/avatars/${look.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-2.5 py-2 text-xs text-slate-100 hover:border-amber-400/40">
                <span className="truncate">{look.name}</span>
                {mainId === look.id ? <span className="shrink-0 rounded-full border border-emerald-400/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-emerald-200">Worn</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/app/avatars" className="mt-3 inline-flex text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200 hover:text-amber-100">All saved outfits</Link>
    </section>
  );
}

/** The ownership key shown above the item grids. Only states the data really has are listed. */
export function OwnershipLegend() {
  const items: Array<{ label: string; dot: string }> = [
    { label: "Free", dot: "bg-sky-400" },
    { label: "Owned", dot: "bg-emerald-400" },
    { label: "Locked", dot: "bg-amber-400" },
  ];
  return (
    <ul aria-label="Ownership key" className="flex flex-wrap gap-3 text-[11px] text-slate-300">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden className={`h-2 w-2 rounded-full ${item.dot}`} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
