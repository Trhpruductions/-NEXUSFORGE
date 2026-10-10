"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Inbox, LifeBuoy, Loader2, Plus, RotateCcw, Send, ShieldCheck, XCircle } from "lucide-react";
import {
  createSupportTicket,
  getApiErrorMessage,
  getSupportMe,
  getSupportTicket,
  listSupportTickets,
  replySupportTicket,
  setSupportTicketStatus,
  type SupportCategory,
  type SupportStatus,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const panel = "rounded-2xl border border-amber-500/15 bg-[#0d1119]";
const inputClass = "w-full rounded-lg border border-white/10 bg-[#0a0d14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400/60";
const goldBtn = "inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-300 disabled:opacity-50";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200 hover:border-amber-400/50 disabled:opacity-50";

const categories: Array<{ value: SupportCategory; label: string }> = [
  { value: "ACCOUNT", label: "Account & sign-in" },
  { value: "BUG", label: "Something's broken" },
  { value: "FORGE", label: "Forges, chat & voice" },
  { value: "REPORT_USER", label: "Report a player" },
  { value: "BILLING", label: "Coins & purchases" },
  { value: "OTHER", label: "Something else" },
];

const statusMeta: Record<SupportStatus, { label: string; cls: string }> = {
  OPEN: { label: "Waiting for support", cls: "border-amber-400/40 bg-amber-500/10 text-amber-200" },
  WAITING_ON_USER: { label: "Support replied", cls: "border-sky-400/40 bg-sky-500/10 text-sky-200" },
  RESOLVED: { label: "Resolved", cls: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" },
  CLOSED: { label: "Closed", cls: "border-white/10 bg-white/5 text-slate-400" },
};

function StatusPill({ status, staffView }: { status: SupportStatus; staffView: boolean }) {
  const meta = statusMeta[status];
  // Staff read the same states from the other side of the desk.
  const label = staffView ? (status === "OPEN" ? "Needs reply" : status === "WAITING_ON_USER" ? "Waiting on player" : meta.label) : meta.label;
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${meta.cls}`}>{label}</span>;
}

function when(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function NewTicketForm({ onCreated }: { onCreated: (id: string) => void }) {
  const { accessToken, csrfToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<SupportCategory>("ACCOUNT");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => createSupportTicket(accessToken!, csrfToken!, { subject: subject.trim(), category, body: body.trim() }),
    onSuccess: async (ticket) => {
      await queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      onCreated(ticket.id);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  return (
    <form
      className="space-y-4 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        if (subject.trim().length < 4) return setError("Give your ticket a short subject (4+ characters).");
        if (body.trim().length < 10) return setError("Tell us a bit more about what's happening (10+ characters).");
        create.mutate();
      }}
    >
      <div>
        <h2 className="nf-heading text-sm font-bold uppercase tracking-[0.18em] text-white">Open a ticket</h2>
        <p className="mt-1 text-xs text-slate-400">A real person on the Vexora team reads every ticket. You&apos;ll get a notification and an email when we reply.</p>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Topic</span>
        <select value={category} onChange={(event) => setCategory(event.target.value as SupportCategory)} className={inputClass}>
          {categories.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Subject</span>
        <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={120} placeholder="e.g. Voice keeps disconnecting in my forge" className={inputClass} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">What&apos;s going on?</span>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={5000} rows={7} placeholder="What happened, what you expected, and anything you already tried. For a player report, include their username." className={`${inputClass} resize-y`} />
      </label>
      {error ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200" role="alert">{error}</p> : null}
      <div className="flex justify-end">
        <button type="submit" disabled={create.isPending} className={goldBtn}>
          {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send ticket
        </button>
      </div>
    </form>
  );
}

function TicketThread({ ticketId }: { ticketId: string }) {
  const { accessToken, csrfToken, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["support-ticket", ticketId, accessToken],
    queryFn: () => getSupportTicket(accessToken!, ticketId),
    enabled: Boolean(accessToken),
    refetchInterval: 20_000,
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["support-ticket", ticketId] }),
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] }),
    ]);
  };
  const send = useMutation({
    mutationFn: () => replySupportTicket(accessToken!, csrfToken!, ticketId, reply.trim()),
    onSuccess: async () => {
      setReply("");
      await refresh();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  const setStatus = useMutation({
    mutationFn: (status: SupportStatus) => setSupportTicketStatus(accessToken!, csrfToken!, ticketId, status),
    onSuccess: refresh,
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  if (query.isLoading) return <p className="flex items-center gap-2 p-5 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading ticket...</p>;
  if (!query.data) return <p className="p-5 text-sm text-rose-300">This ticket couldn&apos;t be loaded.</p>;

  const { ticket, staff } = query.data;
  const mine = ticket.user.id === user?.id;
  const staffView = staff && !mine;
  const closed = ticket.status === "CLOSED";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/5 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">#{ticket.number}</span>
          <StatusPill status={ticket.status} staffView={staffView} />
          <span className="text-[11px] text-slate-500">{categories.find((c) => c.value === ticket.category)?.label}</span>
        </div>
        <h2 className="mt-1 text-base font-semibold text-white">{ticket.subject}</h2>
        {staffView ? <p className="text-[11px] text-slate-500">From @{ticket.user.username}{ticket.user.email ? ` · ${ticket.user.email}` : ""}</p> : null}
      </div>

      <ol className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {ticket.messages.map((message) => (
          <li key={message.id} className={`rounded-xl border px-3.5 py-2.5 ${message.fromStaff ? "border-amber-400/25 bg-amber-500/5" : "border-white/5 bg-[#11151e]"}`}>
            <p className="mb-1 flex items-center gap-2 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-200">{message.fromStaff ? "Vexora Support" : `@${message.author.username}`}</span>
              {message.fromStaff ? <span className="inline-flex items-center gap-1 text-amber-300"><ShieldCheck className="h-3 w-3" /> Staff{staff ? ` · @${message.author.username}` : ""}</span> : null}
              <span>· {when(message.createdAt)}</span>
            </p>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-200">{message.body}</p>
          </li>
        ))}
      </ol>

      <div className="space-y-2 border-t border-white/5 px-5 py-4">
        {closed && !staff ? (
          <p className="text-xs text-slate-400">This ticket is closed. Open a new ticket if you still need help.</p>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              if (reply.trim()) send.mutate();
            }}
            className="space-y-2"
          >
            <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={3} maxLength={5000} placeholder={staffView ? "Reply to the player..." : ticket.status === "RESOLVED" ? "Still need help? Reply to reopen this ticket." : "Add a reply..."} className={`${inputClass} resize-y`} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {staff && ticket.status !== "RESOLVED" && !closed ? (
                  <button type="button" onClick={() => setStatus.mutate("RESOLVED")} disabled={setStatus.isPending} className={ghostBtn}><CheckCircle2 className="h-3.5 w-3.5" /> Mark resolved</button>
                ) : null}
                {!closed ? (
                  <button type="button" onClick={() => setStatus.mutate("CLOSED")} disabled={setStatus.isPending} className={ghostBtn}><XCircle className="h-3.5 w-3.5" /> Close ticket</button>
                ) : staff ? (
                  <button type="button" onClick={() => setStatus.mutate("OPEN")} disabled={setStatus.isPending} className={ghostBtn}><RotateCcw className="h-3.5 w-3.5" /> Reopen</button>
                ) : null}
              </div>
              <button type="submit" disabled={send.isPending || !reply.trim()} className={goldBtn}>
                {send.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} {staffView ? "Send reply" : "Reply"}
              </button>
            </div>
          </form>
        )}
        {error ? <p className="text-xs text-rose-300" role="alert">{error}</p> : null}
      </div>
    </div>
  );
}

function SupportDesk() {
  const { accessToken } = useAuthStore();
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("ticket");
  const composing = params.get("new") === "1" || !selected;
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [staffFilter, setStaffFilter] = useState<SupportStatus | "unresolved" | "any">("unresolved");

  const meQuery = useQuery({ queryKey: ["support-me", accessToken], queryFn: () => getSupportMe(accessToken!), enabled: Boolean(accessToken) });
  const staff = meQuery.data?.staff ?? false;
  const listQuery = useQuery({
    queryKey: ["support-tickets", scope, scope === "all" ? staffFilter : "any", accessToken],
    queryFn: () => listSupportTickets(accessToken!, scope, scope === "all" ? staffFilter : "any"),
    enabled: Boolean(accessToken),
    refetchInterval: 30_000,
  });

  // Staff land on the queue by default.
  useEffect(() => {
    if (staff) setScope("all");
  }, [staff]);

  const open = (id: string | null) => router.replace(id ? `/app/support?ticket=${id}` : "/app/support?new=1", { scroll: false });
  const tickets = listQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="nf-heading inline-flex items-center gap-2 text-xl font-bold text-white"><LifeBuoy className="h-5 w-5 text-amber-300" /> Support</h1>
          <p className="text-xs text-slate-400">{staff ? "Answer player tickets and track your own." : "Get help from the Vexora team. Replies arrive here and by email."}</p>
        </div>
        <button type="button" onClick={() => open(null)} className={goldBtn}><Plus className="h-3.5 w-3.5" /> New ticket</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className={`${panel} flex min-h-[420px] flex-col`}>
          {staff ? (
            <div className="flex gap-1 border-b border-white/5 p-2" role="tablist" aria-label="Ticket list">
              {(["all", "mine"] as const).map((value) => (
                <button key={value} type="button" role="tab" aria-selected={scope === value} onClick={() => setScope(value)} className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${scope === value ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"}`}>
                  {value === "all" ? "All tickets" : "My tickets"}
                </button>
              ))}
            </div>
          ) : null}
          {staff && scope === "all" ? (
            <div className="border-b border-white/5 p-2">
              <select value={staffFilter} onChange={(event) => setStaffFilter(event.target.value as typeof staffFilter)} className={`${inputClass} py-1.5 text-xs`} aria-label="Filter by status">
                <option value="unresolved">Unresolved</option>
                <option value="OPEN">Needs reply</option>
                <option value="WAITING_ON_USER">Waiting on player</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
                <option value="any">Everything</option>
              </select>
            </div>
          ) : null}
          {listQuery.isLoading ? (
            <p className="flex items-center gap-2 p-4 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
          ) : tickets.length ? (
            <ul className="min-h-0 flex-1 divide-y divide-white/5 overflow-y-auto">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <button type="button" onClick={() => open(ticket.id)} className={`w-full px-4 py-3 text-left transition hover:bg-white/[0.03] ${selected === ticket.id ? "bg-amber-500/[0.06]" : ""}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-white">{ticket.subject}</span>
                      <StatusPill status={ticket.status} staffView={scope === "all"} />
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                      #{ticket.number}{scope === "all" ? ` · @${ticket.user.username}` : ""} · {when(ticket.lastActivityAt)}
                    </span>
                    {ticket.lastMessage ? <span className="mt-1 block truncate text-xs text-slate-400">{ticket.lastMessage.fromStaff ? "Support: " : ""}{ticket.lastMessage.body}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <Inbox className="h-8 w-8 text-slate-600" />
              <p className="text-sm text-slate-400">{scope === "all" ? "Nothing in this queue." : "You haven't opened any tickets."}</p>
            </div>
          )}
        </aside>

        <section className={`${panel} min-h-[420px] lg:h-[calc(100dvh-14rem)]`}>
          {composing ? <NewTicketForm onCreated={(id) => open(id)} /> : <TicketThread key={selected!} ticketId={selected!} />}
        </section>
      </div>
    </div>
  );
}

export function SupportPage() {
  return (
    <Suspense fallback={null}>
      <SupportDesk />
    </Suspense>
  );
}
