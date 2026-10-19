"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Hash, Loader2, MessageSquare, Search, Users } from "lucide-react";
import { searchForges, searchMessages, searchUsers } from "@/lib/api";
import { useAuthStore, useQueryScope } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { plainText } from "@/lib/plain-text";

const panel = "vx-panel rounded-2xl p-4";
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
  const queryScope = useQueryScope();
  const selectedForgeId = useWorkspaceStore((state) => state.selectedForgeId);
  const setSelectedForgeId = useWorkspaceStore((state) => state.setSelectedForgeId);
  const initial = params?.get("q") ?? "";
  const [draft, setDraft] = useState(initial);
  const [scope, setScope] = useState<"forge" | "all">("forge");
  const term = initial.trim();
  // People and forges are searched by the words only, without from:/in:/has: filters.
  const words = term.replace(/\b\w+:("[^"]*"|\S+)/g, "").replace(/\s+/g, " ").trim();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const addFilter = (prefix: string) => {
    setDraft((current) => `${current.trim()} ${prefix}`.trimStart());
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  useEffect(() => setDraft(initial), [initial]);

  const enabled = Boolean(accessToken && term.length >= 2);
  const messagesQuery = useQuery({
    queryKey: ["search-messages", term, scope, selectedForgeId, queryScope],
    queryFn: () => searchMessages(accessToken!, term, scope === "forge" ? selectedForgeId ?? undefined : undefined),
    enabled,
  });
  const usersQuery = useQuery({ queryKey: ["search-users", words, queryScope], queryFn: () => searchUsers(accessToken!, words), enabled: enabled && words.length >= 2 });
  const forgesQuery = useQuery({ queryKey: ["search-forges", words, queryScope], queryFn: () => searchForges(accessToken!, words), enabled: enabled && words.length >= 2 });
  const filters = messagesQuery.data?.filters;
  const activeChips = filters
    ? [
        ...filters.from.map((value) => ({ label: `from: ${value}`, color: "text-pink-200 border-pink-400/40 bg-pink-500/10" })),
        ...filters.in.map((value) => ({ label: `in: #${value}`, color: "text-sky-200 border-sky-400/40 bg-sky-500/10" })),
        ...filters.has.map((value) => ({ label: `has: ${value}`, color: "text-emerald-200 border-emerald-400/40 bg-emerald-500/10" })),
        ...filters.mentions.map((value) => ({ label: `mentions: @${value}`, color: "text-violet-200 border-violet-400/40 bg-violet-500/10" })),
        ...(filters.after ? [{ label: `after: ${filters.after.slice(0, 10)}`, color: "text-orange-200 border-orange-400/40 bg-orange-500/10" }] : []),
        ...(filters.before ? [{ label: `before: ${filters.before.slice(0, 10)}`, color: "text-orange-200 border-orange-400/40 bg-orange-500/10" }] : []),
        ...(filters.pinned !== null ? [{ label: filters.pinned ? "pinned" : "not pinned", color: "text-amber-200 border-amber-400/40 bg-amber-500/10" }] : []),
      ]
    : [];

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
          <input ref={inputRef} autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Search for anything..." className="h-11 w-full rounded-full border border-white/10 bg-[#11151e] pl-10 pr-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60" />
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

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-slate-500">Filters:</span>
        {[
          { prefix: "from:", hint: "username", color: "hover:border-pink-400/50 hover:text-pink-200" },
          { prefix: "in:", hint: "channel", color: "hover:border-sky-400/50 hover:text-sky-200" },
          { prefix: "has:", hint: "link · file · image · video", color: "hover:border-emerald-400/50 hover:text-emerald-200" },
          { prefix: "mentions:", hint: "username", color: "hover:border-violet-400/50 hover:text-violet-200" },
          { prefix: "before:", hint: "YYYY-MM-DD", color: "hover:border-orange-400/50 hover:text-orange-200" },
          { prefix: "after:", hint: "YYYY-MM-DD", color: "hover:border-orange-400/50 hover:text-orange-200" },
          { prefix: "pinned:true", hint: "", color: "hover:border-amber-400/50 hover:text-amber-200" },
        ].map((entry) => (
          <button key={entry.prefix} type="button" onClick={() => addFilter(entry.prefix)} title={entry.hint || undefined} className={`rounded-full border border-white/10 px-2.5 py-1 text-slate-300 transition ${entry.color}`}>
            {entry.prefix}{entry.hint ? <span className="ml-1 text-slate-500">{entry.hint}</span> : null}
          </button>
        ))}
      </div>

      {!term ? (
        <p className={`${panel} text-sm text-slate-500`}>Type at least two characters and press Enter.</p>
      ) : loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Searching for &ldquo;{term}&rdquo;...</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span>{total} result{total === 1 ? "" : "s"}{filters?.text ? <> for &ldquo;{filters.text}&rdquo;</> : null}</span>
            {activeChips.map((chip) => (
              <span key={chip.label} className={`rounded-full border px-2 py-0.5 text-[11px] ${chip.color}`}>{chip.label}</span>
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <section className={panel}>
              <h2 className={`${sectionTitle} mb-3`}><MessageSquare className="h-4 w-4 vx-accent" /> Messages ({messagesQuery.data?.messages.length ?? 0})</h2>
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
                        <p className="mt-1 line-clamp-2 text-sm text-slate-200">{highlight(plainText(message.content), filters?.text || words)}</p>
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
                <h2 className={`${sectionTitle} mb-3`}><Users className="h-4 w-4 vx-accent" /> People ({usersQuery.data?.users.length ?? 0})</h2>
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
                <h2 className={`${sectionTitle} mb-3`}><Hash className="h-4 w-4 vx-accent" /> Forges ({forgesQuery.data?.forges.length ?? 0})</h2>
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
