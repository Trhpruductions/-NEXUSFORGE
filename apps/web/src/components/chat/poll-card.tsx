"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BarChart3, Check, Loader2, Lock, Trophy } from "lucide-react";
import { endPoll, getApiErrorMessage, votePoll, type Message, type MessagePoll } from "@/lib/api";
import { plainText } from "@/lib/plain-text";
import { useAuthStore } from "@/store/auth-store";

function timeLeft(endsAt: string, now: number) {
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return null;
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h left`;
  return `${Math.round(hours / 24)}d left`;
}

/**
 * A poll under its message. Pick answers and press Vote; results show once you've voted
 * or the poll has ended. Votes aren't anonymous: hover a result to see who picked it.
 */
export function PollCard({ message, selfId, canModerate, nameOf }: { message: Message; selfId: string; canModerate: boolean; nameOf: (userId: string) => string }) {
  const { accessToken, csrfToken } = useAuthStore();
  // The latest copy from our own vote, until the live update arrives with the same data.
  const [local, setLocal] = useState<MessagePoll | null>(null);
  const poll = local ?? message.poll!;
  useEffect(() => setLocal(null), [message.poll]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const mine = useMemo(() => new Set(poll.votes.filter((vote) => vote.userId === selfId).map((vote) => vote.optionId)), [poll.votes, selfId]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const left = timeLeft(poll.endsAt, now);
  const open = !poll.closedAt && Boolean(left);
  const voted = mine.size > 0;
  const results = !open || voted || showResults;
  const pending = Boolean(message.optimistic);

  const counts = useMemo(() => {
    const map = new Map<string, string[]>(poll.options.map((option) => [option.id, []]));
    for (const vote of poll.votes) map.get(vote.optionId)?.push(vote.userId);
    return map;
  }, [poll]);
  const voters = new Set(poll.votes.map((vote) => vote.userId)).size;
  const top = Math.max(0, ...[...counts.values()].map((list) => list.length));

  const vote = useMutation({
    mutationFn: (optionIds: string[]) => votePoll(accessToken!, csrfToken!, message.id, optionIds),
    onSuccess: (data) => {
      setError(null);
      setPicked(new Set());
      setShowResults(false);
      if (data.message.poll) setLocal(data.message.poll);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });
  const end = useMutation({
    mutationFn: () => endPoll(accessToken!, csrfToken!, message.id),
    onSuccess: (data) => {
      setError(null);
      if (data.message.poll) setLocal(data.message.poll);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const toggle = (optionId: string) => {
    setPicked((current) => {
      const next = new Set(poll.allowMultiple ? current : []);
      if (current.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  };

  const canEnd = open && !pending && (message.authorId === selfId || canModerate);

  return (
    <div className="mt-1.5 max-w-md rounded-xl border border-violet-400/25 bg-[linear-gradient(160deg,rgba(139,92,246,0.10),rgba(15,23,42,0.6))] p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">
        <BarChart3 className="h-3.5 w-3.5" /> Poll
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words text-[15px] font-semibold text-white">{plainText(message.content)}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{poll.allowMultiple ? "Choose one or more answers" : "Choose one answer"}</p>

      <div className="mt-2.5 space-y-1.5" role={results ? undefined : poll.allowMultiple ? "group" : "radiogroup"} aria-label="Answers">
        {poll.options.map((option) => {
          const who = counts.get(option.id) ?? [];
          const percent = voters ? Math.round((who.length / voters) * 100) : 0;
          const winner = !open && top > 0 && who.length === top;
          if (results) {
            return (
              <div
                key={option.id}
                title={who.length ? who.map(nameOf).join(", ") : "No votes yet"}
                className={`relative overflow-hidden rounded-lg border px-3 py-2 text-sm ${mine.has(option.id) ? "border-violet-400/60" : winner ? "border-amber-400/50" : "border-white/10"}`}
              >
                <span className={`absolute inset-y-0 left-0 transition-[width] duration-500 ${winner ? "bg-amber-400/20" : "bg-violet-500/20"}`} style={{ width: `${percent}%` }} aria-hidden />
                <span className="relative flex items-center gap-2">
                  {mine.has(option.id) ? <Check className="h-3.5 w-3.5 shrink-0 text-violet-200" aria-label="Your vote" /> : winner ? <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label="Most votes" /> : null}
                  <span className="min-w-0 flex-1 break-words text-slate-100">{option.text}</span>
                  <span className="shrink-0 text-xs font-semibold text-slate-300">{percent}%</span>
                  <span className="shrink-0 text-[11px] text-slate-500">{who.length}</span>
                </span>
              </div>
            );
          }
          const selected = picked.has(option.id);
          return (
            <button
              key={option.id}
              type="button"
              role={poll.allowMultiple ? "checkbox" : "radio"}
              aria-checked={selected}
              disabled={pending || vote.isPending}
              onClick={() => toggle(option.id)}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${selected ? "border-violet-400/70 bg-violet-500/15 text-white" : "border-white/10 bg-white/[0.02] text-slate-200 hover:border-violet-400/40"}`}
            >
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center border ${poll.allowMultiple ? "rounded" : "rounded-full"} ${selected ? "border-violet-300 bg-violet-400 text-slate-950" : "border-slate-500"}`}>
                {selected ? <Check className="h-3 w-3" /> : null}
              </span>
              <span className="min-w-0 flex-1 break-words">{option.text}</span>
            </button>
          );
        })}
      </div>

      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
        <span>
          {voters} vote{voters === 1 ? "" : "s"} ·{" "}
          {open ? left : <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Poll closed</span>}
        </span>
        <span className="flex-1" />
        {open && !results ? (
          <>
            <button type="button" onClick={() => setShowResults(true)} className="rounded-md px-2 py-1 text-slate-300 hover:bg-white/5">Show results</button>
            <button type="button" disabled={!picked.size || vote.isPending || pending} onClick={() => vote.mutate([...picked])} className="inline-flex items-center gap-1 rounded-md bg-violet-500 px-3 py-1 font-semibold text-white hover:bg-violet-400 disabled:opacity-40">
              {vote.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Vote
            </button>
          </>
        ) : null}
        {open && results && !voted ? (
          <button type="button" onClick={() => setShowResults(false)} className="rounded-md px-2 py-1 text-slate-300 hover:bg-white/5">Back to voting</button>
        ) : null}
        {open && voted ? (
          <button type="button" disabled={vote.isPending} onClick={() => vote.mutate([])} className="rounded-md px-2 py-1 text-slate-300 hover:bg-white/5">Remove vote</button>
        ) : null}
        {canEnd ? (
          <button type="button" disabled={end.isPending} onClick={() => { if (window.confirm("End this poll now? Nobody will be able to vote after this.")) end.mutate(); }} className="rounded-md px-2 py-1 text-rose-200 hover:bg-rose-500/10">End poll</button>
        ) : null}
      </div>
    </div>
  );
}
