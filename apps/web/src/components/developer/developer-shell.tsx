"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navLinks = [
  { label: "Overview", href: "/developer" },
  { label: "Applications", href: "/developer/applications" },
  { label: "Marketplace", href: "/developer/bots" },
  { label: "Webhooks", href: "/developer/webhooks" },
  { label: "OAuth", href: "/developer/oauth" },
  { label: "Settings", href: "/developer/settings" },
];

type DeveloperShellProps = {
  children: ReactNode;
};

export function DeveloperShell({ children }: DeveloperShellProps) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="rounded-none border border-slate-700/70 bg-slate-950/95 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.3)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Developer Portal</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Developer console</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
              Create, manage, and publish your NexusForge integrations from one central hub.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex h-11 items-center rounded-none px-4 text-sm font-semibold transition ${
                    active
                      ? "border border-amber-400/70 bg-amber-500/15 text-amber-100"
                      : "border border-slate-700/70 bg-slate-900/80 text-slate-200 hover:border-amber-400/50 hover:bg-slate-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
