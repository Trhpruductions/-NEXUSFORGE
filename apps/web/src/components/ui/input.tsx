import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <label className="grid gap-2 text-sm text-slate-300">
      <span className="font-medium tracking-wide text-slate-200">{label}</span>
      <input
        className={cn(
          "h-11 rounded-xl border border-slate-700/90 bg-gradient-to-b from-slate-900/95 to-slate-900/70 px-3 text-slate-100 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)] outline-none transition duration-200 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30",
          className,
        )}
        {...props}
      />
      {error ? <span className="text-xs text-rose-400">{error}</span> : null}
    </label>
  );
}
