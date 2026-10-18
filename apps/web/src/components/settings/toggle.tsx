"use client";

/** Gold on/off switch used across Settings. */
export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition ${checked ? "border-amber-400 bg-amber-400" : "border-white/15 bg-slate-800"} disabled:opacity-50`}
    >
      <span className={`absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all ${checked ? "left-[22px] bg-slate-950" : "left-0.5 bg-slate-400"}`} style={{ height: 18, width: 18 }} />
    </button>
  );
}
