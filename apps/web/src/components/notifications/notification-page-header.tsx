"use client";

import { useEffect, useRef } from "react";
import { getCustomDesignImageUrl } from "@/lib/custom-design-client";

type NotificationPageHeaderProps = {
  title: string;
  subtitle: string;
  description: string;
  badgeLabel: string;
  badgeValue: string;
  heroImages: string[];
};

export function NotificationPageHeader({
  title,
  subtitle,
  description,
  badgeLabel,
  badgeValue,
  heroImages,
}: NotificationPageHeaderProps) {
  const heroImage = getCustomDesignImageUrl(heroImages, "/app-hero.png");
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bgRef.current) {
      bgRef.current.style.backgroundImage = `url('${heroImage}')`;
    }
  }, [heroImage]);

  return (
    <div className="space-y-6">
      <div
        ref={bgRef}
        className="relative min-h-[420px] overflow-hidden rounded-none border border-slate-700/70 bg-[#09040b]/95 shadow-none bg-cover bg-center"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#09040b]/95 via-[#09040b]/20 to-[#09040b]/95" />
        <div className="absolute inset-0 bg-[#09040b]/60" />
        <div className="relative p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Alert center</p>
          <h1 className="mt-3 text-4xl font-semibold text-white">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{subtitle}</p>
        </div>
      </div>

      <section className="rounded-none border border-slate-700/70 bg-[#0c0508]/95 p-6 shadow-none">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-amber-300">{badgeLabel}</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">{description}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-none border border-slate-700/70 bg-[#12070b]/80 px-4 py-3 text-sm text-slate-300">
            <span className="text-amber-300">{badgeValue}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

