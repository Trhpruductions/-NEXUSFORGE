"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export function NexusforgeBrandShowcase() {
  return (
    <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="nexus-panel-strong relative overflow-hidden rounded-[28px] border border-slate-900/10 bg-white/85 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)] sm:p-7"
      >
        <div className="absolute -top-24 right-[-72px] h-52 w-52 rounded-full bg-red-500/10 blur-3xl" />
        <div className="absolute -bottom-28 left-[-80px] h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(122deg,rgba(255,184,108,0.06),transparent_30%,rgba(251,146,60,0.08))]" />
        <p className="relative z-10 text-[11px] uppercase tracking-[0.26em] text-amber-600">NexusForge Identity</p>
        <h2 className="relative z-10 mt-2 font-[family-name:var(--font-orbitron)] text-2xl text-slate-950 sm:text-4xl">
          Branded visuals, alive in real time.
        </h2>
        <p className="relative z-10 mt-2 max-w-2xl text-sm text-slate-600">
          The app now supports cinematic branding surfaces with motion layers, premium card framing, and reactive glow treatment.
        </p>

        <div className="relative z-10 mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
          <div className="glass-cut rounded-full border border-slate-900/10 bg-white/85 px-3 py-2">Reactive gradients</div>
          <div className="glass-cut rounded-full border border-slate-900/10 bg-white/85 px-3 py-2">Animated premium framing</div>
          <div className="glass-cut rounded-full border border-slate-900/10 bg-white/85 px-3 py-2">Live app identity surfaces</div>
        </div>

        <motion.div
          className="relative z-10 mt-6"
          animate={{ y: [0, -5, 0], scale: [1, 1.01, 1] }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          whileHover={{ scale: 1.015, rotateX: -1.5, rotateY: 1.5 }}
        >
          <div className="ember-frame holo-frame orbital-logo">
            <Image
              src="/brand/nexusforge-logo.png"
              alt="NexusForge logo"
              width={720}
              height={240}
              className="image-pan max-h-[240px] rounded-[22px] object-contain"
              style={{ width: "100%", height: "auto" }}
            />
          </div>
        </motion.div>
      </motion.article>

      <div className="grid gap-4">
        <motion.article
          initial={{ opacity: 0, x: 18 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.06 }}
          className="nexus-panel relative overflow-hidden rounded-[28px] border border-slate-900/10 bg-white/85 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]"
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-600">Boost Tier Badges</p>
          <p className="mt-1 text-xs text-slate-600">Starter Core through Infinite League in one visual ladder.</p>
          <motion.div whileHover={{ scale: 1.02, rotateX: -1.5, rotateY: 1.5 }} className="ember-frame holo-frame mt-3">
            <Image
              src="/brand/boost-tier-badges.png"
              alt="NexusForge boost tier badges"
              width={640}
              height={640}
              className="image-pan h-auto w-full rounded-[22px] object-cover"
            />
          </motion.div>
          <p className="mt-3 text-xs text-amber-700">Used as the canonical tier art across pricing and Core+ surfaces.</p>
        </motion.article>

        <motion.article
          initial={{ opacity: 0, x: 18 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.12 }}
          className="nexus-panel relative overflow-hidden rounded-[28px] border border-slate-900/10 bg-white/85 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]"
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-600">Boost Pack Emblem</p>
          <p className="mt-1 text-xs text-slate-600">Primary icon for boost offers, promos, and purchase rails.</p>
          <motion.div whileHover={{ scale: 1.02, rotateX: -1.5, rotateY: 1.5 }} className="ember-frame holo-frame mt-3">
            <Image
              src="/brand/boost-pack-icon.png"
              alt="NexusForge boost pack icon"
              width={640}
              height={640}
              className="image-pan h-auto w-full rounded-[22px] object-cover"
            />
          </motion.div>
          <p className="mt-3 text-xs text-amber-700">Designed for visible progression and high-retention engagement loops.</p>
        </motion.article>
      </div>
    </section>
  );
}

