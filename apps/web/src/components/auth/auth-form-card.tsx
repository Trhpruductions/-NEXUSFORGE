"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

type AuthFormCardProps = {
  title: string;
  subtitle: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function AuthFormCard({ title, subtitle, footer, children }: AuthFormCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="nexus-panel-strong grid w-full max-w-4xl overflow-hidden rounded-3xl lg:grid-cols-[1fr_320px]"
    >
      <div className="p-5 sm:p-7">
        <div className="mb-6 grid gap-4">
          <div className="flex items-center gap-3">
            <div className="ember-frame holo-frame orbital-logo h-14 w-14 overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-950/80 p-1.5">
              <img
                src="/brand/nexusforge-main-logo.png"
                alt="NexusForge main logo"
                className="image-pan h-full w-full rounded-xl object-cover"
              />
            </div>
            <div>
              <p className="nexus-eyebrow text-cyan-300">NexusForge Identity</p>
              <h1 className="nexus-title text-slate-50">{title}</h1>
            </div>
          </div>
          <p className="nexus-subtitle text-slate-400">{subtitle}</p>
        </div>
        <div>{children}</div>
        {footer ? <div className="mt-5 text-sm text-slate-400">{footer}</div> : null}
      </div>

      <aside className="relative hidden border-l border-slate-700/70 bg-slate-950/55 p-5 lg:block">
        <p className="nexus-eyebrow text-amber-200">Live Identity Surface</p>
        <div className="ember-frame holo-frame mt-3">
          <img src="/brand/nexusforge-main-logo.png" alt="NexusForge visual panel" className="image-pan h-[210px] w-full rounded-2xl object-cover" />
        </div>
        <div className="mt-3 space-y-2 text-xs text-slate-300">
          <div className="glass-cut rounded-lg px-2.5 py-2">Realtime gateway integrity</div>
          <div className="glass-cut rounded-lg px-2.5 py-2">Secure account layer</div>
          <div className="glass-cut rounded-lg px-2.5 py-2">Premium-ready profile stack</div>
        </div>
      </aside>
    </motion.section>
  );
}
