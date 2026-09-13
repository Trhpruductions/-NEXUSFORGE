import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AgeGateClient } from "./age-gate-client";

export default function AgeGatePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070a10] text-white">
      <Image src="/brand/vexora-gaming-poster-gold.png" alt="" fill priority className="object-cover opacity-20" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(230,179,37,0.18),transparent_38%),linear-gradient(180deg,rgba(7,10,16,0.55),#070a10_70%)]" />

      <main id="main-content" className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-4 py-10 sm:px-6">
        <Link href="/" className="mb-6 flex items-center gap-3">
          <Image src="/brand/vexora-mark-gold-256.png" alt="Vexora Gaming" width={48} height={48} className="h-12 w-12" />
          <span className="nf-heading text-lg font-bold uppercase tracking-[0.28em] text-amber-300">Vexora Gaming</span>
        </Link>

        <div className="w-full max-w-2xl rounded-2xl border border-amber-500/20 bg-[#0d1119]/95 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.6)] backdrop-blur sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-300">18+ only</p>
          <h1 className="nf-heading mt-2 text-2xl font-bold text-white sm:text-3xl">Confirm your age to enter</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Vexora Gaming has real-money prize tournaments, a store, and creator streams. By law and by our terms you must be 18 or older to use it.
          </p>

          <div className="mt-6">
            <Suspense fallback={<div className="rounded-xl border border-white/10 bg-[#11151e] p-4 text-sm text-slate-400">Loading...</div>}>
              <AgeGateClient />
            </Suspense>
          </div>

          <div className="mt-6 flex flex-wrap gap-4 border-t border-white/5 pt-4 text-xs text-slate-500">
            <Link href="/support" className="hover:text-amber-200">Support</Link>
            <Link href="/terms" className="hover:text-amber-200">Terms</Link>
            <Link href="/privacy" className="hover:text-amber-200">Privacy</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
