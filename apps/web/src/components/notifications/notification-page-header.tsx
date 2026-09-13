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
    <section className="rounded-[32px] border border-white/10 bg-[#11151e] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
      <div
        ref={bgRef}
        className="relative min-h-[420px] overflow-hidden rounded-[28px] border border-white/10 bg-cover bg-center"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/45 to-white/90" />
        <div className="absolute inset-0 bg-white/25" />

        <div className="relative flex h-full flex-col justify-between p-6 sm:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-amber-300">Alert center</p>
            <h1 className="mt-3 text-4xl font-semibold text-white">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">{subtitle}</p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#11151e] p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-amber-300">{badgeLabel}</p>
                <h2 className="mt-3 text-3xl font-semibold text-white">{title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">{description}</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0d1119] px-4 py-3 text-sm text-slate-400 shadow-sm">
                <span className="text-amber-300">{badgeValue}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

