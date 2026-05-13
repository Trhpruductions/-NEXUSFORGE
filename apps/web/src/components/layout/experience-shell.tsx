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
  if (tone === "emerald") return "text-emerald-300";
  if (tone === "amber") return "text-amber-300";
  if (tone === "slate") return "text-slate-300";
  return "text-cyan-300";
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

  return (
    <div className="nexus-shell">
      <div className={`nexus-shell-inner ${maxWidthClassName} nexus-shell-atmos space-y-5`}>
        <header className="nexus-shell-header">
          <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="max-w-3xl space-y-2">
              <p className="nexus-eyebrow text-cyan-300">{eyebrow}</p>
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
                        ? "nexus-glow-button inline-flex h-10 items-center rounded-2xl px-4 text-xs font-semibold text-cyan-50 transition hover:-translate-y-0.5"
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
