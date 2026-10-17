"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { applyAppearance, deviceAppearance, effectiveAnimation, type AnimationLevel } from "@/lib/appearance/preferences";
import type { Season } from "@/lib/appearance/seasons";

type AuthPageShellProps = {
  hero: ReactNode;
  children: ReactNode;
};

const SPARK_COUNT = 10;

/**
 * Shared frame for sign-in, registration and account recovery. Before anyone signs in it uses this device's last
 * theme and motion choices (never anything personal), so the first screen already matches. The background is purely
 * decorative: it respects Decorative effects, Animation and Reduce motion, and never sits on top of the form.
 */
// The global body is fixed with overflow hidden, so a tall form on a phone needs its own scroll container.
export function AuthPageShell({ hero, children }: AuthPageShellProps) {
  const [season, setSeason] = useState<Season | null>(null);
  const [animation, setAnimation] = useState<AnimationLevel>("full");

  useEffect(() => {
    const appearance = deviceAppearance();
    setSeason(applyAppearance(document.documentElement, appearance));
    setAnimation(effectiveAnimation(appearance));
  }, []);

  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-[var(--background)] text-slate-100">
      <div aria-hidden="true" className="nf-decor pointer-events-none fixed inset-0 overflow-hidden">
        <div className="nf-auth-glow nf-auth-glow-a" />
        <div className="nf-auth-glow nf-auth-glow-b" />
        <div className="nf-auth-grid" />
        {animation === "full"
          ? Array.from({ length: SPARK_COUNT }, (_, index) => (
              <span
                key={index}
                className="nf-particle nf-particle-ember"
                style={{ left: `${8 + ((index * 41) % 84)}%`, animationDelay: `${(index * 1.9) % 14}s`, animationDuration: `${12 + ((index * 5) % 10)}s` }}
              />
            ))
          : null}
      </div>

      <div className="relative flex min-h-full w-full flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="relative z-10 mx-auto my-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="hidden space-y-8 lg:block">
            <Link href="/" className="inline-block" aria-label="Nexus Forge Gaming home">
              {/* The artwork has its own dark backdrop; "lighten" lets it melt into the page. */}
              <Image src="/brand/nexusforge-logo-600.png" alt="Nexus Forge Gaming" width={600} height={400} priority className="h-auto w-64 mix-blend-lighten" />
            </Link>
            {hero}
            {season ? (
              <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                {season.name}: {season.tagline}
              </p>
            ) : null}
          </section>

          <div className="relative flex w-full flex-col items-center gap-6 lg:items-end">
            <Link href="/" className="lg:hidden" aria-label="Nexus Forge Gaming home">
              <Image src="/brand/nexusforge-logo-600.png" alt="Nexus Forge Gaming" width={600} height={400} priority className="h-auto w-44 mix-blend-lighten" />
            </Link>
            <main id="main-content" className="flex w-full flex-col items-center lg:items-end">
              {children}
            </main>
          </div>
        </div>
        <footer className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-slate-400">
          <span>© 2026 Nexus Forge Gaming · Open beta</span>
          <Link href="/legal/terms" className="hover:text-white">Terms</Link>
          <Link href="/legal/privacy" className="hover:text-white">Privacy</Link>
          <Link href="/support" className="hover:text-white">Support</Link>
          <Link href="/" className="hover:text-white">Home</Link>
        </footer>
      </div>
    </div>
  );
}
