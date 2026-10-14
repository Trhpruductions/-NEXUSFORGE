"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Coins, Loader2, Send, X } from "lucide-react";
import { getApiErrorMessage, getCoinTransferLimits, sendCoins } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

type SendCoinsDialogProps = {
  open: boolean;
  onClose: () => void;
  balance: string;
  /** Pre-fill the recipient, e.g. when opened from someone's profile. */
  defaultRecipient?: string;
};

const fieldClass = "w-full rounded-lg border border-white/10 bg-[#0a0d14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400/60";
const labelClass = "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400";

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`.replace(/\./g, "");
}

export function SendCoinsDialog({ open, onClose, balance, defaultRecipient = "" }: SendCoinsDialogProps) {
  const { accessToken, csrfToken } = useAuthStore();
  const queryClient = useQueryClient();
  const titleId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  // One key per intended transfer. A retry after a network error reuses it, so the
  // server can tell "same send again" from "a second send".
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);

  const limitsQuery = useQuery({
    queryKey: ["coin-transfer-limits", accessToken],
    queryFn: () => getCoinTransferLimits(accessToken!),
    enabled: open && Boolean(accessToken),
  });
  const limits = limitsQuery.data;

  useEffect(() => {
    if (!open) return;
    setStep("form");
    setRecipient(defaultRecipient);
    setAmount("");
    setNote("");
    setError(null);
    setIdempotencyKey(newKey());
    const timer = window.setTimeout(() => firstFieldRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open, defaultRecipient]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sendMutation = useMutation({
    mutationFn: () => sendCoins(accessToken!, csrfToken!, { recipient: recipient.trim().replace(/^@/, ""), amount, note: note.trim() || undefined, idempotencyKey }),
    onSuccess: async () => {
      setStep("done");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["economy"] }),
        queryClient.invalidateQueries({ queryKey: ["coin-history"] }),
        queryClient.invalidateQueries({ queryKey: ["coin-transfer-limits"] }),
      ]);
    },
    onError: (err) => {
      setError(getApiErrorMessage(err));
      setStep("form");
    },
  });

  if (!open) return null;

  const amountNumber = Number(amount);
  const min = Number(limits?.min ?? 10);
  const max = Math.min(Number(limits?.max ?? 50000), Number(limits?.remainingToday ?? Infinity), Number(balance));
  const lockedUntil = limits?.canSendAt ? new Date(limits.canSendAt) : null;

  function review() {
    setError(null);
    const name = recipient.trim().replace(/^@/, "");
    if (!name) return setError("Enter the username you want to send to.");
    if (!/^\d+$/.test(amount) || amountNumber <= 0) return setError("Enter a whole number of coins.");
    if (amountNumber < min) return setError(`The minimum is ${min.toLocaleString()} coins.`);
    if (amountNumber > Number(balance)) return setError("You don't have that many coins.");
    if (limits && amountNumber > Number(limits.max)) return setError(`The most you can send at once is ${Number(limits.max).toLocaleString()} coins.`);
    if (limits && amountNumber > Number(limits.remainingToday)) return setError(`You can send ${Number(limits.remainingToday).toLocaleString()} more coins today.`);
    setStep("confirm");
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-md overflow-clip rounded-2xl border border-amber-500/25 bg-[#0d1119] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,#9fd8ff,#2ea4ff,transparent)]" />
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h2 id={titleId} className="nf-heading inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-white">
            <Coins className="h-4 w-4 text-amber-300" /> Send coins
          </h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "done" ? (
          <div className="px-5 py-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-300"><Check className="h-6 w-6" /></span>
            <p className="mt-3 text-sm text-white">Sent {amountNumber.toLocaleString()} coins to <span className="font-semibold text-amber-200">@{recipient.trim().replace(/^@/, "")}</span>.</p>
            <button type="button" onClick={onClose} className="mt-5 rounded-lg bg-amber-400 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-300">Done</button>
          </div>
        ) : step === "confirm" ? (
          <div className="space-y-4 px-5 py-5">
            <p className="text-sm text-slate-300">
              Send <span className="font-semibold text-white">{amountNumber.toLocaleString()} Nexus Forge Coins</span> to <span className="font-semibold text-amber-200">@{recipient.trim().replace(/^@/, "")}</span>?
            </p>
            {note.trim() ? <p className="rounded-lg border border-white/5 bg-[#11151e] px-3 py-2 text-xs italic text-slate-400">&ldquo;{note.trim()}&rdquo;</p> : null}
            <p className="text-xs text-slate-500">Transfers can&apos;t be undone. Your balance after: {(Number(balance) - amountNumber).toLocaleString()}.</p>
            <div className="flex justify-between gap-2">
              <button type="button" onClick={() => setStep("form")} disabled={sendMutation.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 hover:border-amber-400/50 disabled:opacity-50">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <button type="button" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-300 disabled:opacity-60">
                {sendMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Confirm send
              </button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4 px-5 py-5"
            onSubmit={(event) => {
              event.preventDefault();
              review();
            }}
          >
            {lockedUntil ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                New accounts can send coins after their first day. Unlocks {lockedUntil.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.
              </p>
            ) : null}
            <div>
              <label className={labelClass} htmlFor={`${titleId}-to`}>To</label>
              <input id={`${titleId}-to`} ref={firstFieldRef} value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="@username" autoComplete="off" className={fieldClass} maxLength={64} />
            </div>
            <div>
              <label className={labelClass} htmlFor={`${titleId}-amount`}>Amount</label>
              <div className="relative">
                <input id={`${titleId}-amount`} value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder={`${min.toLocaleString()} or more`} className={`${fieldClass} pr-16`} />
                <button type="button" onClick={() => setAmount(String(Math.max(0, Math.floor(max))))} className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300 hover:bg-amber-500/10">Max</button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Balance {Number(balance).toLocaleString()}
                {limits ? ` · ${Number(limits.remainingToday).toLocaleString()} left to send today` : ""}
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor={`${titleId}-note`}>Note <span className="normal-case tracking-normal text-slate-600">(optional)</span></label>
              <input id={`${titleId}-note`} value={note} onChange={(event) => setNote(event.target.value)} placeholder="gg, thanks for the carry" className={fieldClass} maxLength={140} />
            </div>
            {error ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200" role="alert">{error}</p> : null}
            <div className="flex justify-end">
              <button type="submit" disabled={Boolean(lockedUntil)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-300 disabled:opacity-50">
                Review <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
