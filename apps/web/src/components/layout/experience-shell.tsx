import type { ReactNode } from "react";
import Link from "next/link";

type ExperienceMetric = {
  label: string;
  value: string;
  tone?: "cyan" | "emerald" | "amber" | "slate";
};

type ExperienceAction = {
  label: string;
  href: string;
  tone?: "primary" | "ghost";
};

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

const globalNavActions: ExperienceAction[] = [
  { label: "Home", href: "/app", tone: "ghost" },
  { label: "Search", href: "/search", tone: "ghost" },
  { label: "Activity", href: "/notifications", tone: "ghost" },
  { label: "Leaders", href: "/leaderboards", tone: "ghost" },
  { label: "Settings", href: "/settings", tone: "ghost" },
];

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
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">{eyebrow}</p>
              <h1 className="mt-1 font-[family-name:var(--font-orbitron)] text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
              {subtitle ? <p className="mt-1.5 text-sm text-slate-300">{subtitle}</p> : null}
            </div>
            {mergedActions.length ? (
              <div className="flex flex-wrap gap-2">
                {mergedActions.map((action) => (
                  <Link
                    key={`${action.href}-${action.label}`}
                    href={action.href}
                    className={
                      action.tone === "primary"
                        ? "inline-flex h-10 items-center rounded-xl border border-cyan-400/45 bg-cyan-950/35 px-4 text-xs font-semibold text-cyan-100 shadow-[0_12px_28px_rgba(8,47,73,0.35)] transition hover:border-cyan-300/70 hover:bg-cyan-950/60"
                        : "nexus-interactive-btn inline-flex h-10 items-center rounded-xl border border-slate-700 bg-[linear-gradient(155deg,rgba(15,23,42,0.94),rgba(8,47,73,0.12))] px-4 text-xs font-semibold text-slate-300 transition hover:border-cyan-500/45 hover:text-slate-100"
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
          <div className="grid gap-3 sm:grid-cols-3">
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
