"use client";

import { LABELS, type PartOption } from "@/components/avatar3d/design";
import type { OwnershipSnapshot } from "@/lib/avatar-api";

/**
 * Shared controls for the avatar builder: option tiles with their owned, free, equipped and locked states,
 * search and filtering, and colour swatches. The rules come from design.ts and the ownership snapshot.
 */

export type LockFilter = "all" | "free" | "owned" | "locked";
export type OptionKind = "free" | "owned" | "locked";

const EMPTY: ReadonlySet<string> = new Set();

export const chip = (active: boolean) =>
  `rounded-lg border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${active ? "border-amber-400 bg-amber-500/10 text-amber-100" : "border-white/10 bg-[#11151e] text-slate-300 hover:border-white/30"}`;

/** Free options are always available. A paid option is owned only when its catalog item is owned. */
export function kindOf(option: PartOption, owned: ReadonlySet<string>): OptionKind {
  if (!option.catalogKey) return "free";
  return owned.has(option.catalogKey) ? "owned" : "locked";
}

export function Swatches({ label, colours, value, onPick, help }: { label: string; colours: readonly string[]; value: string; onPick: (hex: string) => void; help?: string }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      {help ? <p className="mb-2 text-[11px] text-slate-500">{help}</p> : null}
      <div className="flex flex-wrap gap-2">
        {colours.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => onPick(hex)}
            aria-label={`${label} ${hex}`}
            aria-pressed={value.toLowerCase() === hex.toLowerCase()}
            style={{ backgroundColor: hex }}
            className={`h-8 w-8 rounded-full border-2 transition ${value.toLowerCase() === hex.toLowerCase() ? "scale-110 border-amber-300" : "border-white/10 hover:border-white/40"}`}
          />
        ))}
        <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-white/25" title="Custom colour">
          <span className="sr-only">Custom {label.toLowerCase()}</span>
          <input type="color" value={value} onChange={(event) => onPick(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={`Custom ${label.toLowerCase()}`} />
          <span className="flex h-full w-full items-center justify-center text-[11px] text-slate-400">+</span>
        </label>
      </div>
    </div>
  );
}

export function Chips<T extends string>({ label, options, value, onPick }: { label: string; options: readonly T[]; value: T; onPick: (value: T) => void }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <button key={option} type="button" aria-pressed={value === option} onClick={() => onPick(option)} className={chip(value === option)}>
            {LABELS[option] ?? option}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Search box and the ownership filter for a list of options. */
export function FilterBar({ label, query, onQuery, filter, onFilter }: { label: string; query: string; onQuery: (value: string) => void; filter: LockFilter; onFilter: (value: LockFilter) => void }) {
  const filters: Array<{ id: LockFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "free", label: "Free" },
    { id: "owned", label: "Owned" },
    { id: "locked", label: "Locked" },
  ];
  return (
    <div className="space-y-2">
      <input
        type="search"
        aria-label={`Search ${label}`}
        placeholder={`Search ${label.toLowerCase()}`}
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-[#11151e] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400/60"
      />
      <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
        {filters.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={filter === entry.id}
            onClick={() => onFilter(entry.id)}
            className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${filter === entry.id ? "border-amber-400 bg-amber-500/10 text-amber-100" : "border-white/10 text-slate-400 hover:border-white/30"}`}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * A grid of options. Each tile says what state it is in: Equipped, Free, Owned, or Locked with its price.
 * Locked tiles cannot be chosen. Pressing one calls onLocked so the page can explain how to unlock it.
 */
export function OptionGrid({
  options,
  isSelected,
  ownership,
  query,
  filter,
  onPick,
  onLocked,
}: {
  options: PartOption[];
  isSelected: (id: string) => boolean;
  ownership: OwnershipSnapshot | null;
  query: string;
  filter: LockFilter;
  onPick: (id: string) => void;
  onLocked: (option: PartOption) => void;
}) {
  const owned = ownership?.owned ?? EMPTY;
  const needle = query.trim().toLowerCase();
  const visible = options.filter((option) => {
    if (needle && !option.label.toLowerCase().includes(needle)) return false;
    if (filter === "all") return true;
    return kindOf(option, owned) === filter;
  });
  if (!visible.length) return <p className="py-6 text-center text-xs text-slate-500">No options match. Clear the search or change the filter.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {visible.map((option) => {
        const selected = isSelected(option.id);
        const kind = kindOf(option, owned);
        const locked = kind === "locked";
        const price = option.catalogKey ? ownership?.prices.get(option.catalogKey) : undefined;
        const status = selected ? "Equipped" : kind === "free" ? "Free" : kind === "owned" ? "Owned" : `Locked${price !== undefined ? ` · ${price} NC` : ""}`;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            aria-disabled={locked || undefined}
            data-state={selected ? "equipped" : kind}
            onClick={() => (locked ? onLocked(option) : onPick(option.id))}
            className={`rounded-lg border px-3 py-2 text-left transition ${selected ? "border-amber-400 bg-amber-500/10" : locked ? "border-white/5 bg-[#0b0f16] opacity-75 hover:border-white/20" : "border-white/10 bg-[#11151e] hover:border-white/30"}`}
          >
            <span className="block text-xs font-semibold text-white">{option.label}</span>
            <span className={`mt-0.5 block text-[10px] uppercase tracking-[0.12em] ${selected ? "text-amber-200" : locked ? "text-slate-500" : "text-slate-400"}`}>{status}</span>
          </button>
        );
      })}
    </div>
  );
}
