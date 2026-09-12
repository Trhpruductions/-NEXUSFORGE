"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Check, Hash, Loader2, Search, Star, TrendingUp, Users } from "lucide-react";
import { getDiscover, joinForge, type DiscoverForge } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";

const panel = "rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4";
const sectionTitle = "nf-heading text-[13px] font-bold uppercase tracking-[0.18em] text-white";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "VX";
}

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function errorText(error: unknown) {
  if (axios.isAxiosError(error)) return (error.response?.data as { error?: string } | undefined)?.error ?? error.message;
  return error instanceof Error ? error.message : "Something went wrong";
}

export function DiscoverPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const setSelectedForgeId = useWorkspaceStore((state) => state.setSelectedForgeId);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const discoverQuery = useQuery({
    queryKey: ["discover", category, search, accessToken],
    queryFn: () => getDiscover(accessToken!, { category, q: search || undefined }),
    enabled: Boolean(accessToken),
  });
  const data = discoverQuery.data;

  const joinMutation = useMutation({
    mutationFn: (forge: DiscoverForge) => joinForge(accessToken!, csrfToken!, forge.inviteCode),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["forges", accessToken] });
      await queryClient.invalidateQueries({ queryKey: ["discover"] });
      setSelectedForgeId(result.forgeId);
      router.push("/app");
    },
    onError: (error) => setNotice(errorText(error)),
  });

  const ForgeCard = ({ forge, featured = false }: { forge: DiscoverForge; featured?: boolean }) => (
    <div className={`overflow-hidden rounded-xl border bg-[#11151e] transition hover:border-amber-400/50 ${featured ? "border-amber-500/30" : "border-white/5"}`}>
      <div className="relative h-24">
        {forge.banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={forge.banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(230,179,37,0.3),transparent_55%),linear-gradient(160deg,#141a26,#0b0e15)]" />
        )}
        {forge.featured ? <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-amber-400 px-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-950"><Star className="h-3 w-3" /> Featured</span> : null}
        <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-200">{forge.category}</span>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2.5">
          {forge.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={forge.icon} alt="" className="h-9 w-9 rounded-lg border border-white/10 object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-700 text-[11px] font-bold text-slate-950">{initials(forge.name)}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{forge.name}</p>
            <p className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Users className="h-3 w-3" /> {compact(forge.memberCount)} members · {forge.channelCount} channels</p>
          </div>
        </div>
        {forge.description ? <p className="mt-2 line-clamp-2 text-xs text-slate-400">{forge.description}</p> : null}
        {forge.tags.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {forge.tags.slice(0, 4).map((tag) => <span key={tag} className="rounded-full border border-white/10 px-2 text-[10px] text-slate-300">#{tag}</span>)}
          </div>
        ) : null}
        <button
          type="button"
          disabled={forge.joined || joinMutation.isPending}
          onClick={() => joinMutation.mutate(forge)}
          className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] transition ${
            forge.joined ? "border border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "bg-amber-400 text-slate-950 hover:bg-amber-300"
          } disabled:cursor-default`}
        >
          {forge.joined ? <><Check className="h-3.5 w-3.5" /> Joined</> : "Join"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="nf-heading text-xl font-bold text-white">Discover</h1>
          <p className="text-xs text-slate-400">Find your people. Join the movement.</p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(query.trim().toLowerCase());
          }}
          className="relative w-full max-w-sm"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search communities, tags..." className="h-10 w-full rounded-full border border-white/10 bg-[#11151e] pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60" />
        </form>
      </div>

      {notice ? <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{notice}</p> : null}

      <div className="flex flex-wrap gap-1.5">
        {(data?.categories ?? ["all", "gaming", "creators", "esports", "social", "new"]).map((entry) => (
          <button key={entry} type="button" onClick={() => setCategory(entry)} className={`rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${category === entry ? "bg-amber-400 text-slate-950" : "border border-white/10 text-slate-300 hover:border-amber-400/50"}`}>
            {entry}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-4">
          {discoverQuery.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Finding communities...</p>
          ) : (
            <>
              {data?.featured.length ? (
                <section className={panel}>
                  <h2 className={`${sectionTitle} mb-3`}>Featured Communities</h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.featured.map((forge) => <ForgeCard key={forge.id} forge={forge} featured />)}</div>
                </section>
              ) : null}
              {data?.recommended.length ? (
                <section className={panel}>
                  <h2 className={`${sectionTitle} mb-3`}>Recommended For You</h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.recommended.map((forge) => <ForgeCard key={forge.id} forge={forge} />)}</div>
                </section>
              ) : null}
              <section className={panel}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className={sectionTitle}>{search ? `Results for "${search}"` : category === "all" ? "All communities" : `${category} communities`}</h2>
                  <span className="text-[11px] text-slate-500">{data?.forges.length ?? 0} found</span>
                </div>
                {data?.forges.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.forges.map((forge) => <ForgeCard key={forge.id} forge={forge} />)}</div>
                ) : (
                  <p className="text-sm text-slate-500">No public communities match yet. Make your forge public from its settings to list it here.</p>
                )}
              </section>
            </>
          )}
        </div>

        <aside className={panel}>
          <h2 className={`${sectionTitle} mb-3 inline-flex items-center gap-2`}><TrendingUp className="h-4 w-4 text-amber-300" /> Popular Right Now</h2>
          {data?.popularTags.length ? (
            <ul className="space-y-1.5">
              {data.popularTags.map((entry) => (
                <li key={entry.tag}>
                  <button type="button" onClick={() => { setQuery(entry.tag); setSearch(entry.tag); }} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-white/[0.04]">
                    <span className="inline-flex items-center gap-1.5 text-slate-200"><Hash className="h-3.5 w-3.5 text-amber-300" /> {entry.tag}</span>
                    <span className="text-[11px] text-slate-500">{compact(entry.score)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Tags appear once communities add them in their forge settings.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
