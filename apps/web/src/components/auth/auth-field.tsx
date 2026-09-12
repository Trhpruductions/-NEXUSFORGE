"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export const authInputClass =
  "h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-400/60 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(139,61,255,0.2)] disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:dark]";

export const authPrimaryButtonClass =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(120deg,#3b82f6,#8b3dff_55%,#c026d3)] px-6 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_14px_40px_rgba(139,61,255,0.45)] transition hover:-translate-y-px hover:shadow-[0_18px_46px_rgba(139,61,255,0.6)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { label, error, className, id, ...props },
  ref,
) {
  const errorId = error && id ? `${id}-error` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={errorId}
        className={cn(authInputClass, error && "border-rose-400/60", className)}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-xs text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
});
