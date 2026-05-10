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
        "inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold tracking-wide transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" &&
          "border border-cyan-300/60 bg-gradient-to-b from-cyan-300 to-cyan-500 text-slate-950 shadow-[0_14px_30px_rgba(6,182,212,0.35)] hover:-translate-y-[1px] hover:from-cyan-200 hover:to-cyan-400",
        variant === "ghost" &&
          "border border-slate-600/80 bg-slate-900/60 text-slate-100 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)] hover:-translate-y-[1px] hover:border-cyan-500/60 hover:bg-slate-800/90",
        className,
      )}
      {...props}
    />
  );
}
