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
      <div className="rounded-[28px] border border-slate-900/10 bg-white/85 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-600">Developer portal</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Developer console</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
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
                  className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold transition ${
                    active
                      ? "border border-amber-200 bg-amber-50 text-amber-700"
                      : "border border-slate-900/10 bg-white text-slate-600 hover:border-slate-900/20 hover:bg-slate-50"
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
