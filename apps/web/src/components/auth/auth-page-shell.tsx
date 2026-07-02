"use client";

import type { ReactNode } from "react";
import Image from "next/image";

type AuthPageShellProps = {
  hero: ReactNode;
  children: ReactNode;
};

export function AuthPageShell({ hero, children }: AuthPageShellProps) {
  return (
     <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.10),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-8 sm:px-6">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a06_1px,transparent_1px),linear-gradient(to_bottom,#0f172a06_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="absolute inset-0 scanline-overlay opacity-[0.04] pointer-events-none" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/8 blur-[120px]" />
      </div>

      <div className="mx-auto my-auto grid w-full max-w-7xl gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center relative z-10">
        <section className="hidden lg:block space-y-12">
           <div className="relative inline-block rounded-[24px] border border-slate-900/10 bg-white/85 p-4 backdrop-blur-sm group shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
             <div className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-amber-500" />
             <div className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-amber-500" />
             <Image 
               src="/app-images/all-images/nexusforge-logo.png" 
               alt="NexusForge" 
               width={160} 
               height={40} 
               className="grayscale group-hover:grayscale-0 transition-all duration-700 brightness-75 group-hover:brightness-110"
             />
          </div>
          {hero}
        </section>
        <div className="relative w-full flex flex-col items-center lg:items-end gap-8">
          <div className="lg:hidden rounded-[24px] border border-slate-900/10 bg-white/85 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
            <Image 
               src="/app-images/all-images/nexusforge-logo.png" 
               alt="NexusForge" 
               width={140} 
               height={35} 
               className="brightness-110"
             />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
