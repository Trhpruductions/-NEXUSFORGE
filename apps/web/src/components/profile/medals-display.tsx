"use client";

import { Medal } from "@/lib/api";

type MedalsDisplayProps = {
  medals: Medal[];
  compact?: boolean;
};

export function MedalsDisplay({ medals, compact = false }: MedalsDisplayProps) {
  if (medals.length === 0) {
    return (
      <div className="nexus-display-panel rounded-[20px] py-8 text-center text-slate-500">
        No medals earned yet
      </div>
    );
  }

  return (
    <div className={compact ? "grid grid-cols-2 md:grid-cols-4 gap-4" : "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"}>
      {medals.map((medal) => (
        <div
          key={medal.id}
          className="nexus-metric-card nexus-interactive-card group cursor-help rounded-[20px] border border-slate-900/10 p-4 text-center"
          title={medal.description || medal.name}
        >
          {medal.icon && (
            <div className="mb-2 text-4xl transition-transform duration-300 group-hover:scale-110">
              {medal.icon}
            </div>
          )}
          <div className="text-sm font-semibold text-amber-700 transition group-hover:text-amber-600">
            {medal.name}
          </div>
          {medal.description && (
            <div className="mt-2 line-clamp-2 text-xs text-slate-500">
              {medal.description}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
