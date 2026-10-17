"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Coins, Cpu, Crown, Shirt, Ticket } from "lucide-react";
import { LoadingNote } from "@/components/ui/loading-note";
import { getShopOverview, type ShopOverview } from "@/lib/shop-api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { JACKPOT_ENABLED, MINING_ENABLED } from "@/lib/held-features";
import { shownUploadBytes } from "@/lib/plan-perks";

const panel = "vx-panel rounded-2xl p-5";
const rarityTone: Record<string, string> = {
  COMMON: "border-slate-400/30 bg-slate-400/10 text-slate-300",
  RARE: "border-sky-400/35 bg-sky-400/10 text-sky-200",
  EPIC: "border-violet-400/35 bg-violet-400/10 text-violet-200",
  LEGENDARY: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  MYTHIC: "border-rose-400/40 bg-rose-400/10 text-rose-200",
};

function coinsText(amount: number) {
  return `${amount.toLocaleString()} coins`;
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/** One query for the whole shop, shared by the Shop page and the Home widget. */
export function useShopOverview() {
  const accessToken = useAuthStore((state) => state.accessToken);
  return useQuery<ShopOverview>({
    queryKey: ["shop-overview", accessToken],
    queryFn: () => getShopOverview(accessToken!),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  });
}

function SectionCard({ icon: Icon, title, blurb, href, cta, children }: { icon: typeof Shirt; title: string; blurb: string; href: string; cta: string; children: ReactNode }) {
  return (
    <section className={cn(panel, "flex flex-col gap-4")} aria-label={title}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-200">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="nf-heading text-base font-bold text-white">{title}</h2>
          <p className="text-sm text-slate-400">{blurb}</p>
        </div>
      </div>
      <div className="flex-1 space-y-2">{children}</div>
      <Link href={href} className="inline-flex items-center gap-1 self-start rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300">
        {cta} <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

function Unavailable({ what }: { what: string }) {
  return <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-400">Couldn&apos;t load {what} right now. Refresh the page to try again.</p>;
}

export function ShopHub() {
  const query = useShopOverview();

  if (query.isLoading) return <LoadingNote label="Loading the shop…" onRetry={() => void query.refetch()} />;
  if (query.isError || !query.data) {
    return (
      <div className={cn(panel, "text-sm text-slate-300")}>
        <p>The shop couldn&apos;t load.</p>
        <button type="button" onClick={() => void query.refetch()} className="mt-3 rounded-lg border border-white/15 px-3 py-2 text-sm text-white hover:border-amber-400/60">
          Try again
        </button>
      </div>
    );
  }

  const shop = query.data;
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="nf-heading text-xl font-bold text-white">Shop</h1>
          <p className="text-xs text-slate-400">Everything you can buy in Nexus Forge Gaming, with prices shown before you spend anything.</p>
        </div>
        {shop.coins !== null ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-sm font-semibold text-amber-100">
            <Coins className="h-4 w-4" /> {coinsText(shop.coins)}
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard icon={Shirt} title="Outfits & emotes" blurb="Clothing, accessories and emotes for your avatar." href="/app/store" cta="Browse outfits">
          {shop.cosmetics ? (
            <>
              <p className="text-sm text-slate-300">
                You own {shop.cosmetics.owned} of {shop.cosmetics.total} items
                {shop.cosmetics.cheapest !== null ? <span className="text-slate-500"> · from {coinsText(shop.cosmetics.cheapest)}</span> : null}
              </p>
              <ul className="space-y-1.5">
                {shop.cosmetics.featured.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-full border border-white/20" style={{ background: item.color ?? "#334155" }} />
                      <span className="truncate text-white">{item.name}</span>
                      <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold", rarityTone[item.rarity] ?? rarityTone.COMMON)}>{titleCase(item.rarity)}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-amber-200">{item.priceCoins.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Unavailable what="outfits" />
          )}
        </SectionCard>

        <SectionCard icon={Crown} title="Core+ membership" blurb="Bigger uploads, more servers and extra profile perks." href="/pricing" cta="Compare plans">
          {shop.plans ? (
            <>
              {!shop.plans.enforced ? (
                <p className="rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-sm text-sky-100">Plans aren&apos;t on sale yet. You can see what each one includes.</p>
              ) : null}
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {shop.plans.tiers.map((plan) => (
                  <li key={plan.tier} className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-sm">
                    <span className="font-semibold text-white">{plan.label}</span>
                    <span className="block text-xs text-slate-400">
                      Up to {plan.maxServers} servers · {Math.round(shownUploadBytes(plan) / (1024 * 1024))} MB uploads
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Unavailable what="plans" />
          )}
        </SectionCard>

        {MINING_ENABLED && (
          <SectionCard icon={Cpu} title="Mining rigs" blurb="Earn coins over time with a rig of your own." href="/app/mining" cta="Open mining">
            {shop.rigs ? (
              <ul className="space-y-1.5">
                {shop.rigs.map((rig) => (
                  <li key={rig.tier} className="flex items-center justify-between rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-sm">
                    <span className="text-white">{titleCase(rig.tier)}</span>
                    <span className="text-xs text-slate-400">{rig.hashRate} H/s · <span className="font-semibold text-amber-200">{rig.cost.toLocaleString()} coins</span></span>
                  </li>
                ))}
              </ul>
            ) : (
              <Unavailable what="mining rigs" />
            )}
          </SectionCard>
        )}

        {JACKPOT_ENABLED && (
          <SectionCard icon={Ticket} title="Hourly jackpot" blurb="Buy tickets for the hourly draw. Every draw can be checked." href="/app/rewards" cta="Join the jackpot">
            {shop.jackpot ? (
              <p className="text-sm text-slate-300">
                {shop.jackpot.myTickets} ticket{shop.jackpot.myTickets === 1 ? "" : "s"} in this round · {shop.jackpot.playerCount} player{shop.jackpot.playerCount === 1 ? "" : "s"} entered
              </p>
            ) : (
              <Unavailable what="the jackpot" />
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}

/** Compact Shop card for the Home screen, with the same live data as the Shop page. */
export function ShopWidget() {
  const query = useShopOverview();
  const shop = query.data;

  const rows: Array<{ label: string; detail: string; href: string; icon: typeof Shirt }> = [
    {
      label: "Outfits & emotes",
      detail: shop?.cosmetics ? (shop.cosmetics.cheapest !== null ? `From ${coinsText(shop.cosmetics.cheapest)}` : "Everything owned") : "Unavailable",
      href: "/app/store",
      icon: Shirt,
    },
    {
      label: "Core+ membership",
      detail: shop?.plans ? (shop.plans.enforced ? `${shop.plans.tiers.length} plans` : "Not on sale yet") : "Unavailable",
      href: "/pricing",
      icon: Crown,
    },
    ...(MINING_ENABLED
      ? [
          {
            label: "Mining rigs",
            detail: shop?.rigs?.length ? `From ${coinsText(Math.min(...shop.rigs.map((rig) => rig.cost)))}` : "Unavailable",
            href: "/app/mining",
            icon: Cpu,
          },
        ]
      : []),
    ...(JACKPOT_ENABLED
      ? [
          {
            label: "Hourly jackpot",
            detail: shop?.jackpot ? `${shop.jackpot.myTickets} ticket${shop.jackpot.myTickets === 1 ? "" : "s"} held` : "Unavailable",
            href: "/app/rewards",
            icon: Ticket,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-3">
      {shop?.coins !== null && shop?.coins !== undefined ? (
        <p className="flex items-center gap-2 text-sm text-amber-100">
          <Coins className="h-4 w-4" /> {coinsText(shop.coins)} to spend
        </p>
      ) : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.label}>
            <Link href={row.href} className="group flex items-center gap-3 rounded-lg border border-white/5 bg-[#11151e]/80 px-3 py-2 text-sm text-slate-200 hover:border-amber-400/40">
              <row.icon className="h-4 w-4 shrink-0 text-amber-200" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-white">{row.label}</span>
                <span className="block truncate text-xs text-slate-400">{query.isLoading ? "Loading…" : row.detail}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-amber-200" />
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/app/shop" className="inline-flex items-center gap-1 text-sm font-semibold text-amber-200 hover:text-amber-100">
        See the full shop <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
