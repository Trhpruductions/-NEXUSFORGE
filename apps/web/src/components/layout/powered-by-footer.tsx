"use client";

import Image from "next/image";
import Link from "next/link";

export function PoweredByFooter() {
  return (
    <footer className="border-t border-slate-700/70 bg-slate-900/80 py-8 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="flex flex-col items-center gap-6">
          {/* Vexora Gaming logo (the old "powered by" art still showed the NexusForge name) */}
          <div className="relative flex h-24 w-full max-w-[280px] items-center justify-center sm:h-32">
            <Image
              src="/brand/vexora-logo.png"
              alt="Vexora Gaming"
              fill
              loading="lazy"
              className="object-contain"
              sizes="(max-width: 640px) 100vw, 280px"
            />
          </div>

          {/* Footer Links and Attribution */}
          <div className="flex flex-col items-center gap-4 text-center text-xs text-slate-400 sm:flex-row sm:justify-center sm:gap-6">
            <p>Vexora Gaming © 2026. Built for community.</p>
            <span className="hidden sm:inline">•</span>
            <p className="text-slate-400">Powered by <span className="font-semibold text-slate-100">TRH Development</span></p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap justify-center gap-4 text-xs">
            <Link href="/pricing" className="text-amber-200 transition hover:text-amber-300">Pricing</Link>
            <span className="text-slate-300">•</span>
            <Link href="/support" className="text-amber-200 transition hover:text-amber-300">Support</Link>
            <span className="text-slate-300">•</span>
            <Link href="/legal" className="text-amber-200 transition hover:text-amber-300">Legal</Link>
            <span className="text-slate-300">•</span>
            <a href="https://trh.dev" target="_blank" rel="noopener noreferrer" className="text-amber-200 transition hover:text-amber-300">TRH Development</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
