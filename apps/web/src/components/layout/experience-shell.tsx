"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Link from "next/link";
import type { ExperienceAction, ExperienceMetric } from "./experience-shell-types";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { cn } from "@/lib/utils";

type ExperienceShellProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  metrics?: ExperienceMetric[];
  actions?: ExperienceAction[];
  children: ReactNode;
  maxWidthClassName?: string;
};

function metricToneClass(tone: ExperienceMetric["tone"]) {
  if (tone === "cyan") return "text-sky-300";
  if (tone === "emerald") return "text-emerald-300";
  if (tone === "amber") return "text-amber-300";
  return "text-white";
}

/** Shared frame for pages outside the workspace shell: the public website, developer portal, admin. */
export function ExperienceShell({ eyebrow, title, subtitle, metrics = [], actions = [], children, maxWidthClassName = "max-w-7xl" }: ExperienceShellProps) {
  const pathname = usePathname() ?? "";

  return (
    <div className="min-h-dvh bg-[#070a10] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(46,164,255,0.14),transparent_35%),radial-gradient(circle_at_85%_10%,rgba(30,139,255,0.1),transparent_30%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_50%,transparent_100%)]" />

      <SiteHeader />

      <div className={cn("relative mx-auto space-y-4 px-4 py-5 md:px-6", maxWidthClassName)}>
        <section className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-[#0d1119] p-5 md:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_20%,rgba(46,164,255,0.18),transparent_45%)]" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(46,164,255,0.9)]" /> {eyebrow}
              </p>
              <h1 className="nf-heading mt-2 text-2xl font-bold text-white md:text-3xl">{title}</h1>
              {subtitle ? <p className="mt-1 max-w-2xl text-sm text-slate-400">{subtitle}</p> : null}
            </div>
            {actions.length ? (
              <div className="flex flex-wrap gap-2">
                {actions.map((action) => (
                  <Link
                    key={`${action.href}-${action.label}`}
                    href={action.href}
                    prefetch={false}
                    className={cn(
                      "inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] transition",
                      action.tone === "primary" ? "bg-amber-400 text-slate-950 hover:bg-amber-300" : "border border-white/10 text-slate-200 hover:border-amber-400/50",
                    )}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {metrics.length ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-amber-500/15 bg-[#0d1119] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{metric.label}</p>
                <p className={cn("nf-heading mt-1 text-lg font-bold", metricToneClass(metric.tone))}>{metric.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <main id="main-content" tabIndex={-1} className="[&_.forge-panel]:rounded-2xl [&_.forge-panel]:border-amber-500/15 [&_.forge-panel]:bg-[#0d1119] [&_.forge-frame]:rounded-2xl [&_.forge-frame]:border-amber-500/15 [&_.forge-frame]:bg-[#0d1119] [&_.nexus-panel]:bg-[#0d1119] [&_.nexus-panel-glass]:bg-[#0d1119] [&_.nexus-display-panel]:bg-[#11151e]">{children}</main>
      </div>
      {pathname.startsWith("/admin") ? null : <SiteFooter />}
    </div>
  );
}
