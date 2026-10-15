"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Compass, Link2, UserPlus, X } from "lucide-react";

const STORAGE_KEY = "nf-get-started-dismissed";

/**
 * A small, dismissible card that suggests the next useful step: add friends, invite someone to a server, or
 * find a community. It appears a few seconds after a page loads, and "Don't show again" remembers the choice.
 */
export function GetStartedPanel({ inviteCode, hidden }: { inviteCode: string | null; hidden: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Private browsing can block storage; the card still shows, just not remembered.
    }
    if (dismissed) return;
    const timer = window.setTimeout(() => setOpen(true), 6000);
    return () => window.clearTimeout(timer);
  }, []);

  const close = (forever: boolean) => {
    setOpen(false);
    if (!forever) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Nothing else to do; the card stays closed for this visit.
    }
  };

  const copyInvite = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${inviteCode}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  if (!open || hidden) return null;

  const actionClass = "flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-sm text-slate-100 transition hover:border-amber-400/50 hover:bg-white/[0.06]";

  return (
    <aside
      aria-label="Get started"
      className="fixed bottom-4 right-4 z-40 hidden w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-amber-400/25 bg-[#0d1119]/95 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:block"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Make it yours</p>
          <p className="mt-0.5 text-[12px] text-slate-400">Bring your squad in. It only takes a minute.</p>
        </div>
        <button type="button" onClick={() => close(false)} aria-label="Close" className="rounded-md p-1 text-slate-500 transition hover:bg-white/5 hover:text-slate-200">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        <Link href="/app/friends" onClick={() => close(false)} className={actionClass}>
          <UserPlus className="h-4 w-4 text-amber-300" />
          <span className="flex-1">Add your friends</span>
        </Link>
        {inviteCode ? (
          <button type="button" onClick={() => void copyInvite()} className={actionClass}>
            <Link2 className="h-4 w-4 text-sky-300" />
            <span className="flex-1">{copied ? "Invite link copied" : "Copy an invite link for this server"}</span>
          </button>
        ) : null}
        <Link href="/app/discover" onClick={() => close(false)} className={actionClass}>
          <Compass className="h-4 w-4 text-emerald-300" />
          <span className="flex-1">Find a community to join</span>
        </Link>
      </div>

      <div className="mt-3 flex justify-end">
        <button type="button" onClick={() => close(true)} className="text-[11px] uppercase tracking-[0.14em] text-slate-500 transition hover:text-slate-300">
          Don&apos;t show this again
        </button>
      </div>
    </aside>
  );
}
