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
        "nexus-interactive-btn inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" &&
          "border border-amber-300/45 bg-[linear-gradient(180deg,var(--button-top),var(--button-mid)_42%,var(--button-bottom))] text-[var(--button-ink)] shadow-[0_16px_34px_rgba(255,160,0,0.24),inset_0_1px_0_rgba(255,255,255,0.32)] hover:-translate-y-[1px] hover:border-amber-400/40 hover:shadow-[0_20px_38px_rgba(255,160,0,0.32),inset_0_1px_0_rgba(255,255,255,0.38)]",
        variant === "ghost" &&
          "border border-white/10 bg-amber-400 text-slate-300 shadow-[0_10px_24px_rgba(15,23,42,0.08)] hover:-translate-y-[1px] hover:border-white/20 hover:bg-[#0d1119] hover:text-slate-950",
        variant === "subtle" &&
          "border border-white/10 bg-[#0d1119] text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] hover:-translate-y-[1px] hover:border-white/20 hover:bg-amber-400 hover:text-slate-950",
        className,
      )}
      {...props}
    />
  );
}
