"use client";

import { useMemo } from "react";
import type { AvatarDesign } from "@/components/avatar3d/design";
import { selectionRows, unownedCount, type SelectionState } from "@/components/avatar3d/current-selections-model";

const STATE_TEXT: Record<SelectionState, string> = { free: "Free", owned: "Owned", locked: "Not owned" };
const STATE_CLASS: Record<SelectionState, string> = {
  free: "border-sky-400/30 text-sky-200",
  owned: "border-emerald-400/30 text-emerald-200",
  locked: "border-amber-400/40 text-amber-200",
};

/** The items the draft is wearing, with whether the account owns each paid one. Saving is refused while any is not owned. */
export function CurrentSelections({ design, owned }: { design: AvatarDesign; owned: ReadonlySet<string> }) {
  const rows = useMemo(() => selectionRows(design, owned), [design, owned]);
  const notOwned = unownedCount(rows);

  return (
    <section aria-labelledby="current-selections-heading" className="rounded-2xl border border-white/10 bg-[#0d1119] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="current-selections-heading" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          Currently wearing
        </h2>
        {notOwned ? (
          <p role="status" className="text-[11px] text-amber-200">
            {notOwned} {notOwned === 1 ? "item is" : "items are"} not owned. Saving is refused until {notOwned === 1 ? "it is" : "they are"} removed.
          </p>
        ) : null}
      </div>
      <ul className="mt-3 grid gap-1.5">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2 rounded-lg border border-white/[0.06] px-2.5 py-2 text-xs">
            {row.colour ? <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: row.colour }} /> : null}
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] uppercase tracking-[0.14em] text-slate-500">{row.slot}</span>
              <span className="block truncate text-slate-100">{row.label}</span>
            </span>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${STATE_CLASS[row.state]}`}>{STATE_TEXT[row.state]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
