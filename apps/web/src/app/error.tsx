"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RefreshCcw, TriangleAlert } from "lucide-react";
import { reportClientError } from "@/lib/report-error";

/** Shown when a page crashes. Tells staff automatically; the person can retry or go home. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    reportClientError(error, "Page crashed");
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#040812] px-4 py-10 text-slate-100">
      <main id="main-content" className="w-full max-w-md rounded-2xl border border-amber-400/25 bg-[#0d0a18] p-6 shadow-[0_0_60px_rgba(30,139,255,0.1)] sm:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/10 text-amber-200">
          <TriangleAlert className="h-6 w-6" />
        </span>
        <h1 className="nf-heading mt-4 text-2xl font-bold text-white">Something broke on this page</h1>
        <p className="mt-2 text-sm text-slate-400">
          It&apos;s not you. We&apos;ve been told about it automatically. Try again, and if it keeps happening, head home and come back in a bit.
        </p>
        {error.digest ? <p className="mt-3 text-xs text-slate-500">Reference: {error.digest}</p> : null}
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={() => reset()} className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300">
            <RefreshCcw className="h-4 w-4" /> Try again
          </button>
          <Link href="/app" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:border-white/25">
            <Home className="h-4 w-4" /> Go home
          </Link>
        </div>
      </main>
    </div>
  );
}
