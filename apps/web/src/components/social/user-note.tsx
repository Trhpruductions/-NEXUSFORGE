"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { getUserNote, saveUserNote } from "@/lib/api";
import { useAuthStore, useQueryScope } from "@/store/auth-store";

/**
 * A private note about someone. Only you ever see it. Saves itself a moment after you stop
 * typing, and on close: the card closes on any outside click, which removes this box
 * before a normal "on blur" save could run.
 */
export function UserNote({ userId }: { userId: string }) {
  const { accessToken, csrfToken } = useAuthStore();
  const queryScope = useQueryScope();
  const queryClient = useQueryClient();
  const key = ["user-note", userId, queryScope];
  const query = useQuery({ queryKey: key, queryFn: () => getUserNote(accessToken!, userId), enabled: Boolean(accessToken) });
  const [draft, setDraft] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (query.data) setDraft(query.data.note);
  }, [query.data]);

  const save = useMutation({
    mutationFn: (note: string) => saveUserNote(accessToken!, csrfToken!, userId, note),
    onSuccess: (data) => {
      queryClient.setQueryData(key, { note: data.note, updatedAt: new Date().toISOString() });
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
    },
  });

  const commit = () => {
    if (!query.data || draft.trim() === query.data.note) return;
    save.mutate(draft);
  };

  // Autosave after a pause in typing.
  useEffect(() => {
    if (!query.data || draft.trim() === query.data.note) return;
    const timer = window.setTimeout(() => save.mutate(draft), 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, query.data]);

  // Closing the card mid-pause: send what's there.
  const latest = useRef({ draft, saved: query.data?.note, accessToken, csrfToken });
  useEffect(() => {
    latest.current = { draft, saved: query.data?.note, accessToken, csrfToken };
  });
  useEffect(
    () => () => {
      const { draft: text, saved: stored, accessToken: token, csrfToken: csrf } = latest.current;
      if (stored !== undefined && token && csrf && text.trim() !== stored) {
        void saveUserNote(token, csrf, userId, text)
          .then((data) => queryClient.setQueryData(["user-note", userId, token], { note: data.note, updatedAt: new Date().toISOString() }))
          .catch(() => undefined);
      }
    },
    [userId, queryClient],
  );

  return (
    <label className="mt-3 block">
      <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        Note <span className="normal-case tracking-normal text-slate-600">(only you can see this)</span>
        {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : savedFlash ? <Check className="h-3 w-3 text-emerald-300" aria-label="Saved" /> : null}
      </span>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            (event.target as HTMLTextAreaElement).blur();
          }
        }}
        maxLength={256}
        rows={2}
        disabled={!query.data}
        placeholder="Click to add a note"
        className="mt-1 w-full resize-none rounded-lg border border-white/5 bg-[#11151e] px-2 py-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400/40"
      />
      {save.isError ? <span className="text-[11px] text-rose-300">Couldn&apos;t save your note.</span> : null}
    </label>
  );
}
