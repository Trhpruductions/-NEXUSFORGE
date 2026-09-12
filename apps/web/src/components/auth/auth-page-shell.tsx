"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

type AuthPageShellProps = {
  hero: ReactNode;
  children: ReactNode;
};

export function AuthPageShell({ hero, children }: AuthPageShellProps) {
  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#05030f] px-4 py-8 text-slate-100 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(59,130,246,0.22),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(168,85,247,0.24),transparent_32%),radial-gradient(circle_at_50%_100%,rgba(124,58,237,0.18),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.07)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_55%,transparent_100%)]" />

      <div className="relative z-10 mx-auto my-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="hidden space-y-10 lg:block">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/30 bg-slate-950/80 shadow-[0_0_24px_rgba(139,61,255,0.35)]">
              <Image src="/brand/vexora-mark.png" alt="Vexora Gaming" width={36} height={36} className="h-9 w-9 object-contain" />
            </div>
            <div>
              <p className="nf-heading text-sm font-semibold uppercase tracking-[0.32em] text-white">Vexora</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-amber-300">Gaming</p>
            </div>
          </Link>
          {hero}
        </section>

        <div className="relative flex w-full flex-col items-center gap-6 lg:items-end">
          <Link href="/" className="flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/30 bg-slate-950/80 shadow-[0_0_24px_rgba(139,61,255,0.35)]">
              <Image src="/brand/vexora-mark.png" alt="Vexora Gaming" width={32} height={32} className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="nf-heading text-sm font-semibold uppercase tracking-[0.32em] text-white">Vexora</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-amber-300">Gaming</p>
            </div>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
