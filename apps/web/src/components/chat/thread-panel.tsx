"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Loader2, MessagesSquare, Pencil, Send, X } from "lucide-react";
import { getApiErrorMessage, getThread, postMessage, updateThread, type Message, type ThreadSummary } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { hueFor, tileGradient } from "@/lib/colors";
import { RichText } from "@/components/chat/rich-text";
import { firstLink, LinkPreviewCard } from "@/components/chat/link-preview-card";
import { useAuthStore, useQueryScope } from "@/store/auth-store";

function time(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Memoised: the reply box's draft lives in ThreadPanel, and typing in it shouldn't re-render (and re-parse) every reply.
const Row = memo(function Row({ message, emojis }: { message: Message; emojis?: Record<string, string> }) {
  const name = message.author?.username ?? message.botName ?? "Unknown";
  return (
    <div className="flex gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
      {message.author?.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={message.author.avatar} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-slate-950" style={{ background: tileGradient(hueFor(message.authorId ?? name)) }}>
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2 text-[11px] text-slate-500">
          <span className="text-sm font-semibold" style={{ color: hueFor(message.authorId ?? name).light }}>{name}</span>
          {time(message.createdAt)}
        </p>
        <RichText content={message.content} context={{ emojis }} />
        {!message.attachments?.length && firstLink(message.content) ? <LinkPreviewCard url={firstLink(message.content)!} /> : null}
      </div>
    </div>
  );
});

/** A thread, opened beside the channel. Replies are posted to the channel with the thread's id. */
export function ThreadPanel({ threadId, channelId, canModerate, onClose, emojis }: { threadId: string; channelId: string; canModerate: boolean; onClose: () => void; emojis?: Record<string, string> }) {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken, user } = useAuthStore();
  const queryScope = useQueryScope();
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const key = ["thread", threadId, queryScope];

  const threadQuery = useQuery({ queryKey: key, queryFn: () => getThread(accessToken!, threadId), enabled: Boolean(accessToken) });
  const data = threadQuery.data;

  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    const put = (fn: (current: NonNullable<typeof data>) => NonNullable<typeof data>) =>
      queryClient.setQueryData<typeof data>(key, (current) => (current ? fn(current) : current));
    const onCreated = (payload: { message: Message }) => {
      if (payload.message.threadId !== threadId) return;
      put((current) => (current.messages.some((msg) => msg.id === payload.message.id) ? current : { ...current, messages: [...current.messages, payload.message] }));
    };
    const onDeleted = (payload: { messageId: string }) => put((current) => ({ ...current, messages: current.messages.filter((msg) => msg.id !== payload.messageId) }));
    const onUpdated = (payload: { message: Message }) => put((current) => ({ ...current, messages: current.messages.map((msg) => (msg.id === payload.message.id ? payload.message : msg)) }));
    const onThread = (payload: { thread: ThreadSummary }) => {
      if (payload.thread.id !== threadId) return;
      put((current) => ({ ...current, thread: { ...current.thread, ...payload.thread } }));
    };
    socket.on("message:created", onCreated);
    socket.on("message:deleted", onDeleted);
    socket.on("message:updated", onUpdated);
    socket.on("thread:updated", onThread);
    return () => {
      socket.off("message:created", onCreated);
      socket.off("message:deleted", onDeleted);
      socket.off("message:updated", onUpdated);
      socket.off("thread:updated", onThread);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, threadId, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [data?.messages.length]);

  const send = useMutation({
    mutationFn: () => postMessage(accessToken!, csrfToken!, { channelId, threadId, content: draft.trim() }),
    onSuccess: (result) => {
      setDraft("");
      setError(null);
      queryClient.setQueryData<typeof data>(key, (current) => (current && !current.messages.some((msg) => msg.id === result.message.id) ? { ...current, messages: [...current.messages, result.message] } : current));
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const update = useMutation({
    mutationFn: (payload: { title?: string; archived?: boolean }) => updateThread(accessToken!, csrfToken!, threadId, payload),
    onSuccess: (result) => {
      setRenaming(null);
      queryClient.setQueryData<typeof data>(key, (current) => (current ? { ...current, thread: { ...current.thread, ...result.thread } } : current));
      void queryClient.invalidateQueries({ queryKey: ["threads", channelId] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const thread = data?.thread;
  const canManage = Boolean(thread && (thread.creatorId === user?.id || canModerate));

  return (
    <aside className="flex h-full w-full min-w-0 flex-col border-l border-white/[0.06] bg-[#0b0e17]/95 backdrop-blur-xl lg:w-[360px]" aria-label="Thread">
      <header className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-200"><MessagesSquare className="h-4 w-4" /></span>
        {renaming !== null ? (
          <form className="flex min-w-0 flex-1 gap-1" onSubmit={(event) => { event.preventDefault(); if (renaming.trim()) update.mutate({ title: renaming.trim() }); }}>
            <input autoFocus value={renaming} onChange={(event) => setRenaming(event.target.value)} maxLength={100} className="h-8 min-w-0 flex-1 rounded-lg border border-violet-400/50 bg-[#11151e] px-2 text-sm text-white outline-none" aria-label="Thread name" />
            <button type="button" onClick={() => setRenaming(null)} className="rounded p-1 text-slate-400 hover:text-white" title="Cancel"><X className="h-4 w-4" /></button>
          </form>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{thread?.title ?? "Thread"}</p>
            <p className="text-[11px] text-slate-500">{thread ? `${thread.messageCount} repl${thread.messageCount === 1 ? "y" : "ies"}${thread.archived ? " · archived" : ""}` : "Loading..."}</p>
          </div>
        )}
        {canManage && renaming === null && thread ? (
          <>
            <button type="button" onClick={() => setRenaming(thread.title)} title="Rename" className="rounded p-1.5 text-slate-400 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => update.mutate({ archived: !thread.archived })} title={thread.archived ? "Reopen thread" : "Archive thread"} className="rounded p-1.5 text-slate-400 hover:text-white">
              {thread.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            </button>
          </>
        ) : null}
        <button type="button" onClick={onClose} title="Close thread" className="rounded p-1.5 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {threadQuery.isLoading ? (
          <p className="flex items-center gap-2 p-3 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading thread...</p>
        ) : threadQuery.isError ? (
          <p className="p-3 text-sm text-rose-300">{getApiErrorMessage(threadQuery.error)}</p>
        ) : (
          <>
            {data?.thread.starterMessage ? (
              <div className="mb-2 rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-1">
                <Row message={data.thread.starterMessage} emojis={emojis} />
              </div>
            ) : (
              <p className="mb-2 px-2 text-[11px] italic text-slate-500">The message that started this thread was deleted.</p>
            )}
            {data?.messages.map((message) => <Row key={message.id} message={message} emojis={emojis} />)}
            {data && !data.messages.length ? <p className="px-2 py-3 text-xs text-slate-500">No replies yet. Start the conversation.</p> : null}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <form
        className="border-t border-white/[0.06] p-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim() && !send.isPending) send.mutate();
        }}
      >
        {error ? <p role="alert" className="mb-1.5 text-xs text-rose-300">{error}</p> : null}
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#11151e] px-3 py-1.5 transition focus-within:border-violet-400/60">
          <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} placeholder={thread?.archived ? "Reply to reopen this thread" : "Reply in thread"} className="h-8 min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500" aria-label="Reply in thread" />
          <button type="submit" disabled={!draft.trim() || send.isPending} title="Send" className="rounded-lg bg-gradient-to-br from-violet-400 to-fuchsia-500 p-1.5 text-slate-950 disabled:opacity-40">
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </aside>
  );
}
