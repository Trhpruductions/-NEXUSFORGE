"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Link from "next/link";
import { globalNavActions } from "./experience-shell-nav";

import type { ExperienceAction, ExperienceMetric } from "./experience-shell-types";

import Image from "next/image";
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
  if (tone === "cyan") return "text-nexus-cyan nexus-text-pop";
  if (tone === "emerald") return "text-nexus-cyan nexus-text-pop opacity-80";
  if (tone === "amber") return "text-nexus-gold nexus-text-pop";
  if (tone === "slate") return "text-nexus-purple nexus-text-pop";
  return "text-slate-300";
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
      <div className={`nexus-shell-inner ${maxWidthClassName} nexus-shell-atmos space-y-2`}>
        <header className="nexus-shell-header nexus-panel-glass p-8 border border-white/10 bg-black/60 nexus-corner-tick relative overflow-hidden backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-nexus-cyan/5 blur-[100px] -z-10" />
          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="p-2 border border-nexus-cyan/30 bg-black/40 flex items-center justify-center nexus-corner-tick relative overflow-hidden group shadow-[inset_0_0_10px_rgba(0,242,255,0.1)]">
                   <div className="absolute top-0 right-0 w-3 h-3 bg-nexus-cyan/20" />
                   <Image 
                     src="/brand/nexusforge-logo.png" 
                     alt="NF" 
                     width={100} 
                     height={25} 
                     className="brightness-125 transition-all duration-300 group-hover:scale-110" 
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
                          className={cn(
                            "inline-flex h-10 items-center px-4 text-[10px] font-black uppercase tracking-[0.25em] transition-all border",
                            isActive 
                              ? "border-nexus-gold bg-nexus-gold/10 text-nexus-gold shadow-[0_0_15px_rgba(251,191,36,0.2)]" 
                              : "border-white/5 text-slate-500 hover:border-nexus-cyan/50 hover:text-nexus-cyan"
                          )}
                        >
                          {action.label.replace(" ", "_")}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="inline-flex items-center gap-3 border border-nexus-gold/30 bg-nexus-gold/5 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.32em] text-nexus-gold nexus-text-pop nexus-corner-tick">
                  <div className="h-2 w-2 bg-nexus-gold shadow-[0_0_8px_#fbbf24] animate-pulse" />
                  {eyebrow}
                </div>
                <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter drop-shadow-xl leading-none">
                  {title.split(" ").map((word, i) => (
                    <span key={i} className={i % 2 === 1 ? "text-nexus-cyan nexus-text-vibrant ml-3" : "ml-3 first:ml-0"}>
                      {word}
                    </span>
                  ))}
                </h1>
                {subtitle ? <p className="text-[13px] font-black uppercase tracking-[0.1em] text-slate-400 max-w-2xl leading-relaxed opacity-80">{subtitle}</p> : null}
              </div>
            </div>
            {mergedActions.length ? (
              <div className="flex flex-wrap gap-2 xl:justify-end mt-4 xl:mt-0">
                {actions.map((action) => (
                  <Link
                    key={`${action.href}-${action.label}`}
                    href={action.href}
                    className={cn(
                      "inline-flex h-12 items-center px-6 text-[11px] font-black uppercase tracking-[0.2em] transition-all",
                      action.tone === "primary"
                        ? "bg-nexus-cyan text-black hover:bg-white shadow-[0_5px_15px_-5px_rgba(0,242,255,0.4)]"
                        : "border border-white/10 text-slate-400 hover:border-nexus-gold/50 hover:text-nexus-gold"
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
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="bg-black/40 border border-white/10 nexus-corner-tick px-6 py-5 group hover:bg-white/5 transition-all">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-nexus-purple opacity-70 group-hover:opacity-100 transition-opacity">{metric.label}</p>
                <p className={`mt-2 text-xl font-black italic tracking-tighter ${metricToneClass(metric.tone)}`}>{metric.value}</p>
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

