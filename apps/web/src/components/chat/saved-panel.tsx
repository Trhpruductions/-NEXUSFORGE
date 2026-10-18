"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, BookmarkX, Hash, Loader2, MessageSquare, Paperclip, X } from "lucide-react";
import { listSaved, type SavedItem } from "@/lib/api";
import { plainText } from "@/lib/plain-text";
import { useAuthStore } from "@/store/auth-store";
import { useSavedMessages } from "@/components/chat/use-saved";

function when(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** "Saved messages": everything you saved for later, newest first. Only you see this. */
export function SavedPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const saved = useSavedMessages();
  const query = useQuery({ queryKey: ["saved-list", accessToken], queryFn: () => listSaved(accessToken!), enabled: Boolean(accessToken && open) });

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const jump = (item: SavedItem) => {
    onClose();
    if (item.kind === "DM" && item.where.dmThreadId) router.push(`/app/chat?dm=${item.where.dmThreadId}`);
    else if (item.where.forgeId && item.where.channelId) router.push(`/app/chat?forge=${item.where.forgeId}&channel=${item.where.channelId}`);
  };

  const items = (query.data?.items ?? []).filter((item) => saved.isSaved(item.kind, item.message.id));

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-start justify-center p-3 pt-[8vh]">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="saved-title" className="relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1119] text-slate-100 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <header className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
          <div>
            <h2 id="saved-title" className="flex items-center gap-2 text-sm font-semibold"><Bookmark className="h-4 w-4 text-amber-300" /> Saved messages</h2>
            <p className="text-[11px] text-slate-400">Only you can see what you&apos;ve saved.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
        </header>
        <div className="overflow-y-auto p-2">
          {query.isLoading ? (
            <p className="flex items-center gap-2 p-4 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
          ) : !items.length ? (
            <div className="p-6 text-center text-sm text-slate-400">
              <Bookmark className="mx-auto mb-2 h-6 w-6 text-slate-600" />
              Nothing saved yet. Hover a message and press the bookmark to save it for later.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li key={item.id} className="group rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:border-amber-400/30">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    {item.kind === "DM" ? <MessageSquare className="h-3 w-3" /> : <Hash className="h-3 w-3" />}
                    <span className="truncate">{item.kind === "DM" ? item.where.label : `${item.where.forgeName} · #${item.where.channelName}${item.where.threadId ? " (thread)" : ""}`}</span>
                    <span className="ml-auto shrink-0">{when(item.message.createdAt)}</span>
                  </div>
                  <button type="button" onClick={() => jump(item)} className="mt-1 block w-full text-left">
                    <span className="text-xs font-semibold text-amber-100">{item.message.author?.username ?? "Deleted user"}</span>
                    <span className="mt-0.5 line-clamp-3 block whitespace-pre-wrap break-words text-sm text-slate-200">{plainText(item.message.content)}</span>
                    {item.message.attachments ? <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500"><Paperclip className="h-3 w-3" /> {item.message.attachments} attachment{item.message.attachments === 1 ? "" : "s"}</span> : null}
                  </button>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => jump(item)} className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-200 hover:border-amber-400/40">Go to conversation</button>
                    <button type="button" onClick={() => saved.setSaved(item.kind, item.message.id, false)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-rose-500/10 hover:text-rose-200"><BookmarkX className="h-3 w-3" /> Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
