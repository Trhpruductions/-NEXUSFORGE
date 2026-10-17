"use client";

import { OwnerCard, OwnerStat } from "@/components/owner/owner-ui";
import { OwnerFrame } from "@/components/owner/owner-frame";
import { useOwnerQuery } from "@/components/owner/use-owner-query";

type Release = {
  appVersion: string | null;
  legal: { termsVersion: string | null; privacyVersion: string | null; note: string };
  deployment: { status: string; note: string };
};

export default function OwnerReleasePage() {
  const query = useOwnerQuery<Release>("/release", { refetchMs: false });
  const data = query.data;
  return (
    <OwnerFrame title="Releases & legal" subtitle="Application version and legal document versions. Nothing is published or deployed from this console.">
      <div className="grid gap-4 md:grid-cols-2">
        <OwnerCard title="Release">
          <OwnerStat label="Application version" value={data?.appVersion ?? "Not reported"} />
          <OwnerStat label="Deployment" value={data?.deployment.status ?? "—"} hint={data?.deployment.note} />
        </OwnerCard>
        <OwnerCard title="Legal">
          <OwnerStat label="Terms version" value={data?.legal.termsVersion ?? "Not recorded"} />
          <OwnerStat label="Privacy version" value={data?.legal.privacyVersion ?? "Not recorded"} />
          <p className="text-[11px] text-slate-500">{data?.legal.note}</p>
        </OwnerCard>
      </div>
    </OwnerFrame>
  );
}
