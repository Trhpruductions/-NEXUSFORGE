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
  const bgRef = useRef<HTMLDivElement | null>(null);
  const heroImage = getCustomDesignImageUrl(heroImages, "/app-hero.png");

  useEffect(() => {
    if (!bgRef.current) return;
    bgRef.current.style.backgroundImage = `url(${heroImage})`;
  }, [heroImage]);

  return (
    <section className="rounded-[32px] border border-slate-900/10 bg-white/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
      <div
        ref={bgRef}
        className="relative min-h-[420px] overflow-hidden rounded-[28px] border border-slate-900/10 bg-cover bg-center"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/45 to-white/90" />
        <div className="absolute inset-0 bg-white/25" />

        <div className="relative flex h-full flex-col justify-between p-6 sm:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-amber-600">Alert center</p>
            <h1 className="mt-3 text-4xl font-semibold text-slate-950">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{subtitle}</p>
          </div>

          <div className="rounded-[24px] border border-slate-900/10 bg-white/80 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-amber-600">{badgeLabel}</p>
                <h2 className="mt-3 text-3xl font-semibold text-slate-950">{title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-sm">
                <span className="text-amber-600">{badgeValue}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

