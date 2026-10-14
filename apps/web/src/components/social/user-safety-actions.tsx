"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, Flag, Loader2, X } from "lucide-react";
import { api, authHeaders, createSupportTicket, getApiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const REASONS = [
  "Harassment or bullying",
  "Hate speech",
  "Spam or scams",
  "Impersonation",
  "Inappropriate profile (name, picture or bio)",
  "May be under 18",
  "Something else",
];

/** Block / unblock anyone, and report a person to Nexus Forge staff (as a support ticket). */
export function UserSafetyActions({ userId, username, blockedByMe }: { userId: string; username: string; blockedByMe: boolean }) {
  const { accessToken, csrfToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["profile-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["friends"] }),
    ]);

  const block = useMutation({
    mutationFn: async () => {
      const headers = { headers: authHeaders(accessToken, csrfToken) };
      if (blockedByMe) await api.delete(`/api/friends/block/${userId}`, headers);
      else await api.post(`/api/friends/block/${userId}`, {}, headers);
    },
    onSuccess: async () => {
      setDone(blockedByMe ? `${username} is unblocked.` : `${username} is blocked. They can't message you or send friend requests.`);
      await refresh();
    },
  });

  const report = useMutation({
    mutationFn: () =>
      createSupportTicket(accessToken!, csrfToken!, {
        category: "REPORT_USER",
        subject: `Report: @${username}`.slice(0, 120),
        body: `Reported user: @${username} (id ${userId})\nReason: ${reason}\n\n${details.trim() || "(no extra details)"}`,
      }),
    onSuccess: (ticket) => {
      setReporting(false);
      setDetails("");
      setDone(`Thanks. Nexus Forge staff will review it (ticket #${ticket.number}).`);
    },
  });

  const error = block.error ?? report.error;

  return (
    <div className="mt-2">
      {reporting ? (
        <div className="space-y-2 rounded-lg border border-rose-400/25 bg-rose-500/[0.05] p-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-200">Report @{username}</p>
            <button type="button" onClick={() => setReporting(false)} className="text-slate-500 hover:text-white" aria-label="Cancel report"><X className="h-3.5 w-3.5" /></button>
          </div>
          <select value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Reason" className="h-8 w-full rounded-md border border-white/10 bg-[#11151e] px-2 text-xs text-slate-100">
            {REASONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} rows={2} placeholder="What happened? (optional)" aria-label="Details" className="w-full resize-none rounded-md border border-white/10 bg-[#11151e] px-2 py-1 text-xs text-slate-100 outline-none" />
          <button type="button" onClick={() => report.mutate()} disabled={report.isPending} className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-rose-500 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-rose-400 disabled:opacity-50">
            {report.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Flag className="h-3 w-3" />} Send report
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { if (blockedByMe || window.confirm(`Block ${username}? They won't be able to message you or send friend requests.`)) block.mutate(); }} disabled={block.isPending} className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300 hover:border-rose-400/50 hover:text-rose-200">
            {block.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : blockedByMe ? <Check className="h-3 w-3" /> : <Ban className="h-3 w-3" />} {blockedByMe ? "Unblock" : "Block"}
          </button>
          <button type="button" onClick={() => { setReporting(true); setDone(null); }} className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300 hover:border-rose-400/50 hover:text-rose-200">
            <Flag className="h-3 w-3" /> Report
          </button>
        </div>
      )}
      {done ? <p className="mt-1.5 text-[11px] text-emerald-300">{done}</p> : null}
      {error ? <p className="mt-1.5 text-[11px] text-rose-300">{getApiErrorMessage(error)}</p> : null}
    </div>
  );
}
