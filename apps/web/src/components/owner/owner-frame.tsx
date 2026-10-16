"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { OwnerSideNav } from "@/components/owner/owner-nav";

/** Layout for every owner section: owner gate, side navigation, and the shared page shell. */
export function OwnerFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { user, hydrated } = useAuthStore();
  const isOwner = user?.appRole === "OWNER";

  if (hydrated && !isOwner) {
    return (
      <ExperienceShell eyebrow="Owner Console" title="Owner access required" subtitle="This console shows platform operations and money. Only the owner account can open it.">
        <p className="text-sm text-slate-300">Sign in with the owner account to continue.</p>
      </ExperienceShell>
    );
  }

  return (
    <ExperienceShell eyebrow="Owner Console" title={title} subtitle={subtitle} maxWidthClassName="max-w-[1500px]">
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <OwnerSideNav />
        <div className="min-w-0 space-y-4">{children}</div>
      </div>
    </ExperienceShell>
  );
}

/** Shows when data was last refreshed, and warns when the latest refresh failed. */
export function Freshness({
  updatedAt,
  isError,
  isFetching,
  hasData,
  intervalSeconds,
}: {
  updatedAt: number;
  isError: boolean;
  isFetching: boolean;
  hasData: boolean;
  intervalSeconds: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const ageSeconds = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;
  const stale = isError || (ageSeconds !== null && ageSeconds > intervalSeconds * 3);

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs" role="status" aria-live="polite">
      {stale ? (
        <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-amber-100">
          {isError && hasData ? "Refresh failed: showing last good data" : isError ? "Refresh failed: no data" : "Stale data"}
          {ageSeconds !== null ? ` · last good ${ageSeconds}s ago` : ""}
        </span>
      ) : (
        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-100">
          Live · refreshes every {intervalSeconds}s{isFetching ? " · updating…" : ""}
        </span>
      )}
      {ageSeconds !== null ? <span className="text-slate-400">Last successful refresh {ageSeconds}s ago</span> : <span className="text-slate-400">Waiting for first data</span>}
    </div>
  );
}
