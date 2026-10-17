"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, RotateCcw } from "lucide-react";
import { columnOf, DEFAULT_LAYOUT, labelOf, moveWithinColumn, type HomeLayoutItem } from "./home-layout";

type HomeCustomizerProps = {
  layout: HomeLayoutItem[];
  onChange: (layout: HomeLayoutItem[]) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
};

/** Edit panel for the Home layout: show/hide and reorder widgets within each column. */
export function HomeCustomizer({ layout, onChange, onSave, onCancel, saving, error }: HomeCustomizerProps) {
  const columns: Array<{ key: "main" | "side"; title: string }> = [
    { key: "main", title: "Main column" },
    { key: "side", title: "Side column" },
  ];

  return (
    <section className="rounded-2xl border border-amber-400/40 bg-[#0d1119] p-4" aria-label="Customize Home">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="nf-heading text-[13px] font-bold uppercase tracking-[0.18em] text-white">Customize Home</h2>
          <p className="text-[11px] text-slate-400">Choose which widgets show and their order. Saved to your account.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onChange(DEFAULT_LAYOUT)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300 hover:border-amber-400/50">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 hover:text-white">Cancel</button>
          <button type="button" onClick={onSave} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-300 disabled:opacity-60">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save layout
          </button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {columns.map((column) => {
          const items = layout.filter((item) => columnOf(item.id) === column.key);
          return (
            <div key={column.key}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{column.title}</p>
              <ol className="space-y-1.5">
                {items.map((item, index) => (
                  <li key={item.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${item.visible ? "border-white/10 bg-[#11151e] text-slate-100" : "border-white/5 bg-transparent text-slate-500"}`}>
                    <span className="min-w-0 flex-1 truncate">{labelOf(item.id)}</span>
                    <button type="button" onClick={() => onChange(moveWithinColumn(layout, item.id, -1))} disabled={index === 0} className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-25" aria-label={`Move ${labelOf(item.id)} up`}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => onChange(moveWithinColumn(layout, item.id, 1))} disabled={index === items.length - 1} className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-25" aria-label={`Move ${labelOf(item.id)} down`}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(layout.map((entry) => (entry.id === item.id ? { ...entry, visible: !entry.visible } : entry)))}
                      aria-pressed={item.visible}
                      className={`rounded p-1 hover:bg-white/5 ${item.visible ? "text-amber-300" : "text-slate-500 hover:text-white"}`}
                      aria-label={item.visible ? `Hide ${labelOf(item.id)}` : `Show ${labelOf(item.id)}`}
                    >
                      {item.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
      {error ? <p className="mt-2 text-xs text-rose-300" role="alert">{error}</p> : null}
    </section>
  );
}
