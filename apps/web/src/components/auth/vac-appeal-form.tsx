"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { getApiErrorMessage, submitVacAppeal } from "@/lib/api";

const inputClass =
  "mt-1 w-full rounded-lg border border-white/10 bg-[#0d1119] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none";

/**
 * A banned person's appeal, sent without signing in. Email and password prove it is their account. The reply is the
 * same whether or not the account exists or is banned, so the form can't be used to check who is banned.
 */
export function VacAppealForm({ onSent }: { onSent?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (note.trim().length < 10) {
      setError("Write at least 10 characters explaining your appeal.");
      return;
    }
    setBusy(true);
    try {
      const result = await submitVacAppeal({ email: email.trim(), password, note: note.trim() });
      setReply(result.message);
      setPassword("");
      onSent?.();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (reply) {
    return (
      <p role="status" className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
        {reply}
      </p>
    );
  }

  return (
    <form method="post" onSubmit={onSubmit} className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm font-semibold text-white">Appeal this ban</p>
      <label className="block text-xs font-semibold text-slate-300">
        Account email
        <input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} autoComplete="email" />
      </label>
      <label className="block text-xs font-semibold text-slate-300">
        Password
        <input type="password" required maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} autoComplete="current-password" />
      </label>
      <label className="block text-xs font-semibold text-slate-300">
        Your appeal (10 to 1000 characters)
        <textarea required minLength={10} maxLength={1000} rows={4} value={note} onChange={(event) => setNote(event.target.value)} className={inputClass} />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-sky-500 px-4 text-sm font-bold text-white transition hover:bg-sky-400 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
        Send appeal
      </button>
    </form>
  );
}
