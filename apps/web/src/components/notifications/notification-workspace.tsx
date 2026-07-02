"use client";

import { Suspense } from "react";
import Link from "next/link";
import { NotificationCenter } from "@/components/notifications/notification-center";

export type NotificationWorkspaceFilter = {
  label: string;
  href: string;
  variant?: "glow" | "outline";
};

type NotificationWorkspaceProps = {
  panelLabel: string;
  panelDescription: string;
  filterLinks?: NotificationWorkspaceFilter[];
};

function getFilterClass(variant: NotificationWorkspaceFilter["variant"]) {
  if (variant === "glow") {
    return "nexus-glow-button rounded-full px-4 py-2 text-xs font-semibold";
  }
  return "nexus-outline-button rounded-full px-4 py-2 text-xs font-semibold";
}

export function NotificationWorkspace({ panelLabel, panelDescription, filterLinks = [] }: NotificationWorkspaceProps) {
  return (
    <>
      <div className="nexus-display-panel mb-5 rounded-[24px] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-amber-700">{panelLabel}</p>
            <p className="mt-2 text-sm text-slate-600">{panelDescription}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterLinks.map((filter) => (
              <Link key={filter.href} href={filter.href} className={getFilterClass(filter.variant)}>
                {filter.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <Suspense fallback={<div className="nexus-metric-card rounded-[20px] p-5 text-sm text-slate-500">Loading notifications...</div>}>
        <NotificationCenter />
      </Suspense>
    </>
  );
}
