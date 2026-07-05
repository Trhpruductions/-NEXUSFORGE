"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Link from "next/link";
import { globalNavActions } from "./experience-shell-nav";

import type { ExperienceAction, ExperienceMetric } from "./experience-shell-types";
import { cn } from "@/lib/utils";

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
  if (tone === "cyan") return "text-sky-600";
  if (tone === "emerald") return "text-emerald-600";
  if (tone === "amber") return "text-amber-600";
  if (tone === "slate") return "text-slate-300";
  return "text-slate-500";
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
    <div className="nexus-shell cinematic-stage metal-corners text-slate-100 nf-content-rhythm">
      <div className="cinematic-particles" />
      <div className={`nexus-shell-inner ${maxWidthClassName} nexus-shell-atmos space-y-4`}>
        <header className="forge-frame relative overflow-hidden rounded-[32px] p-8 backdrop-blur-xl nf-motion-rise">
          <div className="absolute top-0 right-0 h-64 w-64 -z-10 bg-rose-400/25 blur-[110px]" />
          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex items-center justify-center overflow-hidden rounded-2xl border border-slate-600/70 bg-slate-950/70 p-2 shadow-[inset_0_0_10px_rgba(15,23,42,0.2)] group">
                   <div className="absolute top-0 right-0 h-3 w-3 bg-amber-300/60" />
                   <img
                     src="/brand/nexusforge-logo.png"
                     alt="NF"
                     width={100}
                     height={25}
                     className="h-auto w-auto transition-all duration-300 group-hover:scale-110"
                     draggable={false}
                   />
                </div>
                {showGlobalNav ? (
                  <div className="flex flex-wrap gap-1">
                    {globalNavActions.map((action) => {
                      const isActive = pathname === action.href || (action.href !== "/app" && pathname?.startsWith(action.href));
                      return (
                        <Link
                          key={action.href}
                          href={action.href}
                          prefetch={false}
                          className={cn(
                            "inline-flex h-10 items-center rounded-full border px-4 text-[10px] font-semibold uppercase tracking-[0.25em] transition-all",
                            isActive 
                              ? "border-amber-300/70 bg-amber-500/20 text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.2)]" 
                              : "border-slate-700/70 bg-slate-900/80 text-slate-400 hover:border-amber-400/50 hover:text-slate-100"
                          )}
                        >
                          {action.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="forge-chip inline-flex items-center gap-3 rounded-full px-4 py-1.5 nf-type-eyebrow shadow-sm">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500 shadow-[0_0_8px_#fbbf24]" />
                  {eyebrow}
                </div>
                <h1 className="nf-type-title text-slate-100">
                  {title}
                </h1>
                {subtitle ? <p className="nf-type-subtitle text-slate-400 max-w-2xl">{subtitle}</p> : null}
              </div>
            </div>
            {mergedActions.length ? (
              <div className="flex flex-wrap gap-2 xl:justify-end mt-4 xl:mt-0">
                {actions.map((action) => (
                  <Link
                    key={`${action.href}-${action.label}`}
                    href={action.href}
                    prefetch={false}
                    className={cn(
                      "inline-flex h-12 items-center rounded-full px-6 text-[11px] font-semibold uppercase tracking-[0.2em] transition-all",
                      action.tone === "primary"
                        ? "forge-btn-primary nf-interact"
                        : "forge-btn-secondary nf-interact"
                    )}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </header>

        {metrics.length ? (
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 nf-stagger nf-stagger-base-110">
            {metrics.map((metric, index) => (
              <div key={metric.label} className={cn("forge-panel nf-interact group rounded-[24px] px-6 py-5 transition-colors", index === 0 && "nf-stagger-item-0", index === 1 && "nf-stagger-item-1", index === 2 && "nf-stagger-item-2", index === 3 && "nf-stagger-item-3", index === 4 && "nf-stagger-item-4", index === 5 && "nf-stagger-item-5", index >= 6 && "nf-stagger-item-6")}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500 transition-opacity group-hover:opacity-100">{metric.label}</p>
                <p className={`mt-2 text-xl font-semibold tracking-tight ${metricToneClass(metric.tone)}`}>{metric.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="pt-1">
          {children}
        </div>
      </div>
    </div>
  );
}

