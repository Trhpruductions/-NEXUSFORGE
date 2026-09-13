import Link from "next/link";
import { Suspense } from "react";
import { AgeGateClient } from "./age-gate-client";

export default function AgeGatePage() {
  return (
    <div className="min-h-screen bg-[#070a10] bg-[radial-gradient(circle_at_top,rgba(230,179,37,0.16),transparent_32%)] text-white">
      <main id="main-content" className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] xl:gap-12">
          <section className="rounded-[32px] border border-white/10 bg-[#0d1119] p-10 shadow-[0_30px_100px_rgba(15,23,42,0.1)] backdrop-blur-xl lg:p-12">
            <div className="max-w-3xl space-y-6">
              <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-xs uppercase tracking-[0.32em] text-amber-200">
                One verification gateway
              </span>
              <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">
                Vexora Gaming access is locked behind one 18+ gate.
              </h1>
              <p className="text-lg leading-8 text-slate-400 sm:text-xl">
                No alternate verification routes. No legacy access flows. Verify once here and proceed directly into the secure Vexora Gaming workspace.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-[#0d1119] p-6">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Step 1</p>
                  <p className="mt-3 text-xl font-semibold text-white">Confirm your age</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Use the gate below to complete the secure age verification check.</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-[#0d1119] p-6">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Step 2</p>
                  <p className="mt-3 text-xl font-semibold text-white">Enter Vexora Gaming</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Once verified, you will be redirected to the protected app environment.</p>
                </div>
              </div>
              <div className="rounded-[24px] border border-amber-400/40 bg-amber-500/10 p-6 text-slate-300">
                <p className="font-semibold text-amber-200">Important</p>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  This is the only access path into Vexora Gaming. Any other verification page is deprecated and will not unlock the platform.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-[#0d1119] p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] lg:p-10">
            <div className="mb-8 rounded-[24px] border border-amber-400/40 bg-amber-500/10 p-6">
              <p className="text-xs uppercase tracking-[0.32em] text-amber-200">Verify now</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Unlock Vexora Gaming</h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                Complete the only age verification check for this platform. The server validates access and then sends you into the secure application.
              </p>
            </div>

            <Suspense fallback={<div className="rounded-[24px] border border-white/10 bg-[#0d1119] p-6 text-sm text-slate-400">Loading secure verification...</div>}>
              <AgeGateClient />
            </Suspense>

            <div className="mt-8 rounded-[24px] border border-white/10 bg-[#0d1119] p-6 text-sm text-slate-400">
              <p className="font-medium text-white">Need help or want details?</p>
              <p className="mt-3 leading-7 text-slate-500">
                Review our policies or contact support if you have questions about the verification requirement.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/support" className="text-amber-200 underline decoration-amber-300/60 underline-offset-4 hover:text-white">
                  Support
                </Link>
                <Link href="/terms" className="text-amber-200 underline decoration-amber-300/60 underline-offset-4 hover:text-white">
                  Terms
                </Link>
                <Link href="/privacy" className="text-amber-200 underline decoration-amber-300/60 underline-offset-4 hover:text-white">
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

