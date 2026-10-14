"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Megaphone } from "lucide-react";
import { listUpdates, markUpdatesSeen } from "@/lib/api";
import { LegalMarkdown } from "@/components/legal/legal-markdown";
import { useAuthStore } from "@/store/auth-store";

/** Every published "What's new" update, newest first. Opening it counts as catching up. */
export function UpdatesPage() {
  const { accessToken, csrfToken, user } = useAuthStore();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["updates", accessToken], queryFn: () => listUpdates(accessToken!), enabled: Boolean(accessToken) });

  useEffect(() => {
    if (!accessToken || !csrfToken || !query.data?.some((update) => update.unseen)) return;
    void markUpdatesSeen(accessToken, csrfToken).then(() => queryClient.setQueryData(["updates-unseen", accessToken], []));
  }, [accessToken, csrfToken, query.data, queryClient]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300"><Megaphone className="h-3.5 w-3.5" /> Nexus Forge Gaming</p>
          <h1 className="nf-heading mt-1 text-2xl font-bold text-white">What&apos;s new</h1>
          <p className="text-sm text-slate-400">New features and fixes, newest first.</p>
        </div>
        {user?.isAdmin ? <Link href="/admin/updates" className="rounded-lg border border-violet-400/40 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-500/10">Write an update</Link> : null}
      </header>
      {query.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : !query.data?.length ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-400">No updates yet.</p>
      ) : (
        query.data.map((update) => (
          <article key={update.id} className="vx-panel rounded-2xl border border-white/10 bg-[#0d1119] p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {update.version ? <span className="rounded-full border border-violet-400/40 px-2 py-0.5 text-violet-200">{update.version}</span> : null}
              <span>{update.publishedAt ? new Date(update.publishedAt).toLocaleDateString(undefined, { dateStyle: "long" }) : ""}</span>
              {update.unseen ? <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">New</span> : null}
            </div>
            <h2 className="mt-1 text-lg font-bold text-white">{update.title}</h2>
            <div className="mt-2">
              <LegalMarkdown content={update.body} />
            </div>
          </article>
        ))
      )}
    </div>
  );
}
