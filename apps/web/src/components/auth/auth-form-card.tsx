"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

type AuthFormCardProps = {
  title: string;
  subtitle: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function AuthFormCard({ title, subtitle, footer, children }: AuthFormCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: "easeOut" }}
      className="w-full max-w-md lg:max-w-lg"
    >
      <div className="nexus-panel-strong relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="nexus-ambient" aria-hidden="true">
          <div className="nexus-ambient-orb nexus-ambient-orb-a" />
          <div className="nexus-ambient-orb nexus-ambient-orb-c" />
        </div>
        {/* Brand header */}
        <div className="relative mb-7 flex items-center gap-3.5">
          <div className="orbital-logo logo-throb relative h-12 w-12 overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-950/80 shadow-[0_14px_30px_rgba(8,47,73,0.28)]">
            <Image
              src="/brand/nexusforge-main-logo.png"
              alt="NexusForge"
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-cyan-400">NexusForge</p>
            <h1 className="font-[family-name:var(--font-orbitron)] text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
          </div>
        </div>

        <p className="relative mb-6 text-sm text-slate-400">{subtitle}</p>
        <div className="nexus-signal-rail relative mb-6 flex items-center justify-between rounded-xl px-3 py-2 text-[11px] text-slate-300">
          <span className="inline-flex items-center gap-2">
            <span className="nexus-signal-dot" />
            Auth rail secured
          </span>
          <span className="text-cyan-200">Session restore enabled</span>
        </div>

        {/* Form content */}
        <div className="relative">{children}</div>

        {footer ? <div className="relative mt-5 text-sm text-slate-400">{footer}</div> : null}
      </div>
    </motion.section>
  );
}
