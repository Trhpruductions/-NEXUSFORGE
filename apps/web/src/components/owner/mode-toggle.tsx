"use client";

import type { OwnerMode } from "@/lib/owner-api";
import { cn } from "@/lib/utils";

/** Switches every money figure between live (real) and test-mode Stripe records. */
export function ModeToggle({ mode, onChange }: { mode: OwnerMode; onChange: (mode: OwnerMode) => void }) {
  return (
    <div className="flex items-center gap-2 text-xs" role="group" aria-label="Payment mode">
      <span className="text-slate-400">Money shown:</span>
      {(["live", "test"] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
          className={cn(
            "rounded-full border px-3 py-1",
            mode === value
              ? value === "live"
                ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-100"
                : "border-sky-400/60 bg-sky-400/15 text-sky-100"
              : "border-white/10 text-slate-300",
          )}
        >
          {value === "live" ? "Live" : "Test mode"}
        </button>
      ))}
    </div>
  );
}
