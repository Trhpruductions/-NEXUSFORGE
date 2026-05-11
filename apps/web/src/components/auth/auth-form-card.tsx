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
      className="w-full max-w-md"
    >
      <div className="nexus-panel-strong overflow-hidden rounded-3xl p-6 sm:p-8">
        {/* Brand header */}
        <div className="mb-7 flex items-center gap-3.5">
          <div className="relative h-12 w-12 overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-950/80">
            <Image
              src="/brand/nexusforge-main-logo.png"
              alt="NexusForge"
              fill
              sizes="48px"
              priority
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-cyan-400">NexusForge</p>
            <h1 className="font-[family-name:var(--font-orbitron)] text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
          </div>
        </div>

        <p className="mb-6 text-sm text-slate-400">{subtitle}</p>

        {/* Form content */}
        {children}

        {footer ? <div className="mt-5 text-sm text-slate-400">{footer}</div> : null}
      </div>
    </motion.section>
  );
}
