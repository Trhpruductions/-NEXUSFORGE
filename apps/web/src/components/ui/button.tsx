"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "nexus-interactive-btn inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold tracking-wide transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" &&
          "border border-cyan-300/60 bg-[linear-gradient(180deg,rgba(165,243,252,1),rgba(34,211,238,0.96)_45%,rgba(8,145,178,0.96))] text-slate-950 shadow-[0_18px_34px_rgba(6,182,212,0.32),inset_0_1px_0_rgba(255,255,255,0.3)] hover:-translate-y-[1px] hover:shadow-[0_20px_38px_rgba(6,182,212,0.4),inset_0_1px_0_rgba(255,255,255,0.36)]",
        variant === "ghost" &&
          "border border-slate-600/80 bg-[linear-gradient(155deg,rgba(15,23,42,0.94),rgba(8,47,73,0.12))] text-slate-100 shadow-[0_14px_26px_rgba(2,6,23,0.22),inset_0_1px_0_rgba(148,163,184,0.08)] hover:-translate-y-[1px] hover:border-cyan-500/60 hover:text-cyan-50",
        className,
      )}
      {...props}
    />
  );
}
