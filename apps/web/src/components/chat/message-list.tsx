"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CornerUpLeft, Loader2, Pencil, SmilePlus, Trash2, X } from "lucide-react";
import type { ForgeMemberEntry, ForgeRole, Message } from "@/lib/api";
import { topRoleFor } from "@/components/chat/member-list";

export const quickReactions = ["👍", "❤️", "😂", "🔥", "🎮", "👀"] as const;

type MessageListProps = {
  messages: Message[];
  selfId: string;
  canModerate: boolean;
  members: ForgeMemberEntry[];
  roles: ForgeRole[];
  ownerId: string;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onReply: (message: Message) => void;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onReact: (messageId: string, emoji: string) => void;
};

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDay(date: string): string {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

const iconBtn =
  "inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700/70 bg-slate-950/90 text-slate-300 transition hover:border-amber-500/50 hover:text-amber-100 disabled:opacity-40";

export function MessageList({
  messages,
  selfId,
  canModerate,
  members,
  roles,
  ownerId,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: MessageListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastMessageId = messages[messages.length - 1]?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lastMessageId]);

  const memberByUserId = useMemo(() => new Map(members.map((member) => [member.userId, member] as const)), [members]);

  const authorMeta = (message: Message) => {
    if (message.botId) return { name: message.botName ?? "Bot", color: "#e879f9", nickname: null as string | null };
    const member = message.authorId ? memberByUserId.get(message.authorId) : undefined;
    const top = member ? topRoleFor(member, roles, ownerId) : null;
    return {
      name: member?.nickname || message.author?.username || "Unknown",
      color: top?.color ?? "#e2e8f0",
      nickname: member?.nickname ?? null,
    };
  };

  const startEdit = (message: Message) => {
    setEditingId(message.id);
    setEditDraft(message.content);
    setPickerFor(null);
    setConfirmDeleteId(null);
  };

  const submitEdit = async () => {
    if (!editingId || !editDraft.trim()) return;
    setSavingEdit(true);
    try {
      await onEdit(editingId, editDraft.trim());
      setEditingId(null);
    } finally {
      setSavingEdit(false);
    }
  };

  let lastDay = "";

  return (
    <div className="grid gap-1.5">
      {hasOlder ? (
        <button
          type="button"
          onClick={onLoadOlder}
          disabled={loadingOlder}
          className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-950/80 px-4 py-1.5 text-[11px] uppercase tracking-[0.16em] text-slate-300 transition hover:border-amber-500/50 hover:text-amber-100 disabled:opacity-50"
        >
          {loadingOlder ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Load older messages
        </button>
      ) : null}

      {messages.map((message) => {
        const day = formatDay(message.createdAt);
        const showDay = day !== lastDay;
        lastDay = day;
        const meta = authorMeta(message);
        const isSelf = message.authorId === selfId;
        const canEdit = isSelf && !message.botId;
        const canDelete = (isSelf || canModerate) && !message.optimistic;
        const isEditing = editingId === message.id;

        const reactionGroups = new Map<string, { count: number; mine: boolean }>();
        for (const reaction of message.reactions ?? []) {
          const entry = reactionGroups.get(reaction.emoji) ?? { count: 0, mine: false };
          entry.count += 1;
          if (reaction.userId === selfId) entry.mine = true;
          reactionGroups.set(reaction.emoji, entry);
        }

        return (
          <div key={message.id}>
            {showDay ? (
              <div className="my-2 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                <span className="h-px flex-1 bg-slate-800" />
                {day}
                <span className="h-px flex-1 bg-slate-800" />
              </div>
            ) : null}

            <article
              className={`nf-message group relative rounded-[14px] border px-3 py-2 transition ${
                message.optimistic
                  ? "border-dashed border-amber-600/60 bg-amber-950/20"
                  : "border-transparent hover:border-slate-700/70 hover:bg-slate-900/60"
              }`}
            >
              {message.replyTo ? (
                <div className="mb-1 flex items-center gap-1.5 truncate text-[11px] text-slate-400">
                  <CornerUpLeft className="h-3 w-3 shrink-0 text-slate-500" />
                  <span className="shrink-0 font-semibold text-slate-300">
                    {message.replyTo.botName ?? message.replyTo.author?.username ?? "someone"}
                  </span>
                  <span className="truncate">{message.replyTo.content}</span>
                </div>
              ) : null}

              <div className="flex gap-3">
                <div className="nf-message-avatar mt-0.5 shrink-0">
                  {message.botAvatar || message.author?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={message.botAvatar ?? message.author?.avatar ?? ""} alt="" className="h-9 w-9 rounded-full border border-slate-700 object-cover" />
                  ) : (
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-[11px] font-semibold"
                      style={{ color: meta.color }}
                    >
                      {initials(meta.name)}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-slate-400">
                    <span className="text-sm font-semibold" style={{ color: meta.color }}>
                      {meta.name}
                    </span>
                    {meta.nickname && message.author?.username ? <span className="text-[10px] text-slate-500">@{message.author.username}</span> : null}
                    {message.botId ? (
                      <span className="rounded-[14px] border border-fuchsia-500/40 bg-fuchsia-950/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-fuchsia-200">
                        Bot
                      </span>
                    ) : null}
                    <span className="text-[11px]">{formatTime(message.createdAt)}</span>
                    {message.edited ? <span className="text-[10px] text-slate-500">(edited)</span> : null}
                  </div>

                  {isEditing ? (
                    <div className="mt-1 space-y-2">
                      <textarea
                        value={editDraft}
                        onChange={(event) => setEditDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void submitEdit();
                          }
                          if (event.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                        rows={2}
                        className="w-full rounded-[12px] border border-amber-500/40 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400"
                      />
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <button type="button" onClick={() => void submitEdit()} disabled={savingEdit || !editDraft.trim()} className={iconBtn} title="Save">
                          {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className={iconBtn} title="Cancel">
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <span>Enter to save, Esc to cancel</span>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-sm text-slate-100">{message.content}</p>
                  )}

                  {message.attachments?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {message.attachments.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-[14px] border border-amber-600/40 bg-amber-950/40 px-2 py-1 text-amber-200 hover:bg-amber-900/50"
                        >
                          Attachment
                        </a>
                      ))}
                    </div>
                  ) : null}

                  {reactionGroups.size ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[...reactionGroups.entries()].map(([emoji, entry]) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => onReact(message.id, emoji)}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                            entry.mine
                              ? "border-amber-500/60 bg-amber-950/50 text-amber-100"
                              : "border-slate-700/70 bg-slate-900/80 text-slate-200 hover:border-amber-500/40"
                          }`}
                          title={entry.mine ? "Remove your reaction" : "React"}
                        >
                          <span>{emoji}</span>
                          <span className="text-[11px]">{entry.count}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {!message.optimistic && !isEditing ? (
                <div className="absolute -top-3 right-3 hidden items-center gap-1 rounded-full border border-slate-700/70 bg-slate-950/95 p-1 shadow-lg group-hover:flex">
                  <button type="button" className={iconBtn} title="React" onClick={() => setPickerFor(pickerFor === message.id ? null : message.id)}>
                    <SmilePlus className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className={iconBtn} title="Reply" onClick={() => onReply(message)}>
                    <CornerUpLeft className="h-3.5 w-3.5" />
                  </button>
                  {canEdit ? (
                    <button type="button" className={iconBtn} title="Edit" onClick={() => startEdit(message)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {canDelete ? (
                    confirmDeleteId === message.id ? (
                      <button
                        type="button"
                        className="inline-flex h-7 items-center gap-1 rounded-full border border-rose-500/60 bg-rose-950/60 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-100"
                        onClick={() => {
                          setConfirmDeleteId(null);
                          void onDelete(message.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" /> Confirm
                      </button>
                    ) : (
                      <button type="button" className={iconBtn} title="Delete" onClick={() => setConfirmDeleteId(message.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )
                  ) : null}
                </div>
              ) : null}

              {pickerFor === message.id ? (
                <div className="absolute right-3 top-6 z-20 flex items-center gap-1 rounded-full border border-slate-700/70 bg-slate-950/95 p-1 shadow-xl">
                  {quickReactions.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="h-8 w-8 rounded-full text-lg transition hover:bg-slate-800"
                      onClick={() => {
                        onReact(message.id, emoji);
                        setPickerFor(null);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          </div>
        );
      })}

      {!messages.length ? <p className="text-sm text-slate-500">No messages yet. Start the channel.</p> : null}
      <div ref={bottomRef} />
    </div>
  );
}
