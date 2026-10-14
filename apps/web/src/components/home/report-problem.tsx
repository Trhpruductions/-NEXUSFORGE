"use client";

import { useState } from "react";
import { Bug, CheckCircle2, Loader2, Send } from "lucide-react";
import { getApiErrorMessage, sendProblemReport, type ProblemKind } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const kinds: Array<{ value: ProblemKind; label: string }> = [
  { value: "BUG", label: "Something's broken" },
  { value: "SIGN_IN", label: "I can't sign in" },
  { value: "BILLING", label: "Payments or Core+" },
  { value: "SAFETY", label: "Safety or abuse" },
  { value: "OTHER", label: "Something else" },
];

const field = "w-full rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60";

/** "Report a problem" on the home page: works signed in or out. */
export function ReportProblem() {
  const user = useAuthStore((state) => state.user);
  const [kind, setKind] = useState<ProblemKind>("BUG");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await sendProblemReport({
        kind,
        message: message.trim(),
        contactEmail: user ? undefined : email.trim() || undefined,
        pageUrl: typeof window === "undefined" ? undefined : window.location.pathname,
        website,
      });
      setReference(result.reference ?? "sent");
      setMessage("");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (reference) {
    return (
      <div className="rounded-[22px] border border-emerald-400/25 bg-emerald-500/[0.06] p-6 text-center" role="status">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" />
        <p className="mt-3 text-lg font-semibold text-white">Thanks, we got it.</p>
        <p className="mt-1 text-sm text-slate-300">
          The team will look into it{user || email ? " and get back to you if we need more details" : ""}.
          {reference !== "sent" ? <span className="block pt-1 text-xs text-slate-500">Reference {reference}</span> : null}
        </p>
        <button type="button" onClick={() => setReference(null)} className="mt-4 text-sm font-semibold text-amber-200 underline-offset-4 hover:underline">
          Report something else
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[22px] border border-white/8 bg-slate-950/60 p-5 sm:p-6" noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-white">What&apos;s wrong?</legend>
        <div className="flex flex-wrap gap-2">
          {kinds.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition ${kind === option.value ? "border-amber-400/60 bg-amber-500/15 text-amber-100" : "border-white/10 text-slate-300 hover:border-white/25"}`}
            >
              <input type="radio" name="kind" value={option.value} checked={kind === option.value} onChange={() => setKind(option.value)} className="sr-only" />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-semibold text-white">
        Tell us what happened
        <textarea
          className={`${field} mt-2 min-h-[110px] font-normal`}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={2000}
          required
          placeholder="What were you doing, what did you expect, and what happened instead?"
        />
      </label>
      {user ? (
        <p className="text-xs text-slate-400">Signed in as <strong className="text-slate-200">{user.username}</strong>. We&apos;ll reply in the app if we need more.</p>
      ) : (
        <label className="block text-sm font-semibold text-white">
          Your email <span className="font-normal text-slate-400">(optional, so we can reply)</span>
          <input className={`${field} mt-2 font-normal`} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        </label>
      )}
      {/* Hidden from people; bots fill it in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(event) => setWebsite(event.target.value)} className="hidden" />
      {error ? <p className="text-sm text-rose-300" role="alert">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || message.trim().length < 10}
          className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(120deg,#9fd8ff,#2ea4ff_55%,#0b6fe0)] px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-950 transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send report
        </button>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><Bug className="h-3.5 w-3.5" /> The page you&apos;re on and your browser type are included to help us fix it.</span>
      </div>
    </form>
  );
}
