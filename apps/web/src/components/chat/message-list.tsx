"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Bookmark, BookmarkCheck, Check, CornerUpLeft, Flag, Loader2, MessagesSquare, MoreHorizontal, Pencil, Pin, PinOff, SmilePlus, Trash2, X } from "lucide-react";
import { useSavedMessages } from "@/components/chat/use-saved";
import { UserCard } from "@/components/social/user-card";
import type { ForgeMemberEntry, ForgeRole, Message } from "@/lib/api";
import { topRoleFor } from "@/components/chat/member-list";
import { plainText } from "@/lib/plain-text";
import { hueFor, tileGradient } from "@/lib/colors";
import { MessageAttachments } from "@/components/chat/message-attachments";
import { firstLink, LinkPreviewCard } from "@/components/chat/link-preview-card";
import { CustomEmoji, mentionsReader, RichText, type MentionContext } from "@/components/chat/rich-text";
import { PollCard } from "@/components/chat/poll-card";
import { useStableCallback } from "@/lib/use-stable-callback";

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
  onPin?: (messageId: string, pinned: boolean) => void;
  /** Report someone else's message to the server's moderators. */
  onReport?: (message: Message) => void;
  /** This forge's custom emoji (name -> image URL). */
  emojis?: Record<string, string>;
  /** Start a thread from a message, or open the one it already has. */
  onStartThread?: (message: Message) => void;
  onOpenThread?: (threadId: string) => void;
  /** When the reader last read this channel; draws a "New messages" line before anything newer. */
  lastReadAt?: string | null;
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

const CUSTOM_EMOJI = /^:[a-z0-9_]{2,30}:$/;

/** Everything a row can do. One object for the whole list whose functions never change, so rows can be memoised. */
type RowActions = {
  react: (messageId: string, emoji: string) => void;
  pickReaction: (messageId: string, emoji: string) => void;
  togglePicker: (messageId: string) => void;
  closePicker: () => void;
  toggleCard: (messageId: string) => void;
  closeCard: () => void;
  toggleActions: (messageId: string) => void;
  closeActions: () => void;
  reply: (message: Message) => void;
  setSaved: (messageId: string, saved: boolean) => void;
  pin: (messageId: string, pinned: boolean) => void;
  thread: (message: Message) => void;
  openThread: (threadId: string) => void;
  report: (message: Message) => void;
  startEdit: (messageId: string) => void;
  cancelEdit: () => void;
  submitEdit: (messageId: string, content: string) => Promise<void>;
  askDelete: (messageId: string | null) => void;
  confirmDelete: (messageId: string) => void;
  nameOf: (userId: string) => string;
};

/**
 * The channel's messages. Not virtualised, so the work per render matters: each row is memoised and gets only stable
 * props (the message, booleans for its own open menus, and one shared actions object), so typing in the composer,
 * someone else typing, or opening one message's menu re-renders that row only, not every row and its rich text.
 */
export const MessageList = memo(function MessageList({
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
  onPin,
  onReport,
  onStartThread,
  onOpenThread,
  emojis,
  lastReadAt,
}: MessageListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [cardFor, setCardFor] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Touch screens have no hover: the "more" button opens one message's actions at a time.
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastMessageId = messages[messages.length - 1]?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lastMessageId]);

  // Actions opened from the "more" button close when you tap anywhere outside that message.
  useEffect(() => {
    if (!actionsFor) return;
    const doc = bottomRef.current?.ownerDocument;
    if (!doc) return;
    const onPointerDown = (event: PointerEvent) => {
      const host = (event.target as Element | null)?.closest?.("[data-message-id]");
      if (host?.getAttribute("data-message-id") !== actionsFor) setActionsFor(null);
    };
    doc.addEventListener("pointerdown", onPointerDown);
    return () => doc.removeEventListener("pointerdown", onPointerDown);
  }, [actionsFor]);

  const saved = useSavedMessages();
  const memberByUserId = useMemo(() => new Map(members.map((member) => [member.userId, member] as const)), [members]);

  // For mention pills and highlighting: who's reading, the forge's roles, and id -> name.
  const mentionContext = useMemo<MentionContext & { selfRoleNames: string[] }>(() => {
    const self = memberByUserId.get(selfId);
    const roleNameById = new Map(roles.map((role) => [role.id, role.name] as const));
    return {
      selfUsername: self?.user.username ?? null,
      roleNames: roles.map((role) => role.name),
      usernamesById: Object.fromEntries(members.map((member) => [member.userId, member.user.username])),
      selfRoleNames: (self?.roleLinks ?? []).map((link) => roleNameById.get(link.roleId)).filter((name): name is string => Boolean(name)),
      emojis,
    };
  }, [memberByUserId, members, roles, selfId, emojis]);

  // First message from someone else that arrived after the last read: the "New" line goes above it.
  const firstUnreadId = useMemo(() => {
    if (!lastReadAt) return null;
    const cutoff = new Date(lastReadAt).getTime();
    return messages.find((message) => message.authorId !== selfId && !message.optimistic && new Date(message.createdAt).getTime() > cutoff)?.id ?? null;
  }, [lastReadAt, messages, selfId]);

  const days = useMemo(() => messages.map((message) => formatDay(message.createdAt)), [messages]);

  const nameOf = useCallback(
    (userId: string) => {
      const member = memberByUserId.get(userId);
      return member?.nickname || member?.user.username || "Former member";
    },
    [memberByUserId],
  );

  const react = useStableCallback((messageId: string, emoji: string) => onReact(messageId, emoji));
  const pickReaction = useStableCallback((messageId: string, emoji: string) => {
    setPickerFor(null);
    setActionsFor(null);
    onReact(messageId, emoji);
  });
  const reply = useStableCallback((message: Message) => {
    setActionsFor(null);
    onReply(message);
  });
  const setSavedFor = useStableCallback((messageId: string, value: boolean) => saved.setSaved("CHANNEL", messageId, value));
  const pin = useStableCallback((messageId: string, pinned: boolean) => {
    setActionsFor(null);
    onPin?.(messageId, pinned);
  });
  const thread = useStableCallback((message: Message) => {
    setActionsFor(null);
    if (message.startedThread && onOpenThread) onOpenThread(message.startedThread.id);
    else onStartThread?.(message);
  });
  const openThread = useStableCallback((threadId: string) => onOpenThread?.(threadId));
  const report = useStableCallback((message: Message) => {
    setActionsFor(null);
    onReport?.(message);
  });
  const submitEdit = useStableCallback(async (messageId: string, content: string) => {
    await onEdit(messageId, content);
    setEditingId((current) => (current === messageId ? null : current));
  });
  const confirmDelete = useStableCallback((messageId: string) => {
    setConfirmDeleteId(null);
    setActionsFor(null);
    // A failed delete is shown by the chat page; nothing to undo here.
    void onDelete(messageId).catch(() => undefined);
  });

  const actions = useMemo<RowActions>(
    () => ({
      react,
      pickReaction,
      togglePicker: (messageId) => setPickerFor((current) => (current === messageId ? null : messageId)),
      closePicker: () => setPickerFor(null),
      toggleCard: (messageId) => setCardFor((current) => (current === messageId ? null : messageId)),
      closeCard: () => setCardFor(null),
      toggleActions: (messageId) => setActionsFor((current) => (current === messageId ? null : messageId)),
      closeActions: () => setActionsFor(null),
      reply,
      setSaved: setSavedFor,
      pin,
      thread,
      openThread,
      report,
      startEdit: (messageId) => {
        setEditingId(messageId);
        setPickerFor(null);
        setConfirmDeleteId(null);
        setActionsFor(null);
      },
      cancelEdit: () => setEditingId(null),
      submitEdit,
      askDelete: setConfirmDeleteId,
      confirmDelete,
      nameOf,
    }),
    [react, pickReaction, reply, setSavedFor, pin, thread, openThread, report, submitEdit, confirmDelete, nameOf],
  );

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

      {messages.map((message, index) => (
        <MessageRow
          key={message.id}
          message={message}
          dayLabel={index === 0 || days[index] !== days[index - 1] ? days[index] : null}
          newLine={message.id === firstUnreadId}
          selfId={selfId}
          canModerate={canModerate}
          member={message.authorId ? memberByUserId.get(message.authorId) : undefined}
          roles={roles}
          ownerId={ownerId}
          mentionContext={mentionContext}
          emojis={emojis}
          saved={saved.isSaved("CHANNEL", message.id)}
          isEditing={editingId === message.id}
          pickerOpen={pickerFor === message.id}
          cardOpen={cardFor === message.id}
          confirmingDelete={confirmDeleteId === message.id}
          actionsOpen={actionsFor === message.id}
          canPin={Boolean(canModerate && onPin)}
          canThread={Boolean(onStartThread)}
          canReport={Boolean(onReport)}
          actions={actions}
        />
      ))}

      {!messages.length ? <p className="text-sm text-slate-500">No messages yet. Say hello and start the conversation.</p> : null}
      <div ref={bottomRef} />
    </div>
  );
});

type MessageRowProps = {
  message: Message;
  /** Set when a day separator goes above this message. */
  dayLabel: string | null;
  /** The "New" line goes above this message. */
  newLine: boolean;
  selfId: string;
  canModerate: boolean;
  member: ForgeMemberEntry | undefined;
  roles: ForgeRole[];
  ownerId: string;
  mentionContext: MentionContext & { selfRoleNames: string[] };
  emojis?: Record<string, string>;
  saved: boolean;
  isEditing: boolean;
  pickerOpen: boolean;
  cardOpen: boolean;
  confirmingDelete: boolean;
  actionsOpen: boolean;
  canPin: boolean;
  canThread: boolean;
  canReport: boolean;
  actions: RowActions;
};

function authorMeta(message: Message, member: ForgeMemberEntry | undefined, roles: ForgeRole[], ownerId: string) {
  if (message.botId) return { name: message.botName ?? "Bot", color: "#e879f9", nickname: null as string | null };
  if (message.webhookId) return { name: message.botName ?? "Webhook", color: "#7dd3fc", nickname: null as string | null };
  const top = member ? topRoleFor(member, roles, ownerId) : null;
  // Role color when they have one; otherwise everyone still gets their own color.
  return {
    name: member?.nickname || message.author?.username || "Unknown",
    color: top?.color ?? hueFor(message.authorId).light,
    nickname: member?.nickname ?? null,
  };
}

function reactionLabel(emoji: string, count: number, mine: boolean) {
  return `${emoji} ${count} ${count === 1 ? "reaction" : "reactions"}${mine ? ", including yours. Press to remove yours" : ". Press to add yours"}`;
}

/**
 * One message. Its actions (react, reply, save, pin, thread, report, edit, delete) show on hover, when anything in
 * the message has keyboard focus (so Tab reaches them), and on touch screens from the "more" button. Hidden actions
 * stay in the page (transparent, not display:none) so Tab and screen readers can always reach them.
 */
const MessageRow = memo(function MessageRow({
  message,
  dayLabel,
  newLine,
  selfId,
  canModerate,
  member,
  roles,
  ownerId,
  mentionContext,
  emojis,
  saved,
  isEditing,
  pickerOpen,
  cardOpen,
  confirmingDelete,
  actionsOpen,
  canPin,
  canThread,
  canReport,
  actions,
}: MessageRowProps) {
  const meta = authorMeta(message, member, roles, ownerId);
  const isSelf = message.authorId === selfId;
  // Polls can't be edited: people may already have voted on the question.
  const canEdit = isSelf && !message.botId && !message.poll && !message.sticker;
  const canDelete = (isSelf || canModerate) && !message.optimistic;
  const showActions = !message.optimistic && !isEditing;
  const link = firstLink(message.content);
  const reactButton = useRef<HTMLButtonElement | null>(null);
  const editButton = useRef<HTMLButtonElement | null>(null);
  const picker = useRef<HTMLDivElement | null>(null);

  const reactionGroups = new Map<string, { count: number; mine: boolean }>();
  for (const reaction of message.reactions ?? []) {
    const entry = reactionGroups.get(reaction.emoji) ?? { count: 0, mine: false };
    entry.count += 1;
    if (reaction.userId === selfId) entry.mine = true;
    reactionGroups.set(reaction.emoji, entry);
  }

  // The emoji picker takes focus when it opens, so the keyboard can pick straight away.
  useEffect(() => {
    if (pickerOpen) picker.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [pickerOpen]);

  // Finishing an edit removes the edit box; give focus back to the Edit button instead of dropping it on the page.
  const wasEditing = useRef(isEditing);
  useEffect(() => {
    const ended = wasEditing.current && !isEditing;
    wasEditing.current = isEditing;
    const button = editButton.current;
    if (!ended || !button) return;
    const active = button.ownerDocument.activeElement;
    if (!active || active === button.ownerDocument.body) button.focus();
  }, [isEditing]);

  const pick = (emoji: string) => {
    actions.pickReaction(message.id, emoji);
    reactButton.current?.focus();
  };
  const onToolbarKey = (event: ReactKeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (confirmingDelete) actions.askDelete(null);
    else if (actionsOpen) actions.closeActions();
    else return;
    event.preventDefault();
  };
  const onPickerKey = (event: ReactKeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    actions.closePicker();
    reactButton.current?.focus();
  };

  const toolbarVisible = actionsOpen || confirmingDelete || pickerOpen;
  const toolbarId = `message-actions-${message.id}`;

  return (
    <div>
      {newLine ? (
        <div className="my-2 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-400" role="separator" aria-label="New messages">
          <span className="h-px flex-1 bg-rose-500/60" />
          New
        </div>
      ) : null}
      {dayLabel ? (
        <div className="my-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em]">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-500/40 to-violet-500/60" />
          <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-0.5 text-violet-200">{dayLabel}</span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent via-cyan-500/40 to-cyan-500/60" />
        </div>
      ) : null}

      <article
        data-message-id={message.id}
        className={`nf-message group group/message relative rounded-[14px] border px-3 py-2 transition ${showActions ? "pointer-coarse:pr-10" : ""} ${
          message.optimistic
            ? "border-dashed border-amber-600/60 bg-amber-950/20"
            : !isSelf && mentionsReader(message.content, mentionContext)
              ? "border-transparent border-l-amber-400 bg-amber-500/[0.07] hover:bg-amber-500/10"
              : "border-transparent hover:border-slate-700/70 hover:bg-slate-900/60"
        }`}
      >
        {message.replyTo ? (
          <div className="mb-1 flex items-center gap-1.5 truncate text-[11px] text-slate-400">
            <CornerUpLeft className="h-3 w-3 shrink-0 text-slate-500" />
            <span className="shrink-0 font-semibold text-slate-300">
              {message.replyTo.botName ?? message.replyTo.author?.username ?? "someone"}
            </span>
            <span className="truncate">{plainText(message.replyTo.content)}</span>
          </div>
        ) : null}

        <div className="flex gap-3">
          <div className="nf-message-avatar mt-0.5 shrink-0">
            {message.botAvatar || message.author?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={message.botAvatar ?? message.author?.avatar ?? ""} alt="" className="h-9 w-9 rounded-full border border-slate-700 object-cover" />
            ) : (
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-slate-950 shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
                style={{ background: message.botId ? tileGradient(hueFor("bot")) : message.webhookId ? tileGradient(hueFor(message.webhookId)) : tileGradient(hueFor(message.authorId)) }}
              >
                {initials(meta.name)}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-slate-400">
              {message.pinnedAt ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300"><Pin className="h-3 w-3" /> Pinned</span> : null}
              <span className="relative">
                <button
                  type="button"
                  onClick={() => message.authorId && actions.toggleCard(message.id)}
                  aria-expanded={message.authorId ? cardOpen : undefined}
                  className="text-sm font-semibold hover:underline"
                  style={{ color: meta.color }}
                >
                  {meta.name}
                </button>
                {cardOpen && message.authorId ? <UserCard userId={message.authorId} onClose={actions.closeCard} /> : null}
              </span>
              {meta.nickname && message.author?.username ? <span className="text-[10px] text-slate-500">@{message.author.username}</span> : null}
              {message.botId ? (
                <span className="rounded-[14px] border border-fuchsia-500/40 bg-fuchsia-950/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-fuchsia-200">
                  Bot
                </span>
              ) : message.webhookId ? (
                <span className="rounded-[14px] border border-sky-500/40 bg-sky-950/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-sky-200">
                  Webhook
                </span>
              ) : null}
              <span className="text-[11px]">{formatTime(message.createdAt)}</span>
              {message.edited ? <span className="text-[10px] text-slate-500">(edited)</span> : null}
            </div>

            {isEditing ? (
              <EditBox messageId={message.id} initial={plainText(message.content)} onSubmit={actions.submitEdit} onCancel={actions.cancelEdit} />
            ) : message.sticker ? (
              <div className="mt-1">
                {message.content.trim() ? <RichText content={message.content} context={mentionContext} /> : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={message.sticker.imageUrl} alt={`Sticker: ${message.sticker.name}`} title={message.sticker.name} className="h-40 w-40 object-contain" style={{ display: "block" }} />
              </div>
            ) : message.poll ? (
              <PollCard message={message} selfId={selfId} canModerate={canModerate} nameOf={actions.nameOf} />
            ) : (
              <RichText content={message.content} context={mentionContext} />
            )}

            {message.attachments?.length ? <MessageAttachments urls={message.attachments} /> : null}
            {!message.optimistic && !isEditing && !message.poll && !message.attachments?.length && link ? <LinkPreviewCard url={link} /> : null}
            {message.startedThread ? (
              <button
                type="button"
                onClick={() => actions.openThread(message.startedThread!.id)}
                className="mt-1.5 inline-flex max-w-full items-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-100 transition hover:border-violet-300/60"
              >
                <MessagesSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate font-semibold">{message.startedThread.title}</span>
                <span className="shrink-0 text-violet-300/80">
                  {message.startedThread.messageCount} repl{message.startedThread.messageCount === 1 ? "y" : "ies"}
                  {message.startedThread.archived ? " · archived" : ""}
                </span>
              </button>
            ) : null}

            {reactionGroups.size ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[...reactionGroups.entries()].map(([emoji, entry]) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => actions.react(message.id, emoji)}
                    aria-pressed={entry.mine}
                    aria-label={reactionLabel(emoji, entry.count, entry.mine)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                      entry.mine
                        ? "border-amber-500/60 bg-amber-950/50 text-amber-100"
                        : "border-slate-700/70 bg-slate-900/80 text-slate-200 hover:border-amber-500/40"
                    }`}
                    title={entry.mine ? "Remove your reaction" : "React"}
                  >
                    <span>{CUSTOM_EMOJI.test(emoji) ? <CustomEmoji name={emoji.slice(1, -1)} emojis={emojis} size={16} /> : emoji}</span>
                    <span className="text-[11px]">{entry.count}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {showActions ? (
          <>
            {/* Touch screens: no hover, so this opens the actions. Hidden where a mouse can hover. */}
            <button
              type="button"
              onClick={() => actions.toggleActions(message.id)}
              aria-label="Message actions"
              aria-expanded={actionsOpen}
              aria-controls={toolbarId}
              className="absolute right-1.5 top-1.5 hidden h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:text-amber-100 pointer-coarse:inline-flex"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            <div
              id={toolbarId}
              role="group"
              aria-label="Message actions"
              onKeyDown={onToolbarKey}
              className={`absolute -top-3 right-3 flex items-center gap-1 rounded-full border border-slate-700/70 bg-slate-950/95 p-1 shadow-lg ${
                toolbarVisible
                  ? "opacity-100"
                  : "pointer-events-none opacity-0 group-hover/message:pointer-events-auto group-hover/message:opacity-100 group-has-[:focus-visible]/message:pointer-events-auto group-has-[:focus-visible]/message:opacity-100"
              }`}
            >
              <button ref={reactButton} type="button" className={iconBtn} title="React" aria-label="Add reaction" aria-expanded={pickerOpen} onClick={() => actions.togglePicker(message.id)}>
                <SmilePlus className="h-3.5 w-3.5" />
              </button>
              <button type="button" className={iconBtn} title="Reply" aria-label="Reply" onClick={() => actions.reply(message)}>
                <CornerUpLeft className="h-3.5 w-3.5" />
              </button>
              {saved ? (
                <button type="button" className={iconBtn} title="Remove from saved" aria-label="Remove from saved" onClick={() => actions.setSaved(message.id, false)}>
                  <BookmarkCheck className="h-3.5 w-3.5 text-amber-300" />
                </button>
              ) : (
                <button type="button" className={iconBtn} title="Save for later" aria-label="Save for later" onClick={() => actions.setSaved(message.id, true)}>
                  <Bookmark className="h-3.5 w-3.5" />
                </button>
              )}
              {canPin ? (
                <button type="button" className={iconBtn} title={message.pinnedAt ? "Unpin" : "Pin"} aria-label={message.pinnedAt ? "Unpin message" : "Pin message"} onClick={() => actions.pin(message.id, !message.pinnedAt)}>
                  {message.pinnedAt ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </button>
              ) : null}
              {canThread && !message.threadId ? (
                <button
                  type="button"
                  className={iconBtn}
                  title={message.startedThread ? "Open thread" : "Create thread"}
                  aria-label={message.startedThread ? "Open thread" : "Create thread"}
                  onClick={() => actions.thread(message)}
                >
                  <MessagesSquare className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {canReport && message.authorId && message.authorId !== selfId ? (
                <button type="button" className={iconBtn} title="Report" aria-label="Report message" onClick={() => actions.report(message)}>
                  <Flag className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {canEdit ? (
                <button ref={editButton} type="button" className={iconBtn} title="Edit" aria-label="Edit message" onClick={() => actions.startEdit(message.id)}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {canDelete ? (
                confirmingDelete ? (
                  <button
                    type="button"
                    aria-label="Confirm delete message"
                    className="inline-flex h-7 items-center gap-1 rounded-full border border-rose-500/60 bg-rose-950/60 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-100"
                    onClick={() => actions.confirmDelete(message.id)}
                  >
                    <Trash2 className="h-3 w-3" /> Confirm
                  </button>
                ) : (
                  <button type="button" className={iconBtn} title="Delete" aria-label="Delete message" onClick={() => actions.askDelete(message.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )
              ) : null}
            </div>
          </>
        ) : null}

        {pickerOpen ? (
          <div ref={picker} role="group" aria-label="Pick a reaction" onKeyDown={onPickerKey} className="absolute right-3 top-6 z-20 flex items-center gap-1 rounded-full border border-slate-700/70 bg-slate-950/95 p-1 shadow-xl">
            {quickReactions.map((emoji) => (
              <button key={emoji} type="button" aria-label={`React with ${emoji}`} className="h-8 w-8 rounded-full text-lg transition hover:bg-slate-800" onClick={() => pick(emoji)}>
                {emoji}
              </button>
            ))}
            {Object.keys(emojis ?? {}).slice(0, 12).map((name) => (
              <button
                key={name}
                type="button"
                title={`:${name}:`}
                aria-label={`React with :${name}:`}
                className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-slate-800"
                onClick={() => pick(`:${name}:`)}
              >
                <CustomEmoji name={name} emojis={emojis} size={20} />
              </button>
            ))}
          </div>
        ) : null}
      </article>
    </div>
  );
});

/** Editing a message. The draft lives here, so typing in it re-renders only this box. */
function EditBox({ messageId, initial, onSubmit, onCancel }: { messageId: string; initial: string; onSubmit: (messageId: string, content: string) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    try {
      await onSubmit(messageId, draft.trim());
    } catch {
      // The chat page shows why saving failed; the edit stays open so nothing is lost.
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="mt-1 space-y-2">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void submit();
          }
          if (event.key === "Escape") onCancel();
        }}
        autoFocus
        rows={2}
        aria-label="Edit message"
        className="w-full rounded-[12px] border border-amber-500/40 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400"
      />
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <button type="button" onClick={() => void submit()} disabled={saving || !draft.trim()} className={iconBtn} title="Save" aria-label="Save edit">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </button>
        <button type="button" onClick={onCancel} className={iconBtn} title="Cancel" aria-label="Cancel edit">
          <X className="h-3.5 w-3.5" />
        </button>
        <span>Enter to save, Esc to cancel</span>
      </div>
    </div>
  );
}
