import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, error, className, ...props }: InputProps) {
  const describedBy = error && props.id ? `${props.id}-error` : undefined;

  return (
    <div className="nexus-form-field text-sm text-slate-300">
      <label className="nexus-form-label" htmlFor={props.id}>
        {label}
      </label>
      {error ? (
        <input
          aria-invalid="true"
          aria-describedby={describedBy}
          className={cn(
            "nexus-form-input placeholder:text-slate-500",
            className,
          )}
          {...props}
        />
      ) : (
        <input
          aria-invalid="false"
          aria-describedby={describedBy}
          className={cn(
            "nexus-form-input placeholder:text-slate-500",
            className,
          )}
          {...props}
        />
      )}
      {error ? (
        <span id={props.id ? `${props.id}-error` : undefined} className="nexus-form-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
