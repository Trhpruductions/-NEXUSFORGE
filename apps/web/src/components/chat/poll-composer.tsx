"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart3, Plus, Trash2, X } from "lucide-react";
import type { PollDraft } from "@/lib/api";

const DURATIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 4, label: "4 hours" },
  { hours: 8, label: "8 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "1 week" },
];
const MAX_OPTIONS = 10;
const QUESTION_MAX = 300;
const OPTION_MAX = 55;

/** "Create poll" dialog. The question becomes the message text. */
export function PollComposer({ open, onClose, onSubmit, busy }: { open: boolean; onClose: () => void; onSubmit: (question: string, poll: PollDraft) => Promise<void> | void; busy?: boolean }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [durationHours, setDurationHours] = useState(24);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuestion("");
    setOptions(["", ""]);
    setAllowMultiple(false);
    setDurationHours(24);
    setError(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const filled = options.map((option) => option.trim()).filter(Boolean);
  const submit = async () => {
    if (!question.trim()) return setError("Ask a question.");
    if (new Set(filled.map((option) => option.toLowerCase())).size < 2) return setError("Add at least two different answers.");
    setError(null);
    try {
      await onSubmit(question.trim(), { options: filled, allowMultiple, durationHours });
      onClose();
    } catch {
      /* the chat shows why sending failed */
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="poll-title" className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1119] text-slate-100 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <header className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
          <h2 id="poll-title" className="flex items-center gap-2 text-sm font-semibold"><BarChart3 className="h-4 w-4 text-violet-300" /> Create a poll</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
        </header>
        <form
          className="space-y-4 overflow-y-auto px-4 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Question</span>
            <input autoFocus value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={QUESTION_MAX} placeholder="What should we play tonight?" className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm outline-none focus:border-violet-400/60" />
          </label>
          <fieldset>
            <legend className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Answers</legend>
            <div className="mt-1 space-y-1.5">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    value={option}
                    onChange={(event) => setOptions((current) => current.map((value, i) => (i === index ? event.target.value : value)))}
                    maxLength={OPTION_MAX}
                    placeholder={`Answer ${index + 1}`}
                    aria-label={`Answer ${index + 1}`}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm outline-none focus:border-violet-400/60"
                  />
                  {options.length > 2 ? (
                    <button type="button" onClick={() => setOptions((current) => current.filter((_, i) => i !== index))} className="rounded p-1.5 text-slate-500 hover:text-rose-300" aria-label={`Remove answer ${index + 1}`}><Trash2 className="h-3.5 w-3.5" /></button>
                  ) : null}
                </div>
              ))}
            </div>
            {options.length < MAX_OPTIONS ? (
              <button type="button" onClick={() => setOptions((current) => [...current, ""])} className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-violet-200 hover:bg-violet-500/10">
                <Plus className="h-3.5 w-3.5" /> Add answer
              </button>
            ) : null}
          </fieldset>
          <div className="flex flex-wrap items-end gap-4">
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Length</span>
              <select value={durationHours} onChange={(event) => setDurationHours(Number(event.target.value))} className="mt-1 block h-9 rounded-lg border border-white/10 bg-[#11151e] px-2 text-sm">
                {DURATIONS.map((entry) => <option key={entry.hours} value={entry.hours}>{entry.label}</option>)}
              </select>
            </label>
            <label className="flex h-9 items-center gap-2 text-sm text-slate-200">
              <input type="checkbox" checked={allowMultiple} onChange={(event) => setAllowMultiple(event.target.checked)} className="h-4 w-4 accent-violet-500" />
              Allow more than one answer
            </label>
          </div>
          <p className="text-[11px] text-slate-500">Votes aren&apos;t anonymous: anyone in the channel can see who picked each answer.</p>
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-white/25">Cancel</button>
            <button type="submit" disabled={busy} className="rounded-lg bg-violet-500 px-4 py-2 text-xs font-bold text-white hover:bg-violet-400 disabled:opacity-50">Post poll</button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
