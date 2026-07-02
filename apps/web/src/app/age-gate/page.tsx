import Link from "next/link";
import { Suspense } from "react";
import { AgeGateClient } from "./age-gate-client";

export default function AgeGatePage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.16),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#f1f5f9_46%,_#e2e8f0_100%)] text-slate-900">
      <main id="main-content" className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] xl:gap-12">
          <section className="rounded-[32px] border border-slate-900/10 bg-white/88 p-10 shadow-[0_30px_100px_rgba(15,23,42,0.1)] backdrop-blur-xl lg:p-12">
            <div className="max-w-3xl space-y-6">
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs uppercase tracking-[0.32em] text-amber-700">
                One verification gateway
              </span>
              <h1 className="text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                NexusForge access is locked behind one 18+ gate.
              </h1>
              <p className="text-lg leading-8 text-slate-600 sm:text-xl">
                No alternate verification routes. No legacy access flows. Verify once here and proceed directly into the secure NexusForge workspace.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] border border-slate-900/10 bg-slate-50 p-6">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Step 1</p>
                  <p className="mt-3 text-xl font-semibold text-slate-950">Confirm your age</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Use the gate below to complete the secure age verification check.</p>
                </div>
                <div className="rounded-[24px] border border-slate-900/10 bg-slate-50 p-6">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Step 2</p>
                  <p className="mt-3 text-xl font-semibold text-slate-950">Enter NexusForge</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Once verified, you will be redirected to the protected app environment.</p>
                </div>
              </div>
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-6 text-slate-700">
                <p className="font-semibold text-amber-800">Important</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  This is the only access path into NexusForge. Any other verification page is deprecated and will not unlock the platform.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-900/10 bg-white/88 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] lg:p-10">
            <div className="mb-8 rounded-[24px] border border-amber-200 bg-amber-50 p-6">
              <p className="text-xs uppercase tracking-[0.32em] text-amber-700">Verify now</p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950">Unlock NexusForge</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Complete the only age verification check for this platform. The server validates access and then sends you into the secure application.
              </p>
            </div>

            <Suspense fallback={<div className="rounded-[24px] border border-slate-900/10 bg-slate-50 p-6 text-sm text-slate-600">Loading secure verification...</div>}>
              <AgeGateClient />
            </Suspense>

            <div className="mt-8 rounded-[24px] border border-slate-900/10 bg-slate-50 p-6 text-sm text-slate-600">
              <p className="font-medium text-slate-950">Need help or want details?</p>
              <p className="mt-3 leading-7 text-slate-500">
                Review our policies or contact support if you have questions about the verification requirement.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/support" className="text-amber-700 underline decoration-amber-300/60 underline-offset-4 hover:text-slate-950">
                  Support
                </Link>
                <Link href="/terms" className="text-amber-700 underline decoration-amber-300/60 underline-offset-4 hover:text-slate-950">
                  Terms
                </Link>
                <Link href="/privacy" className="text-amber-700 underline decoration-amber-300/60 underline-offset-4 hover:text-slate-950">
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

