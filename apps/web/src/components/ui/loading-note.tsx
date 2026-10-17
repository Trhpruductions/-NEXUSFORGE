"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * The loading line used across the app. After a few seconds it explains the wait and offers a retry,
 * so nobody is left staring at a spinner that never finishes.
 */
export function LoadingNote({ label, onRetry }: { label: string; onRetry?: () => void }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{slow ? "This is taking longer than usual. The server may be busy." : label}</span>
      {slow && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200 transition hover:border-amber-400/50"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
