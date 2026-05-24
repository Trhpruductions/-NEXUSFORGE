"use client";

import Image from "next/image";

export function PoweredByFooter() {
  return (
    <footer className="border-t border-slate-700/50 bg-slate-950/80 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="flex flex-col items-center gap-6">
          {/* TRH Development Branding */}
          <div className="relative flex h-24 w-full max-w-[280px] items-center justify-center sm:h-32">
            <Image
              src="/brand/trh-powered-by.png"
              alt="Powered by TRH Development"
              fill
              loading="lazy"
              className="object-contain"
              sizes="(max-width: 640px) 100vw, 280px"
            />
          </div>

          {/* Footer Links and Attribution */}
          <div className="flex flex-col items-center gap-4 text-center text-xs text-slate-400 sm:flex-row sm:justify-center sm:gap-6">
            <p>NexusForge © 2026. Built for community.</p>
            <span className="hidden sm:inline">•</span>
            <p className="text-slate-500">Powered by <span className="font-semibold text-slate-300">TRH Development</span></p>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap justify-center gap-4 text-xs">
            <a href="/pricing" className="text-amber-400 hover:text-amber-300 transition">Pricing</a>
            <span className="text-slate-700">•</span>
            <a href="mailto:support@nexusforge.app" className="text-amber-400 hover:text-amber-300 transition">Support</a>
            <span className="text-slate-700">•</span>
            <a href="https://trh.dev" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 transition">TRH Development</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
