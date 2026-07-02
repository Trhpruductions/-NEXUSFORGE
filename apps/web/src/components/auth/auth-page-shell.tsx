"use client";

import type { ReactNode } from "react";
import Image from "next/image";

type AuthPageShellProps = {
  hero: ReactNode;
  children: ReactNode;
};

export function AuthPageShell({ hero, children }: AuthPageShellProps) {
  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#050207] px-4 py-8 sm:px-6">
      {/* Tactical Background Elements */}
      <div className="absolute inset-0 z-0">
         <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px]" />
         <div className="absolute inset-0 scanline-overlay opacity-10 pointer-events-none" />
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-600/5 blur-[120px] rounded-full pointer-events-none" />
      </div>

      <div className="mx-auto my-auto grid w-full max-w-7xl gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center relative z-10">
        <section className="hidden lg:block space-y-12">
          <div className="inline-block p-4 border border-white/5 bg-white/5 backdrop-blur-sm relative group">
             <div className="absolute -top-1 -left-1 w-2 h-2 bg-amber-500" />
             <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-amber-500" />
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
          <div className="lg:hidden p-4 border border-white/5 bg-white/5">
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
