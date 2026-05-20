"use client";

import { Medal } from "@/lib/api";

type MedalsDisplayProps = {
  medals: Medal[];
  compact?: boolean;
};

export function MedalsDisplay({ medals, compact = false }: MedalsDisplayProps) {
  if (medals.length === 0) {
    return (
      <div className="nexus-display-panel rounded-[24px] py-8 text-center text-slate-400">
        No medals earned yet
      </div>
    );
  }

  return (
    <div className={compact ? "grid grid-cols-2 md:grid-cols-4 gap-4" : "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"}>
      {medals.map((medal) => (
        <div
          key={medal.id}
          className="nexus-metric-card nexus-interactive-card group cursor-help rounded-2xl border border-slate-700/70 p-4 text-center"
          title={medal.description || medal.name}
        >
          {medal.icon && (
            <div className="mb-2 text-4xl transition-transform duration-300 group-hover:scale-110">
              {medal.icon}
            </div>
          )}
          <div className="text-sm font-semibold text-amber-300 transition group-hover:text-amber-200">
            {medal.name}
          </div>
          {medal.description && (
            <div className="text-xs text-slate-400 mt-2 line-clamp-2">
              {medal.description}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
