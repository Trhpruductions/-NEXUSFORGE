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
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-[#040812] px-4 py-8 text-slate-100 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(46,164,255,0.16),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(30,139,255,0.14),transparent_32%),radial-gradient(circle_at_50%_100%,rgba(10,86,176,0.14),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.07)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_55%,transparent_100%)]" />

      <div className="relative z-10 mx-auto my-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="hidden space-y-10 lg:block">
          <Link href="/" className="inline-block" aria-label="Nexus Forge Gaming home">
            {/* The artwork has its own dark backdrop; "lighten" lets it melt into the page. */}
            <Image src="/brand/nexusforge-logo-600.png" alt="Nexus Forge Gaming" width={600} height={400} priority className="h-auto w-72 mix-blend-lighten" />
          </Link>
          {hero}
        </section>

        <div className="relative flex w-full flex-col items-center gap-6 lg:items-end">
          <Link href="/" className="lg:hidden" aria-label="Nexus Forge Gaming home">
            <Image src="/brand/nexusforge-logo-600.png" alt="Nexus Forge Gaming" width={600} height={400} priority className="h-auto w-48 mix-blend-lighten" />
          </Link>
          <main id="main-content" className="flex w-full flex-col items-center lg:items-end">
            {children}
          </main>
        </div>
      </div>
      <footer className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11px] text-slate-500">
        <span>© 2026 Nexus Forge Gaming</span>
        <Link href="/legal/terms" className="hover:text-slate-200">Terms</Link>
        <Link href="/legal/privacy" className="hover:text-slate-200">Privacy</Link>
        <Link href="/support" className="hover:text-slate-200">Support</Link>
        <Link href="/" className="hover:text-slate-200">Home</Link>
      </footer>
    </div>
  );
}
