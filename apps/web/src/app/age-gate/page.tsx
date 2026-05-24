import Link from "next/link";
import { Suspense } from "react";
import { AgeGateClient } from "./age-gate-client";

export default function AgeGatePage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#08101f_38%,_#020617_100%)] text-white">
      <main id="main-content" className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] xl:gap-12">
          <section className="rounded-[44px] border border-amber-500/10 bg-slate-950/85 p-10 shadow-[0_36px_140px_rgba(0,0,0,0.36)] backdrop-blur-xl lg:p-12">
            <div className="max-w-3xl space-y-6">
              <span className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-xs uppercase tracking-[0.32em] text-amber-200">
                One verification gateway
              </span>
              <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">
                NexusForge access is locked behind one 18+ gate.
              </h1>
              <p className="text-lg leading-8 text-slate-300 sm:text-xl">
                No alternate verification routes. No legacy access flows. Verify once here and proceed directly into the secure NexusForge command center.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[28px] border border-slate-700/70 bg-slate-900/90 p-6">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Step 1</p>
                  <p className="mt-3 text-xl font-semibold text-white">Confirm your age</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Use the gate below to complete the secure age verification check.</p>
                </div>
                <div className="rounded-[28px] border border-slate-700/70 bg-slate-900/90 p-6">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Step 2</p>
                  <p className="mt-3 text-xl font-semibold text-white">Enter NexusForge</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Once verified, you will be redirected to the protected app environment.</p>
                </div>
              </div>
              <div className="rounded-[28px] border border-amber-500/30 bg-amber-500/5 p-6 text-slate-200">
                <p className="font-semibold text-amber-100">Important</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  This is the only access path into NexusForge. Any other verification page is deprecated and will not unlock the platform.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[44px] border border-slate-700/70 bg-slate-900/95 p-8 shadow-[0_24px_90px_rgba(15,23,42,0.32)] lg:p-10">
            <div className="mb-8 rounded-[32px] border border-amber-500/15 bg-slate-950/90 p-6">
              <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Verify now</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Unlock NexusForge</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Complete the only age verification check for this platform. The server validates access and then sends you into the secure application.
              </p>
            </div>

            <Suspense fallback={<div className="rounded-[28px] border border-slate-700/70 bg-slate-950/90 p-6 text-sm text-slate-300">Loading secure verification...</div>}>
              <AgeGateClient />
            </Suspense>

            <div className="mt-8 rounded-[28px] border border-slate-700/70 bg-slate-950/90 p-6 text-sm text-slate-300">
              <p className="font-medium text-white">Need help or want details?</p>
              <p className="mt-3 leading-7 text-slate-400">
                Review our policies or contact support if you have questions about the verification requirement.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/support" className="text-amber-300 underline decoration-amber-400/40 underline-offset-4 hover:text-white">
                  Support
                </Link>
                <Link href="/terms" className="text-amber-300 underline decoration-amber-400/40 underline-offset-4 hover:text-white">
                  Terms
                </Link>
                <Link href="/privacy" className="text-amber-300 underline decoration-amber-400/40 underline-offset-4 hover:text-white">
                  Privacy
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
