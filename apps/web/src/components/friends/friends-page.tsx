"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, MessageSquare, Search, UserMinus, UserPlus, Users, X, Eye } from "lucide-react";
import { getApiErrorMessage, listFriends, removeFriend, searchUsers, sendFriendRequest, updateFriendStatus, type Friendship } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

type Tab = "online" | "all" | "pending" | "add";

const panel = "rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4";
const goldBtn = "inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-950 transition hover:bg-amber-300 disabled:opacity-50";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200 transition hover:border-amber-400/50 disabled:opacity-50";

const statusMeta: Record<string, { dot: string; label: string }> = {
  ONLINE: { dot: "bg-emerald-400", label: "Online" },
  IDLE: { dot: "bg-yellow-300", label: "Idle" },
  DND: { dot: "bg-rose-400", label: "Do not disturb" },
  OFFLINE: { dot: "bg-slate-600", label: "Offline" },
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "VX";
}

function Avatar({ src, name, size = 44 }: { src?: string | null; name: string; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" style={{ width: size, height: size }} className="rounded-full border border-amber-500/30 object-cover" />
  ) : (
    <span style={{ width: size, height: size }} className="flex items-center justify-center rounded-full border border-amber-500/30 bg-gradient-to-br from-slate-800 to-slate-900 text-xs font-bold text-amber-100">{initials(name)}</span>
  );
}

export function FriendsPage() {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken, user } = useAuthStore();
  const [tab, setTab] = useState<Tab>("online");
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const friendsQuery = useQuery({
    queryKey: ["friends", accessToken],
    queryFn: () => listFriends(accessToken!),
    enabled: Boolean(accessToken),
    refetchInterval: 30_000,
  });
  const searchQuery = useQuery({
    queryKey: ["user-search", query, accessToken],
    queryFn: () => searchUsers(accessToken!, query),
    enabled: Boolean(accessToken && tab === "add" && query.trim().length >= 2),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["friends"] });
  const requestMutation = useMutation({
    mutationFn: (userId: string) => sendFriendRequest(accessToken!, csrfToken!, userId),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Friend request sent." });
      await invalidate();
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const statusMutation = useMutation({
    mutationFn: (input: { id: string; status: "ACCEPTED" | "BLOCKED" }) => updateFriendStatus(accessToken!, csrfToken!, input.id, input.status),
    onSuccess: invalidate,
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => removeFriend(accessToken!, csrfToken!, id),
    onSuccess: invalidate,
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });

  const rows = useMemo(() => {
    const list = friendsQuery.data?.friends ?? [];
    return list.map((friendship) => {
      const other = friendship.senderId === user?.id ? friendship.receiver : friendship.sender;
      const incoming = friendship.status === "PENDING" && friendship.receiverId === user?.id;
      const outgoing = friendship.status === "PENDING" && friendship.senderId === user?.id;
      return { friendship, other, incoming, outgoing };
    });
  }, [friendsQuery.data, user?.id]);

  const accepted = rows.filter((row) => row.friendship.status === "ACCEPTED");
  const online = accepted.filter((row) => row.other.status !== "OFFLINE");
  const pending = rows.filter((row) => row.friendship.status === "PENDING");
  const term = filter.trim().toLowerCase();
  const visible = (tab === "online" ? online : accepted).filter((row) => !term || row.other.username.toLowerCase().includes(term));
  const friendIds = new Set(rows.map((row) => row.other.id));

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "online", label: "Online", count: online.length },
    { id: "all", label: "All", count: accepted.length },
    { id: "pending", label: "Pending", count: pending.length },
    { id: "add", label: "Add friend" },
  ];

  const FriendCard = ({ row }: { row: (typeof rows)[number] }) => {
    const meta = statusMeta[row.other.status] ?? statusMeta.OFFLINE;
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#11151e] p-3 transition hover:border-amber-400/40">
        <span className="relative shrink-0">
          <Avatar src={row.other.avatar} name={row.other.username} />
          <span className={cn("absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#11151e]", meta.dot)} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{row.other.username}</p>
          <p className="truncate text-[11px] text-slate-400">{row.other.game ? `Playing ${row.other.game}` : meta.label}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link href={`/app/chat?dm=user:${row.other.id}`} className={goldBtn} title="Message"><MessageSquare className="h-3.5 w-3.5" /><span className="hidden sm:inline">Message</span></Link>
          <Link href={`/app/profile?user=${row.other.id}`} className={ghostBtn} title="View profile"><Eye className="h-3.5 w-3.5" /></Link>
          <button type="button" onClick={() => window.confirm(`Remove ${row.other.username} from your friends?`) && removeMutation.mutate(row.friendship.id)} className="rounded-lg border border-white/10 p-1.5 text-slate-500 hover:border-rose-400/50 hover:text-rose-300" title="Remove friend"><UserMinus className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="nf-heading text-xl font-bold text-white">Friends</h1>
          <p className="text-xs text-slate-400">People you keep in reach. {online.length} online now.</p>
        </div>
        <button type="button" onClick={() => setTab("add")} className={goldBtn}><UserPlus className="h-3.5 w-3.5" /> Add friend</button>
      </div>

      {notice ? (
        <div className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${notice.tone === "ok" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-rose-400/30 bg-rose-500/10 text-rose-100"}`}>
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} title="Dismiss"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-xl border border-white/5 bg-[#0d1119] p-1">
              {tabs.map((entry) => (
                <button key={entry.id} type="button" onClick={() => setTab(entry.id)} className={cn("rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition", tab === entry.id ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white")}>
                  {entry.label}
                  {entry.count ? <span className={cn("ml-1.5 rounded-full px-1.5 text-[9px]", tab === entry.id ? "bg-slate-950/20" : entry.id === "pending" ? "bg-rose-500 text-white" : "bg-white/10")}>{entry.count}</span> : null}
                </button>
              ))}
            </div>
            {tab === "online" || tab === "all" ? (
              <div className="relative ml-auto w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter friends" className="h-9 w-full rounded-full border border-white/10 bg-[#11151e] pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60" />
              </div>
            ) : null}
          </div>

          {friendsQuery.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading friends...</p>
          ) : tab === "online" || tab === "all" ? (
            visible.length ? (
              <div className="grid gap-2 md:grid-cols-2">{visible.map((row) => <FriendCard key={row.friendship.id} row={row} />)}</div>
            ) : (
              <div className={`${panel} text-sm text-slate-500`}>{tab === "online" ? "No friends online right now." : "No friends yet. Add someone to get started."}</div>
            )
          ) : tab === "pending" ? (
            pending.length ? (
              <div className="space-y-2">
                {pending.map((row) => (
                  <div key={row.friendship.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#11151e] p-3">
                    <Avatar src={row.other.avatar} name={row.other.username} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{row.other.username}</p>
                      <p className="text-[11px] text-slate-400">{row.incoming ? "Sent you a friend request" : "Waiting for them to accept"}</p>
                    </div>
                    {row.incoming ? (
                      <>
                        <button type="button" className={goldBtn} disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: row.friendship.id, status: "ACCEPTED" })}><Check className="h-3.5 w-3.5" /> Accept</button>
                        <button type="button" className={ghostBtn} disabled={removeMutation.isPending} onClick={() => removeMutation.mutate(row.friendship.id)}><X className="h-3.5 w-3.5" /> Ignore</button>
                      </>
                    ) : (
                      <button type="button" className={ghostBtn} disabled={removeMutation.isPending} onClick={() => removeMutation.mutate(row.friendship.id)}>Cancel</button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={`${panel} text-sm text-slate-500`}>No pending requests.</div>
            )
          ) : (
            <div className={`${panel} space-y-3`}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by username" className="h-10 w-full rounded-full border border-white/10 bg-[#11151e] pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60" />
              </div>
              {query.trim().length < 2 ? (
                <p className="text-xs text-slate-500">Type at least two characters.</p>
              ) : searchQuery.isLoading ? (
                <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Searching...</p>
              ) : searchQuery.data?.users.length ? (
                <ul className="space-y-1.5">
                  {searchQuery.data.users.filter((entry) => entry.id !== user?.id).map((entry) => {
                    const meta = statusMeta[entry.status] ?? statusMeta.OFFLINE;
                    const already = friendIds.has(entry.id);
                    return (
                      <li key={entry.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#11151e] p-2.5">
                        <span className="relative">
                          <Avatar src={entry.avatar} name={entry.username} size={36} />
                          <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#11151e]", meta.dot)} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white">{entry.username}{entry.clanTag ? <span className="ml-1.5 text-[10px] uppercase tracking-[0.12em] text-amber-300">{entry.clanTag}</span> : null}</span>
                          <span className="block text-[11px] text-slate-500">{meta.label}</span>
                        </span>
                        <Link href={`/app/profile?user=${entry.id}`} className={ghostBtn}><Eye className="h-3.5 w-3.5" /></Link>
                        <button type="button" className={goldBtn} disabled={already || requestMutation.isPending} onClick={() => requestMutation.mutate(entry.id)}>
                          {already ? <><Check className="h-3.5 w-3.5" /> Added</> : <><UserPlus className="h-3.5 w-3.5" /> Add</>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No players match.</p>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className={panel}>
            <h2 className="nf-heading mb-3 inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white"><Users className="h-4 w-4 text-amber-300" /> Squad status</h2>
            <dl className="space-y-2 text-xs">
              {[
                ["Online", online.length],
                ["Friends", accepted.length],
                ["Requests", pending.filter((row) => row.incoming).length],
                ["Sent", pending.filter((row) => row.outgoing).length],
              ].map(([label, value]) => (
                <div key={label as string} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-slate-200">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className={panel}>
            <h2 className="nf-heading mb-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white">Find your people</h2>
            <p className="text-sm text-slate-400">Browse public communities and follow creators from Discover.</p>
            <Link href="/app/discover" className={`${ghostBtn} mt-3`}>Open Discover</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
