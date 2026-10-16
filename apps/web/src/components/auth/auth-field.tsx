"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export const authInputClass =
  "h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-400/70 focus:border-amber-400/60 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(46,164,255,0.25)] disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:dark]";

export const authPrimaryButtonClass =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(120deg,#9fd8ff,#2ea4ff_55%,#0b6fe0)] px-6 text-xs font-bold uppercase tracking-[0.2em] text-slate-950 shadow-[0_14px_40px_rgba(46,164,255,0.35)] transition hover:-translate-y-px hover:shadow-[0_18px_46px_rgba(46,164,255,0.5)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { label, error, className, id, type = "text", ...props },
  ref,
) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const errorId = error && id ? `${id}-error` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={isPassword && revealed ? "text" : type}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={errorId}
          className={cn(authInputClass, isPassword && "pr-14", error && "border-rose-400/60", className)}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            {revealed ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-rose-300">
          {error}
        </p>
      ) : null}
    </div>
  );
});
