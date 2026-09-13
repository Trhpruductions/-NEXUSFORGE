"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Hash, Loader2, MessageSquare, Search, Users } from "lucide-react";
import { searchForges, searchMessages, searchUsers } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";

const panel = "rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4";
const sectionTitle = "nf-heading inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "VX";
}

function highlight(text: string, term: string) {
  if (!term) return text;
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-amber-400/30 px-0.5 text-amber-100">{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  );
}

export function SearchPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Loading search...</p>}>
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { accessToken } = useAuthStore();
  const selectedForgeId = useWorkspaceStore((state) => state.selectedForgeId);
  const setSelectedForgeId = useWorkspaceStore((state) => state.setSelectedForgeId);
  const initial = params?.get("q") ?? "";
  const [draft, setDraft] = useState(initial);
  const [scope, setScope] = useState<"forge" | "all">("forge");
  const term = initial.trim();

  useEffect(() => setDraft(initial), [initial]);

  const enabled = Boolean(accessToken && term.length >= 2);
  const messagesQuery = useQuery({
    queryKey: ["search-messages", term, scope, selectedForgeId, accessToken],
    queryFn: () => searchMessages(accessToken!, term, scope === "forge" ? selectedForgeId ?? undefined : undefined),
    enabled,
  });
  const usersQuery = useQuery({ queryKey: ["search-users", term, accessToken], queryFn: () => searchUsers(accessToken!, term), enabled });
  const forgesQuery = useQuery({ queryKey: ["search-forges", term, accessToken], queryFn: () => searchForges(accessToken!, term), enabled });

  const loading = messagesQuery.isLoading || usersQuery.isLoading || forgesQuery.isLoading;
  const total = (messagesQuery.data?.messages.length ?? 0) + (usersQuery.data?.users.length ?? 0) + (forgesQuery.data?.forges.length ?? 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="nf-heading text-xl font-bold text-white">Search</h1>
        <p className="text-xs text-slate-400">Messages, people and forges.</p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) router.push(`/app/search?q=${encodeURIComponent(draft.trim())}`);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Search for anything..." className="h-11 w-full rounded-full border border-white/10 bg-[#11151e] pl-10 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60" />
        </div>
        <div className="flex gap-1 rounded-xl border border-white/5 bg-[#0d1119] p-1">
          {(["forge", "all"] as const).map((entry) => (
            <button key={entry} type="button" onClick={() => setScope(entry)} className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${scope === entry ? "bg-amber-400 text-slate-950" : "text-slate-400"}`}>
              {entry === "forge" ? "This forge" : "All forges"}
            </button>
          ))}
        </div>
        <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-300">Search</button>
      </form>

      {!term ? (
        <p className={`${panel} text-sm text-slate-500`}>Type at least two characters and press Enter.</p>
      ) : loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Searching for &ldquo;{term}&rdquo;...</p>
      ) : (
        <>
          <p className="text-xs text-slate-500">{total} result{total === 1 ? "" : "s"} for &ldquo;{term}&rdquo;</p>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <section className={panel}>
              <h2 className={`${sectionTitle} mb-3`}><MessageSquare className="h-4 w-4 text-amber-300" /> Messages ({messagesQuery.data?.messages.length ?? 0})</h2>
              {messagesQuery.data?.messages.length ? (
                <ul className="space-y-1.5">
                  {messagesQuery.data.messages.map((message) => (
                    <li key={message.id}>
                      <Link
                        href={`/app/chat?forge=${message.channel.forgeId}&channel=${message.channel.id}`}
                        onClick={() => setSelectedForgeId(message.channel.forgeId)}
                        className="block rounded-xl border border-white/5 bg-[#11151e] p-3 transition hover:border-amber-400/40"
                      >
                        <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-400">
                          <span className="text-sm font-semibold text-white">{message.author?.username ?? message.botName ?? "Unknown"}</span>
                          <span className="inline-flex items-center gap-0.5 text-amber-300"><Hash className="h-3 w-3" />{message.channel.name}</span>
                          <span>{new Date(message.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-200">{highlight(message.content, term)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No messages match{scope === "forge" ? " in this forge" : ""}.</p>
              )}
            </section>

            <div className="space-y-4">
              <section className={panel}>
                <h2 className={`${sectionTitle} mb-3`}><Users className="h-4 w-4 text-amber-300" /> People ({usersQuery.data?.users.length ?? 0})</h2>
                {usersQuery.data?.users.length ? (
                  <ul className="space-y-1.5">
                    {usersQuery.data.users.map((person) => (
                      <li key={person.id}>
                        <Link href={`/app/profile?user=${person.id}`} className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#11151e] p-2.5 transition hover:border-amber-400/40">
                          {person.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={person.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-amber-100">{initials(person.username)}</span>
                          )}
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-white">{highlight(person.username, term)}</span>
                            <span className="block text-[11px] text-slate-500">{person.status.toLowerCase()}{person.clanTag ? ` · ${person.clanTag}` : ""}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No people match.</p>
                )}
              </section>

              <section className={panel}>
                <h2 className={`${sectionTitle} mb-3`}><Hash className="h-4 w-4 text-amber-300" /> Forges ({forgesQuery.data?.forges.length ?? 0})</h2>
                {forgesQuery.data?.forges.length ? (
                  <ul className="space-y-1.5">
                    {forgesQuery.data.forges.map((forge) => (
                      <li key={forge.id}>
                        <button type="button" onClick={() => { setSelectedForgeId(forge.id); router.push("/app"); }} className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-[#11151e] p-2.5 text-left transition hover:border-amber-400/40">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-700 text-xs font-bold text-slate-950">{initials(forge.name)}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-white">{highlight(forge.name, term)}</span>
                            <span className="block text-[11px] text-slate-500">/invite/{forge.inviteCode}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No forges match. Try <Link href="/app/discover" className="text-amber-300">Discover</Link>.</p>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
