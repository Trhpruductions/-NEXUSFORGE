"use client";

import { OwnerCard, OwnerStat } from "@/components/owner/owner-ui";
import { Freshness, OwnerFrame } from "@/components/owner/owner-frame";
import { useOwnerQuery } from "@/components/owner/use-owner-query";
import { formatCount } from "@/components/owner/format";

type Developer = {
  apiKeys: { total: number; enabled: number; note: string };
  webhooks: { total: number; enabled: number; note: string };
  botApps: { total: number; public: number };
  oauthClients: string;
  stripeWebhookFailures: number;
};

const REFRESH_SECONDS = 60;

export default function OwnerDeveloperPage() {
  const query = useOwnerQuery<Developer>("/developer", { refetchMs: REFRESH_SECONDS * 1000 });
  const data = query.data;
  return (
    <OwnerFrame title="Developer platform" subtitle="Developer keys, webhooks and bot apps. Key values, hashes and signing secrets are never shown.">
      <Freshness updatedAt={query.dataUpdatedAt} isError={query.isError} isFetching={query.isFetching} hasData={Boolean(data)} intervalSeconds={REFRESH_SECONDS} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <OwnerCard title="API keys">
          <OwnerStat label="Total" value={data ? formatCount(data.apiKeys.total) : "—"} />
          <OwnerStat label="Enabled" value={data ? formatCount(data.apiKeys.enabled) : "—"} />
          <p className="text-[11px] text-slate-500">{data?.apiKeys.note}</p>
        </OwnerCard>
        <OwnerCard title="Developer webhooks">
          <OwnerStat label="Total" value={data ? formatCount(data.webhooks.total) : "—"} />
          <OwnerStat label="Enabled" value={data ? formatCount(data.webhooks.enabled) : "—"} />
          <p className="text-[11px] text-slate-500">{data?.webhooks.note}</p>
        </OwnerCard>
        <OwnerCard title="Bot apps">
          <OwnerStat label="Total" value={data ? formatCount(data.botApps.total) : "—"} />
          <OwnerStat label="Public" value={data ? formatCount(data.botApps.public) : "—"} />
        </OwnerCard>
      </div>
      <p className="text-xs text-slate-400">{data?.oauthClients}</p>
    </OwnerFrame>
  );
}
