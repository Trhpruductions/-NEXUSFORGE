"use client";

import { useId, type ReactNode } from "react";
import { Lock } from "lucide-react";

type AuthFormCardProps = {
  title: string;
  subtitle: string;
  eyebrow?: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function AuthFormCard({ title, subtitle, eyebrow = "Vexora Gaming", footer, children }: AuthFormCardProps) {
  const titleId = useId();

  return (
    <section
      role="form"
      aria-labelledby={titleId}
      className="relative w-full max-w-[480px] overflow-hidden rounded-[28px] border border-amber-400/25 bg-slate-950/80 p-8 text-slate-100 shadow-[0_30px_90px_rgba(139,61,255,0.25)] backdrop-blur-xl sm:p-10"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,#60a5fa,#a78bfa,#e879f9,transparent)]" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(139,61,255,0.35),transparent_65%)] blur-2xl" />

      <div className="relative mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.36em] text-amber-300">{eyebrow}</p>
          <h1 id={titleId} className="nf-heading text-2xl font-bold tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1">
          <Lock className="h-3 w-3 text-emerald-300" />
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Secure</span>
        </div>
      </div>

      <div className="relative space-y-5">{children}</div>

      {footer ? (
        <div className="relative mt-8 border-t border-white/8 pt-6 text-center text-xs text-slate-400">{footer}</div>
      ) : null}
    </section>
  );
}
