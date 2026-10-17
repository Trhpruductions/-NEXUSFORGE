"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, X } from "lucide-react";
import { listUnseenUpdates, markUpdatesSeen } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { LegalMarkdown } from "@/components/legal/legal-markdown";
import { useAuthStore } from "@/store/auth-store";

function when(value: string | null) {
  return value ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : "";
}

/**
 * "What's new" popup, shown once per new update to everyone signed in. Updates published
 * while someone is online pop up straight away.
 */
export function WhatsNewDialog() {
  const { accessToken, csrfToken } = useAuthStore();
  const queryClient = useQueryClient();
  const key = ["updates-unseen", accessToken];
  const unseen = useQuery({ queryKey: key, queryFn: () => listUnseenUpdates(accessToken!), enabled: Boolean(accessToken), staleTime: 5 * 60_000 });
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    const onNew = () => {
      setDismissed(null);
      void queryClient.invalidateQueries({ queryKey: ["updates-unseen"] });
      void queryClient.invalidateQueries({ queryKey: ["updates"] });
    };
    socket.on("updates:new", onNew);
    return () => {
      socket.off("updates:new", onNew);
    };
  }, [accessToken, queryClient]);

  const updates = unseen.data ?? [];
  const newest = updates[0];
  const open = Boolean(newest && dismissed !== newest.id);

  const close = () => {
    if (!newest) return;
    setDismissed(newest.id);
    queryClient.setQueryData(key, []);
    if (accessToken && csrfToken) void markUpdatesSeen(accessToken, csrfToken).catch(() => undefined);
    void queryClient.invalidateQueries({ queryKey: ["updates"] });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !newest || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1150] flex items-center justify-center p-3">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={close} />
      <div role="dialog" aria-modal="true" aria-labelledby="whats-new-title" className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-violet-400/30 bg-[#0d1119] text-slate-100 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        <header className="border-b border-white/5 bg-[radial-gradient(circle_at_20%_0%,rgba(139,92,246,0.25),transparent_60%)] px-5 pb-4 pt-5">
          <button type="button" onClick={close} className="absolute right-3 top-3 rounded p-1 text-slate-400 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300"><Megaphone className="h-3.5 w-3.5" /> What&apos;s new{newest.version ? ` · ${newest.version}` : ""}</p>
          <h2 id="whats-new-title" className="mt-1 text-xl font-bold text-white">{newest.title}</h2>
          <p className="text-xs text-slate-500">{when(newest.publishedAt)}</p>
        </header>
        <div className="overflow-y-auto px-5 py-4">
          <LegalMarkdown content={newest.body} />
          {updates.length > 1 ? (
            <p className="mt-4 text-xs text-slate-400">
              Plus {updates.length - 1} more update{updates.length === 2 ? "" : "s"} since you were last here.
            </p>
          ) : null}
        </div>
        <footer className="flex gap-2 border-t border-white/5 px-5 py-3">
          <button type="button" onClick={close} className="flex-1 rounded-lg bg-violet-500 px-3 py-2 text-xs font-bold text-white hover:bg-violet-400">Got it</button>
          <Link href="/app/updates" onClick={close} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-white/25">All updates</Link>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
