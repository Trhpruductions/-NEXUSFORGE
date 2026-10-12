"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, Loader2, ShieldCheck } from "lucide-react";
import { api, authHeaders, getApiErrorMessage } from "@/lib/api";
import type { SuspensionInfo } from "@/lib/suspension";
import { useAuthStore } from "@/store/auth-store";

const LENGTHS: Array<{ label: string; days: number | null }> = [
  { label: "1 day", days: 1 },
  { label: "3 days", days: 3 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "Until lifted", days: null },
];

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Staff tool: suspend an account across all of Vexora (signs them out everywhere and blocks
 * sign-in until it ends), or lift a suspension. The person is emailed either way.
 */
export function SuspensionControl({ userId, username, suspension, onChange }: { userId: string; username: string; suspension: SuspensionInfo | null; onChange?: (next: SuspensionInfo | null) => void }) {
  const { accessToken, csrfToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState<number | null>(7);
  const [error, setError] = useState<string | null>(null);

  const refresh = async (next: SuspensionInfo | null) => {
    onChange?.(next);
    await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const suspend = useMutation({
    mutationFn: async () => (await api.post<{ suspension: SuspensionInfo }>(`/api/admin/users/${userId}/suspend`, { reason: reason.trim(), days }, { headers: authHeaders(accessToken, csrfToken) })).data,
    onSuccess: async (data) => {
      setOpen(false);
      setReason("");
      setError(null);
      await refresh(data.suspension);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const lift = useMutation({
    mutationFn: async () => (await api.post(`/api/admin/users/${userId}/unsuspend`, {}, { headers: authHeaders(accessToken, csrfToken) })).data,
    onSuccess: async () => {
      setError(null);
      await refresh(null);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  if (suspension) {
    return (
      <div className="mt-2 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-200">
            <Ban className="h-3 w-3" /> Suspended {suspension.until ? `until ${formatDate(suspension.until)}` : "until lifted"}
          </span>
          <button type="button" disabled={lift.isPending} onClick={() => { if (window.confirm(`Lift the suspension on ${username}?`)) lift.mutate(); }} className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50">
            {lift.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />} Lift suspension
          </button>
        </div>
        <p className="text-xs text-slate-400">Reason: {suspension.reason}</p>
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1 rounded-full border border-rose-400/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-200 hover:bg-rose-500/10">
        <Ban className="h-3 w-3" /> Suspend…
      </button>
    );
  }

  return (
    <form
      className="mt-2 space-y-2 rounded-xl border border-rose-400/25 bg-rose-500/[0.04] p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (reason.trim().length < 3) {
          setError("Give a reason (at least 3 characters). The person will see it.");
          return;
        }
        suspend.mutate();
      }}
    >
      <p className="text-xs text-slate-300">
        Suspend <strong className="text-white">{username}</strong> from all of Vexora. They&apos;re signed out everywhere, can&apos;t sign in until it ends, and get an email with the reason.
      </p>
      <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        Reason (shown to them)
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1119] px-2 py-1.5 text-sm normal-case tracking-normal text-white" placeholder="For example: repeated harassment in DMs after a warning" />
      </label>
      <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        Length
        <select value={days === null ? "null" : String(days)} onChange={(event) => setDays(event.target.value === "null" ? null : Number(event.target.value))} className="mt-1 block h-9 rounded-lg border border-white/10 bg-[#0d1119] px-2 text-xs text-white">
          {LENGTHS.map((option) => <option key={option.label} value={option.days === null ? "null" : String(option.days)}>{option.label}</option>)}
        </select>
      </label>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={suspend.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-400 disabled:opacity-50">
          {suspend.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />} Suspend account
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(null); }} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:border-white/25">Cancel</button>
      </div>
    </form>
  );
}
