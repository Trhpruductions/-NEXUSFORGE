"use client";

import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Bookmark, BookmarkCheck, Flag, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { DmMessage } from "@/lib/api";
import { plainText } from "@/lib/plain-text";
import { useSavedMessages } from "@/components/chat/use-saved";
import { MessageAttachments } from "@/components/chat/message-attachments";
import { firstLink, LinkPreviewCard } from "@/components/chat/link-preview-card";
import { RichText } from "@/components/chat/rich-text";
import { useStableCallback } from "@/lib/use-stable-callback";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "VX";
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type DmActions = {
  setSaved: (messageId: string, saved: boolean) => void;
  report: (message: DmMessage) => void;
  startEdit: (messageId: string) => void;
  cancelEdit: () => void;
  submitEdit: (messageId: string, content: string) => Promise<void>;
  askDelete: (messageId: string | null) => void;
  confirmDelete: (messageId: string) => void;
  toggleActions: (messageId: string) => void;
  closeActions: () => void;
};

/**
 * The messages of one direct conversation. Memoised, with memoised rows: typing in the DM box re-renders the chat page
 * but not this list. Edit and delete state live here, so editing one message re-renders that message only.
 */
export const DmMessageList = memo(function DmMessageList({
  messages,
  selfId,
  onEdit,
  onDelete,
  onReport,
}: {
  messages: DmMessage[];
  selfId: string;
  onEdit: (messageId: string, content: string) => Promise<unknown>;
  onDelete: (messageId: string) => Promise<unknown>;
  onReport: (message: DmMessage) => void;
}) {
  const saved = useSavedMessages();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Touch screens have no hover: the "more" button opens one message's actions at a time.
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!actionsFor) return;
    const doc = rootRef.current?.ownerDocument;
    if (!doc) return;
    const onPointerDown = (event: PointerEvent) => {
      const host = (event.target as Element | null)?.closest?.("[data-message-id]");
      if (host?.getAttribute("data-message-id") !== actionsFor) setActionsFor(null);
    };
    doc.addEventListener("pointerdown", onPointerDown);
    return () => doc.removeEventListener("pointerdown", onPointerDown);
  }, [actionsFor]);

  const setSavedFor = useStableCallback((messageId: string, value: boolean) => saved.setSaved("DM", messageId, value));
  const report = useStableCallback((message: DmMessage) => {
    setActionsFor(null);
    onReport(message);
  });
  const submitEdit = useStableCallback(async (messageId: string, content: string) => {
    await onEdit(messageId, content);
    setEditingId((current) => (current === messageId ? null : current));
  });
  const confirmDelete = useStableCallback((messageId: string) => {
    setDeletingId(messageId);
    onDelete(messageId)
      .then(() => {
        setConfirmDeleteId(null);
        setActionsFor(null);
      })
      // The chat page shows why deleting failed.
      .catch(() => undefined)
      .finally(() => setDeletingId(null));
  });

  const actions = useMemo<DmActions>(
    () => ({
      setSaved: setSavedFor,
      report,
      startEdit: (messageId) => {
        setEditingId(messageId);
        setConfirmDeleteId(null);
        setActionsFor(null);
      },
      cancelEdit: () => setEditingId(null),
      submitEdit,
      askDelete: setConfirmDeleteId,
      confirmDelete,
      toggleActions: (messageId) => setActionsFor((current) => (current === messageId ? null : messageId)),
      closeActions: () => setActionsFor(null),
    }),
    [setSavedFor, report, submitEdit, confirmDelete],
  );

  return (
    <div ref={rootRef} className="space-y-1.5">
      {messages.map((message) => (
        <DmRow
          key={message.id}
          message={message}
          mine={message.authorId === selfId}
          saved={saved.isSaved("DM", message.id)}
          isEditing={editingId === message.id}
          confirmingDelete={confirmDeleteId === message.id}
          deleting={deletingId === message.id}
          actionsOpen={actionsFor === message.id}
          actions={actions}
        />
      ))}
    </div>
  );
});

const actionButton = "rounded p-1 text-slate-400";

const DmRow = memo(function DmRow({
  message,
  mine,
  saved,
  isEditing,
  confirmingDelete,
  deleting,
  actionsOpen,
  actions,
}: {
  message: DmMessage;
  mine: boolean;
  saved: boolean;
  isEditing: boolean;
  confirmingDelete: boolean;
  deleting: boolean;
  actionsOpen: boolean;
  actions: DmActions;
}) {
  const showActions = !(mine && isEditing);
  const toolbarId = `dm-actions-${message.id}`;
  const link = firstLink(message.content);
  const onToolbarKey = (event: ReactKeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (confirmingDelete) actions.askDelete(null);
    else if (actionsOpen) actions.closeActions();
    else return;
    event.preventDefault();
  };
  return (
    <div data-message-id={message.id} className={`group group/message relative flex gap-3 rounded-[14px] px-3 py-2 hover:bg-slate-900/60 ${showActions ? "pointer-coarse:pr-10" : ""}`}>
      {message.author.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={message.author.avatar} alt="" className="h-9 w-9 rounded-full border border-slate-700 object-cover" />
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-[11px] font-semibold text-amber-100">{initials(message.author.username)}</span>
      )}
      <div className="min-w-0">
        <p className="flex items-baseline gap-2 text-xs text-slate-400"><span className="text-sm font-semibold text-white">{message.author.username}</span>{formatTime(message.createdAt)}</p>
        {isEditing ? (
          <DmEditBox messageId={message.id} initial={plainText(message.content)} onSubmit={actions.submitEdit} onCancel={actions.cancelEdit} />
        ) : (
          <>
            {message.attachments?.length && message.content === "Shared a file" ? null : <RichText content={message.content} />}
            {message.edited ? <span className="text-[10px] text-slate-500">(edited)</span> : null}
            {message.attachments?.length ? <MessageAttachments urls={message.attachments} /> : null}
            {!message.attachments?.length && link ? <LinkPreviewCard url={link} /> : null}
          </>
        )}
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
            className={`absolute right-2 top-1 flex items-center gap-1 rounded-lg border border-white/10 bg-[#0d1119] p-0.5 ${
              actionsOpen || confirmingDelete
                ? "opacity-100"
                : "pointer-events-none opacity-0 group-hover/message:pointer-events-auto group-hover/message:opacity-100 group-has-[:focus-visible]/message:pointer-events-auto group-has-[:focus-visible]/message:opacity-100"
            }`}
          >
            <button type="button" title={saved ? "Remove from saved" : "Save for later"} aria-label={saved ? "Remove from saved" : "Save for later"} className={`${actionButton} hover:text-amber-200`} onClick={() => actions.setSaved(message.id, !saved)}>
              {saved ? <BookmarkCheck className="h-3.5 w-3.5 text-amber-300" /> : <Bookmark className="h-3.5 w-3.5" />}
            </button>
            {mine ? (
              <>
                <button type="button" title="Edit" aria-label="Edit message" className={`${actionButton} hover:text-amber-200`} onClick={() => actions.startEdit(message.id)}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {confirmingDelete ? (
                  <button type="button" aria-label="Confirm delete message" className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/20" disabled={deleting} onClick={() => actions.confirmDelete(message.id)}>
                    Delete?
                  </button>
                ) : (
                  <button type="button" title="Delete" aria-label="Delete message" className={`${actionButton} hover:text-rose-300`} onClick={() => actions.askDelete(message.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            ) : (
              <button type="button" title="Report" aria-label="Report message" className={`${actionButton} hover:text-rose-300`} onClick={() => actions.report(message)}>
                <Flag className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
});

/** Editing your own DM. The draft lives here, so typing re-renders only this box. */
function DmEditBox({ messageId, initial, onSubmit, onCancel }: { messageId: string; initial: string; onSubmit: (messageId: string, content: string) => Promise<void>; onCancel: () => void }) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <input
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
          if (event.key === "Enter" && !event.shiftKey && text.trim() && !saving) {
            event.preventDefault();
            setSaving(true);
            // A failed save is shown by the chat page; the edit stays open so nothing is lost.
            onSubmit(messageId, text.trim())
              .catch(() => undefined)
              .finally(() => setSaving(false));
          }
        }}
        maxLength={4000}
        aria-label="Edit message"
        className="h-8 min-w-[200px] flex-1 rounded-lg border border-amber-400/50 bg-[#11151e] px-2 text-sm text-slate-100 outline-none"
      />
      <span className="text-[10px] text-slate-500">Enter to save · Esc to cancel</span>
    </div>
  );
}
