"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { readSuspension, type SuspensionInfo } from "@/lib/suspension";

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
}

/** Shown when Vexora staff have suspended the account that was signed in. */
export default function SuspendedPage() {
  const [info, setInfo] = useState<SuspensionInfo | null>(null);
  useEffect(() => {
    setInfo(readSuspension());
  }, []);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#05030f] px-4 py-10 text-slate-100">
      <main className="w-full max-w-lg rounded-2xl border border-rose-400/25 bg-[#0d0a18] p-6 shadow-[0_0_60px_rgba(244,63,94,0.12)] sm:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-rose-400/40 bg-rose-500/10 text-rose-200">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h1 className="nf-heading mt-4 text-2xl font-bold text-white">Your account is suspended</h1>
        <p className="mt-2 text-sm text-slate-400">
          Vexora staff have suspended this account, so you can&apos;t sign in or use the app while it lasts. We&apos;ve also sent the details to the email address on the account.
        </p>

        {info ? (
          <dl className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Reason</dt>
              <dd className="mt-1 whitespace-pre-wrap text-slate-100">{info.reason}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Ends</dt>
              <dd className="mt-1 text-slate-100">{info.until ? formatDate(info.until) : "When Vexora staff lift it"}</dd>
            </div>
          </dl>
        ) : null}

        <p className="mt-5 text-sm text-slate-400">
          If you think this was a mistake, you can ask us to review it. Our{" "}<Link href="/legal/appeals" className="text-sky-300 underline underline-offset-2 hover:text-sky-200">Appeals Policy</Link>{" "}explains how. Please don&apos;t create a new account in the meantime.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/legal/community-rules" className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-white/25">Community Rules</Link>
          <Link href="/login" className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-white/25">Back to sign in</Link>
        </div>
      </main>
    </div>
  );
}
