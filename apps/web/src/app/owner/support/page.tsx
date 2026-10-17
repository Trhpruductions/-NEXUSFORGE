"use client";

import { OwnerCard, OwnerStat } from "@/components/owner/owner-ui";
import { OwnerFrame } from "@/components/owner/owner-frame";
import { useOwnerQuery } from "@/components/owner/use-owner-query";

type Support = { available: boolean; reason: string };

export default function OwnerSupportPage() {
  const query = useOwnerQuery<Support>("/support", { refetchMs: false });
  return (
    <OwnerFrame title="Support & reports" subtitle="Support tickets and message reports. Technical errors are shown in Logs & incidents, not here.">
      <OwnerCard title="Data source">
        <OwnerStat label="Support tickets" value={query.data?.available === false ? "Not built" : "—"} />
        <OwnerStat label="Message reports" value={query.data?.available === false ? "Not built" : "—"} />
        <p className="text-sm text-slate-400">{query.data?.reason ?? "Checking…"}</p>
      </OwnerCard>
    </OwnerFrame>
  );
}
