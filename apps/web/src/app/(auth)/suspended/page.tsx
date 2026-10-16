"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { VacAppealForm } from "@/components/auth/vac-appeal-form";
import { markSuspensionAppealed, readSuspension, type SuspensionInfo } from "@/lib/suspension";

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
}

const categoryWording: Record<string, string> = {
  SCAM: "scams or phishing",
  HARASSMENT: "harassment",
  SPAM: "spam",
  EXPLOIT: "exploiting the app",
  OTHER: "other violations of our rules",
};

/** Shown when Nexus Forge staff have suspended the account, or banned it, that was signed in. */
export default function SuspendedPage() {
  const [info, setInfo] = useState<SuspensionInfo | null>(null);
  useEffect(() => {
    setInfo(readSuspension());
  }, []);

  const isBan = info?.kind === "VAC";

  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-[#040812] text-slate-100">
      <div className="flex min-h-full items-center justify-center px-4 py-10">
        <main id="main-content" className="w-full max-w-lg rounded-2xl border border-rose-400/25 bg-[#0d0a18] p-6 shadow-[0_0_60px_rgba(244,63,94,0.12)] sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-rose-400/40 bg-rose-500/10 text-rose-200">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </span>

          {isBan ? (
            <>
              <h1 className="nf-heading mt-4 text-2xl font-bold text-white">Your account is banned</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Nexus Forge staff have banned this account
                {info?.category && categoryWording[info.category] ? ` for ${categoryWording[info.category]}` : ""}. You can&apos;t sign in or use the app while the ban lasts. We&apos;ve also sent the details to the email address on the account.
              </p>
              {info ? (
                <dl className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Reason</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-slate-100">{info.reason}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Ends</dt>
                    <dd className="mt-1 text-slate-100">{info.until ? formatDate(info.until) : "When Nexus Forge staff review it"}</dd>
                  </div>
                </dl>
              ) : null}
              {info?.appealed ? (
                <p role="status" className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  Your appeal has been sent to our team. We reply by email.
                </p>
              ) : (
                <VacAppealForm onSent={() => setInfo(markSuspensionAppealed())} />
              )}
            </>
          ) : (
            <>
              <h1 className="nf-heading mt-4 text-2xl font-bold text-white">Your account is suspended</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Nexus Forge staff have suspended this account, so you can&apos;t sign in or use the app while it lasts. We&apos;ve also sent the details to the email address on the account.
              </p>

              {info ? (
                <dl className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Reason</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-slate-100">{info.reason}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Ends</dt>
                    <dd className="mt-1 text-slate-100">{info.until ? formatDate(info.until) : "When Nexus Forge staff lift it"}</dd>
                  </div>
                </dl>
              ) : null}

              <p className="mt-5 text-sm leading-relaxed text-slate-300">
                If you think this was a mistake, you can ask us to review it. Our{" "}
                <Link href="/legal/appeals" className="text-sky-300 underline underline-offset-2 hover:text-sky-200">
                  Appeals Policy
                </Link>{" "}
                explains how. Please don&apos;t create a new account in the meantime.
              </p>
            </>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/legal/community-rules" className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-4 text-xs font-semibold text-slate-100 transition hover:border-white/30">
              Community Rules
            </Link>
            <Link href="/login" className="inline-flex min-h-11 items-center rounded-lg border border-white/15 px-4 text-xs font-semibold text-slate-100 transition hover:border-white/30">
              Back to sign in
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
