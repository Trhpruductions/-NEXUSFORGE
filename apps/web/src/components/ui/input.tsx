import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="nexus-form-field text-sm text-slate-300">
      <label className="nexus-form-label" htmlFor={props.id}>
        {label}
      </label>
      <input
        className={cn(
          "nexus-form-input placeholder:text-slate-500",
          className,
        )}
        {...props}
      />
      {error ? <span className="nexus-form-error">{error}</span> : null}
    </div>
  );
}
