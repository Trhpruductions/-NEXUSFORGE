"use client";

import { Medal } from "@/lib/api";

type MedalsDisplayProps = {
  medals: Medal[];
  compact?: boolean;
};

export function MedalsDisplay({ medals, compact = false }: MedalsDisplayProps) {
  if (medals.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        No medals earned yet
      </div>
    );
  }

  return (
    <div className={compact ? "grid grid-cols-2 md:grid-cols-4 gap-4" : "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"}>
      {medals.map((medal) => (
        <div
          key={medal.id}
          className="bg-slate-900 p-4 rounded text-center hover:bg-slate-800 transition border border-slate-800 hover:border-yellow-500 group cursor-help"
          title={medal.description || medal.name}
        >
          {medal.icon && (
            <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">
              {medal.icon}
            </div>
          )}
          <div className="font-semibold text-cyan-400 text-sm group-hover:text-yellow-300 transition">
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
