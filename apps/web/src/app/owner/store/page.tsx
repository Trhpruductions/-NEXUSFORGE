"use client";

import { OwnerCard, OwnerStat } from "@/components/owner/owner-ui";
import { Freshness, OwnerFrame } from "@/components/owner/owner-frame";
import { useOwnerQuery } from "@/components/owner/use-owner-query";
import { ModeToggle } from "@/components/owner/mode-toggle";
import { formatCents, formatCount } from "@/components/owner/format";
import type { OwnerMode } from "@/lib/owner-api";
import { useState } from "react";

type Store = {
  mode: OwnerMode;
  coinStore: { itemsInCatalog: number; cosmeticPurchasesAllTime: number; cosmeticPurchasesLast30d: number; note: string };
  coinPacks: { paidCount: number; grossCents: number };
  shopItemsDefined: number;
  failedPurchases: number;
  pendingPurchases: number;
  appleGoogleBilling: { status: string; note: string };
};

const REFRESH_SECONDS = 60;

export default function OwnerStorePage() {
  const [mode, setMode] = useState<OwnerMode>("live");
  const query = useOwnerQuery<Store>("/store", { params: { mode }, refetchMs: REFRESH_SECONDS * 1000 });
  const data = query.data;
  return (
    <OwnerFrame title="Store & purchases" subtitle="Cosmetic items, coin packs and purchase status. Money from paid purchases is counted in Finance.">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Freshness updatedAt={query.dataUpdatedAt} isError={query.isError} isFetching={query.isFetching} hasData={Boolean(data)} intervalSeconds={REFRESH_SECONDS} />
        <ModeToggle mode={mode} onChange={setMode} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <OwnerCard title="Coin store (in-app coins)">
          <OwnerStat label="Items in catalog" value={data ? formatCount(data.coinStore.itemsInCatalog) : "—"} />
          <OwnerStat label="Cosmetic purchases, all time" value={data ? formatCount(data.coinStore.cosmeticPurchasesAllTime) : "—"} />
          <OwnerStat label="Cosmetic purchases, 30 days" value={data ? formatCount(data.coinStore.cosmeticPurchasesLast30d) : "—"} />
          <p className="text-[11px] text-slate-500">{data?.coinStore.note}</p>
        </OwnerCard>
        <OwnerCard title="Coin packs (paid with money)">
          <OwnerStat label="Paid coin-pack purchases" value={data ? formatCount(data.coinPacks.paidCount) : "—"} />
          <OwnerStat label="Gross" value={data ? formatCents(data.coinPacks.grossCents) : "—"} />
        </OwnerCard>
        <OwnerCard title="Purchase status">
          <OwnerStat label="Failed" value={data ? formatCount(data.failedPurchases) : "—"} />
          <OwnerStat label="Pending" value={data ? formatCount(data.pendingPurchases) : "—"} />
          <OwnerStat label="Apple and Google billing" value={data?.appleGoogleBilling.status ?? "—"} hint={data?.appleGoogleBilling.note} />
        </OwnerCard>
      </div>
    </OwnerFrame>
  );
}
