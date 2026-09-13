"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { globalNavActions } from "./experience-shell-nav";
import type { ExperienceAction, ExperienceMetric } from "./experience-shell-types";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

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
  if (tone === "cyan") return "text-sky-300";
  if (tone === "emerald") return "text-emerald-300";
  if (tone === "amber") return "text-amber-300";
  return "text-white";
}

/** Shared frame for pages outside the workspace shell: developer portal, pricing, admin, invites, legal. */
export function ExperienceShell({ eyebrow, title, subtitle, metrics = [], actions = [], children, maxWidthClassName = "max-w-7xl", showGlobalNav = true }: ExperienceShellProps) {
  const pathname = usePathname() ?? "";
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-dvh bg-[#070a10] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(230,179,37,0.14),transparent_35%),radial-gradient(circle_at_85%_10%,rgba(212,160,23,0.1),transparent_30%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_50%,transparent_100%)]" />

      <header className="sticky top-0 z-40 border-b border-amber-500/15 bg-[#0b0e15]/90 backdrop-blur">
        <div className={cn("mx-auto flex h-14 items-center gap-4 px-4 md:px-6", maxWidthClassName)}>
          <Link href="/app" className="flex items-center gap-2.5">
            <Image src="/brand/vexora-mark-gold-256.png" alt="Vexora Gaming" width={34} height={34} className="h-[34px] w-[34px] rounded-lg border border-amber-500/40 object-cover" />
            <span className="hidden sm:block">
              <span className="nf-heading block text-xs font-semibold uppercase tracking-[0.3em] text-white">Vexora</span>
              <span className="block text-[9px] font-semibold uppercase tracking-[0.34em] text-amber-300">Gaming</span>
            </span>
          </Link>
          {showGlobalNav ? (
            <nav className="ml-2 hidden items-center gap-1 md:flex">
              {globalNavActions.map((action) => {
                const active = pathname === action.href || (action.href !== "/app" && pathname.startsWith(action.href));
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    prefetch={false}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition",
                      active ? "bg-amber-500/10 text-amber-100 shadow-[inset_0_0_0_1px_rgba(230,179,37,0.3)]" : "text-slate-400 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {action.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Link href="/app" className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-[#11151e] py-1 pl-1 pr-3 text-xs text-slate-200 transition hover:border-amber-400/60">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-100">{(user.displayName || user.username).slice(0, 2).toUpperCase()}</span>
                )}
                Open app
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300 hover:text-white">Sign in</Link>
                <Link href="/register" className="rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 hover:bg-amber-300">Join free</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className={cn("relative mx-auto space-y-4 px-4 py-5 md:px-6", maxWidthClassName)}>
        <section className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-[#0d1119] p-5 md:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_20%,rgba(230,179,37,0.18),transparent_45%)]" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(230,179,37,0.9)]" /> {eyebrow}
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
                      "inline-flex items-center rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] transition",
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
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{metric.label}</p>
                <p className={cn("nf-heading mt-1 text-lg font-bold", metricToneClass(metric.tone))}>{metric.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="[&_.forge-panel]:rounded-2xl [&_.forge-panel]:border-amber-500/15 [&_.forge-panel]:bg-[#0d1119] [&_.forge-frame]:rounded-2xl [&_.forge-frame]:border-amber-500/15 [&_.forge-frame]:bg-[#0d1119] [&_.nexus-panel]:bg-[#0d1119] [&_.nexus-panel-glass]:bg-[#0d1119] [&_.nexus-display-panel]:bg-[#11151e]">{children}</div>
      </div>
    </div>
  );
}
