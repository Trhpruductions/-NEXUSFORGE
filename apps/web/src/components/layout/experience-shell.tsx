"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Link from "next/link";
import { globalNavActions } from "./experience-shell-nav";

import type { ExperienceAction, ExperienceMetric } from "./experience-shell-types";

type ExperienceShellProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  metrics?: ExperienceMetric[];
  actions?: ExperienceAction[];
  children: ReactNode;
  maxWidthClassName?: string;
  showGlobalNav?: boolean;
};

function metricToneClass(tone: ExperienceMetric["tone"]) {
  if (tone === "emerald") return "text-amber-300";
  if (tone === "amber") return "text-amber-300";
  if (tone === "slate") return "text-slate-300";
  return "text-amber-300";
}

export function ExperienceShell({
  eyebrow,
  title,
  subtitle,
  metrics = [],
  actions = [],
  children,
  maxWidthClassName = "max-w-7xl",
  showGlobalNav = true,
}: ExperienceShellProps) {
  const mergedActions = showGlobalNav
    ? [...globalNavActions, ...actions.filter((action) => !globalNavActions.some((globalAction) => globalAction.href === action.href))]
    : actions;
  const pathname = usePathname();

  return (
    <div className="nexus-shell">
      <div className={`nexus-shell-inner ${maxWidthClassName} nexus-shell-atmos space-y-5`}>
        <header className="nexus-shell-header nexus-panel-glass">
          <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="nexus-eyebrow rounded-full border border-amber-400/10 bg-amber-400/5 px-3 py-2 text-amber-200 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.08)]">NEXUS SHELL</span>
                {showGlobalNav ? (
                  <div className="flex flex-wrap gap-2">
                    {globalNavActions.map((action) => {
                      const isActive = pathname?.startsWith(action.href);
                      return (
                        <Link
                          key={action.href}
                          href={action.href}
                          className={`nexus-outline-button inline-flex h-9 items-center rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.24em] transition hover:text-white ${
                            isActive ? "border-amber-400/70 bg-slate-900/95 text-white" : "text-slate-300"
                          }`}
                        >
                          {action.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="inline-flex items-center gap-3 rounded-full border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-[10px] uppercase tracking-[0.32em] text-amber-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_0_6px_rgba(56,189,248,0.12)]" />
                {eyebrow}
              </div>
              <h1 className="nexus-title text-white">{title}</h1>
              {subtitle ? <p className="nexus-subtitle max-w-3xl text-slate-300">{subtitle}</p> : null}
            </div>
            {mergedActions.length ? (
              <div className="flex flex-wrap gap-2 xl:justify-end">
                {mergedActions.map((action) => (
                  <Link
                    key={`${action.href}-${action.label}`}
                    href={action.href}
                    className={
                      action.tone === "primary"
                        ? "nexus-glow-button inline-flex h-10 items-center rounded-2xl px-4 text-xs font-semibold text-amber-50 transition hover:-translate-y-0.5"
                        : "nexus-outline-button inline-flex h-10 items-center rounded-2xl px-4 text-xs font-semibold text-slate-300 transition hover:-translate-y-0.5 hover:text-slate-50"
                    }
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </header>

        {metrics.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="nexus-metric-card nexus-interactive-card rounded-2xl px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{metric.label}</p>
                <p className={`mt-1 text-lg font-semibold ${metricToneClass(metric.tone)}`}>{metric.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {children}
      </div>
    </div>
  );
}
