"use client";

import { useId, type ReactNode } from "react";
import Image from "next/image";
import { Lock, Cpu, LayoutPanelTop } from "lucide-react";

type AuthFormCardProps = {
  title: string;
  subtitle: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function AuthFormCard({ title, subtitle, footer, children }: AuthFormCardProps) {
  const titleId = useId();

  return (
    <section
      role="form"
      aria-labelledby={titleId}
      className="w-full max-w-[480px] bg-black/60 border border-white/5 p-10 relative overflow-hidden group shadow-[0_50px_100px_rgba(0,0,0,0.8)] backdrop-blur-md"
    >
      <div className="absolute top-0 right-0 p-8 opacity-5">
         <LayoutPanelTop className="w-32 h-32" />
      </div>

      <div className="relative mb-12 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="w-10 h-10 border border-amber-500/30 flex items-center justify-center bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors nexus-corner-tick">
               <Image 
                 src="/app-images/all-images/nexusforge-logo.png" 
                 alt="" 
                 width={20} 
                 height={20} 
                 className="grayscale contrast-125" 
               />
            </div>
            <div>
               <p className="text-[9px] font-black text-amber-500 uppercase tracking-[0.4em] mb-1">Nexus_Auth_v7</p>
               <h1 id={titleId} className="text-2xl font-black text-white uppercase tracking-tighter italic">{title}</h1>
            </div>
         </div>
         <div className="flex items-center gap-2 px-3 py-1 border border-emerald-500/20 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <Lock className="w-3 h-3 text-emerald-500" />
            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">TLS_Secure</span>
         </div>
      </div>

      <div className="relative mb-10 pb-6 border-b border-white/5">
         <p className="text-[11px] text-slate-500 font-medium uppercase tracking-widest leading-relaxed italic">{subtitle}</p>
      </div>

      <div className="relative space-y-6">
         {children}
      </div>

      {footer && (
         <div className="relative mt-10 pt-8 border-t border-white/5 text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center group-hover:text-slate-300 transition-colors">
            {footer}
         </div>
      )}
      
      {/* CORNER DECS */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-amber-500/20" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-amber-500/20" />
    </section>
  );
}
