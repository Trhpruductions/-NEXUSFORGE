"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronRight, Globe, Loader2, RefreshCcw, Server, Trash2 } from "lucide-react";
import { getApiErrorMessage, listErrorEvents, resolveErrorEvent, type ErrorEventRow } from "@/lib/api";
import { useAuthStore, useQueryScope } from "@/store/auth-store";

function ago(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Staff: grouped crashes and server errors, newest first. "Fixed" removes a group; it returns if it happens again. */
export function ErrorLogAdmin() {
  const { accessToken, csrfToken } = useAuthStore();
  const queryScope = useQueryScope();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "server" | "web">("all");
  const [notice, setNotice] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["error-log", queryScope], queryFn: () => listErrorEvents(accessToken!), enabled: Boolean(accessToken), refetchInterval: 60_000 });

  const resolve = useMutation({
    mutationFn: (id?: string) => resolveErrorEvent(accessToken!, csrfToken!, id),
    onSuccess: async () => {
      setNotice(null);
      await queryClient.invalidateQueries({ queryKey: ["error-log"] });
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const rows = (query.data?.errors ?? []).filter((row) => filter === "all" || row.source === filter);
  const filterBtn = (value: typeof filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(value)}
      aria-pressed={filter === value}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === value ? "bg-violet-500 text-white" : "border border-white/10 text-slate-300 hover:border-white/25"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filterBtn("all", "All")}
        {filterBtn("server", "Server")}
        {filterBtn("web", "Browsers")}
        <span className="ml-auto flex gap-2">
          <button type="button" onClick={() => void query.refetch()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:border-white/25">
            <RefreshCcw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
          {query.data?.errors.length ? (
            <button
              type="button"
              onClick={() => window.confirm("Clear the whole error log?") && resolve.mutate(undefined)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear all
            </button>
          ) : null}
        </span>
      </div>
      {notice ? <p className="text-xs text-rose-300">{notice}</p> : null}

      {query.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : query.isError ? (
        <p className="text-sm text-rose-300">{getApiErrorMessage(query.error)}</p>
      ) : !rows.length ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.05] p-5 text-sm text-emerald-100">
          <Check className="mb-2 h-5 w-5" /> Nothing here. No {filter === "web" ? "browser crashes" : filter === "server" ? "server errors" : "crashes or server errors"} recorded in the last 30 days.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row: ErrorEventRow) => (
            <li key={row.id} className="rounded-xl border border-white/10 bg-[#0d1119]">
              <div className="flex items-start gap-3 p-3">
                <button type="button" onClick={() => setOpen(open === row.id ? null : row.id)} aria-expanded={open === row.id} className="flex min-w-0 flex-1 items-start gap-2 text-left">
                  {open === row.id ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />}
                  {row.source === "server" ? <Server className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-label="Server" /> : <Globe className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-label="Browser" />}
                  <span className="min-w-0">
                    <span className="block break-words text-sm text-slate-100">{row.message}</span>
                    <span className="mt-1 block text-[11px] text-slate-500">
                      {row.path ? `${row.path} · ` : ""}last {ago(row.lastSeenAt)} · first {ago(row.firstSeenAt)}
                    </span>
                  </span>
                </button>
                <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-xs font-semibold text-slate-200" title="Times it happened">×{row.count}</span>
                <button type="button" onClick={() => resolve.mutate(row.id)} disabled={resolve.isPending} className="shrink-0 rounded-lg border border-emerald-400/30 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50">
                  Fixed
                </button>
              </div>
              {open === row.id ? (
                <pre className="max-h-72 overflow-auto border-t border-white/5 p-3 text-[11px] leading-relaxed text-slate-400">{row.detail ?? "No stack trace."}</pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
