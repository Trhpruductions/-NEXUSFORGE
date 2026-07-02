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
      className="w-full max-w-[480px] rounded-[32px] border border-slate-900/10 bg-white/85 p-10 relative overflow-hidden group shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl text-slate-900"
    >
      <div className="absolute top-0 right-0 p-8 opacity-10">
         <LayoutPanelTop className="w-32 h-32" />
      </div>

      <div className="relative mb-12 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 transition-colors group-hover:bg-amber-100">
               <Image 
                 src="/app-images/all-images/nexusforge-logo.png" 
                 alt="" 
                 width={20} 
                 height={20} 
                 className="grayscale contrast-125" 
               />
            </div>
            <div>
               <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.4em] text-amber-600">Nexus Auth v7</p>
               <h1 id={titleId} className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
            </div>
         </div>
         <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 shadow-sm">
            <Lock className="w-3 h-3 text-emerald-600" />
            <span className="text-[8px] font-semibold uppercase tracking-widest text-emerald-600">TLS secure</span>
         </div>
      </div>

      <div className="relative mb-10 pb-6 border-b border-slate-900/5">
         <p className="text-[11px] font-medium uppercase tracking-widest leading-relaxed text-slate-500">{subtitle}</p>
      </div>

      <div className="relative space-y-6">
         {children}
      </div>

      {footer && (
         <div className="relative mt-10 pt-8 border-t border-slate-900/5 text-[10px] font-semibold uppercase tracking-widest text-center text-slate-500 transition-colors group-hover:text-slate-700">
            {footer}
         </div>
      )}
      
      {/* CORNER DECS */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-amber-200" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-amber-200" />
    </section>
  );
}
