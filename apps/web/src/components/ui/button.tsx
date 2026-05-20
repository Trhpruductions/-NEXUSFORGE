"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "subtle";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "nexus-interactive-btn inline-flex min-h-11 items-center justify-center rounded-2xl px-5 text-sm font-semibold tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/25 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" &&
          "border border-amber-300/45 bg-[linear-gradient(180deg,var(--button-top),var(--button-mid)_42%,var(--button-bottom))] text-[var(--button-ink)] shadow-[0_16px_34px_rgba(255,160,0,0.24),inset_0_1px_0_rgba(255,255,255,0.32)] hover:-translate-y-[1px] hover:border-amber-200 hover:shadow-[0_20px_38px_rgba(255,160,0,0.32),inset_0_1px_0_rgba(255,255,255,0.38)]",
        variant === "ghost" &&
          "border border-slate-600/80 bg-[linear-gradient(155deg,rgba(15,23,42,0.96),rgba(8,47,73,0.1))] text-slate-100 shadow-[0_14px_26px_rgba(2,6,23,0.18),inset_0_1px_0_rgba(148,163,184,0.08)] hover:-translate-y-[1px] hover:border-amber-400/60 hover:bg-slate-900/80 hover:text-amber-100",
        variant === "subtle" &&
          "border border-slate-700/70 bg-slate-900/60 text-slate-200 shadow-[inset_0_1px_0_rgba(148,163,184,0.06)] hover:-translate-y-[1px] hover:border-slate-500/80 hover:bg-slate-900/75 hover:text-white",
        className,
      )}
      {...props}
    />
  );
}
