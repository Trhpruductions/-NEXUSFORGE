"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { Check, Flag, Loader2, X } from "lucide-react";
import { getApiErrorMessage, reportMessage, type ReportReason } from "@/lib/api";
import { plainText } from "@/lib/plain-text";
import { useAuthStore } from "@/store/auth-store";

export type ReportTarget = { kind: "CHANNEL" | "DM"; messageId: string; authorName: string; content: string };

const reasons: Array<{ value: ReportReason; label: string; hint: string }> = [
  { value: "SPAM", label: "Spam", hint: "Ads, repeated messages, unwanted links" },
  { value: "HARASSMENT", label: "Harassment or bullying", hint: "Targeting, threats or abuse toward someone" },
  { value: "HATE", label: "Hate speech", hint: "Attacks on people for who they are" },
  { value: "SEXUAL", label: "Sexual content", hint: "Explicit or sexual content, especially involving minors" },
  { value: "VIOLENCE", label: "Violence or threats", hint: "Threats, gore or encouraging violence" },
  { value: "SELF_HARM", label: "Self-harm", hint: "Someone may be at risk" },
  { value: "SCAM", label: "Scam or phishing", hint: "Fake giveaways, stealing accounts or coins" },
  { value: "OTHER", label: "Something else", hint: "Tell us what's wrong below" },
];

/** "Report message" dialog. Server-channel reports go to that server's moderators; DMs to Nexus Forge staff. */
export function ReportDialog({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const { accessToken, csrfToken } = useAuthStore();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setReason(null);
    setDetails("");
    setDone(false);
  }, [target?.messageId]);

  useEffect(() => {
    if (!target) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  const mutation = useMutation({
    mutationFn: () => reportMessage(accessToken!, csrfToken!, { kind: target!.kind, messageId: target!.messageId, reason: reason!, details: details.trim() || undefined }),
    onSuccess: () => setDone(true),
  });

  if (!target || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="report-title" className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1119] text-slate-100 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <header className="flex items-start justify-between gap-3 border-b border-white/5 px-4 py-3">
          <div>
            <h2 id="report-title" className="flex items-center gap-2 text-sm font-semibold"><Flag className="h-4 w-4 text-rose-300" /> Report message</h2>
            <p className="text-[11px] text-slate-400">
              {target.kind === "CHANNEL" ? "This server's moderators will review it." : "Nexus Forge staff will review it."} The person you report won&apos;t see who reported them.
            </p>
          </div>
          <button type="button" onClick={onClose} title="Close" className="rounded-lg p-1 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
        </header>

        {done ? (
          <div className="space-y-3 px-4 py-6 text-center">
            <Check className="mx-auto h-8 w-8 text-emerald-300" />
            <p className="text-sm font-semibold">Thanks for letting us know.</p>
            <p className="text-xs text-slate-400">You can also block {target.authorName} from their profile so they can&apos;t message you.</p>
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200 hover:border-amber-400/50">Done</button>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto px-4 py-3">
            <blockquote className="max-h-24 overflow-hidden rounded-lg border border-white/5 bg-[#11151e] px-3 py-2 text-xs text-slate-300">
              <span className="font-semibold text-slate-100">{target.authorName}</span>: {plainText(target.content).slice(0, 280)}
            </blockquote>
            <fieldset className="space-y-1.5">
              <legend className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">What&apos;s wrong with it?</legend>
              {reasons.map((option) => (
                <label key={option.value} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs transition ${reason === option.value ? "border-rose-400/60 bg-rose-950/30" : "border-white/5 hover:border-white/15"}`}>
                  <input type="radio" name="report-reason" className="mt-0.5" checked={reason === option.value} onChange={() => setReason(option.value)} />
                  <span>
                    <span className="block font-semibold text-slate-100">{option.label}</span>
                    <span className="block text-[11px] text-slate-400">{option.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {reason === "SELF_HARM" ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-100">
                If someone is in immediate danger, contact local emergency services. In the US you can call or text 988 any time.
              </p>
            ) : null}
            <label className="block text-xs text-slate-300">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">More details (optional)</span>
              <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} rows={3} className="w-full rounded-lg border border-white/10 bg-[#11151e] px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400/60" />
            </label>
            {mutation.isError ? <p className="text-xs text-rose-300" role="alert">{getApiErrorMessage(mutation.error)}</p> : null}
            <div className="flex justify-end gap-2 pb-1">
              <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Cancel</button>
              <button type="button" disabled={!reason || mutation.isPending} onClick={() => mutation.mutate()} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/60 bg-rose-950/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-rose-100 hover:bg-rose-900/50 disabled:opacity-50">
                {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />} Send report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
