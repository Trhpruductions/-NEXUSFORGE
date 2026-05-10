"use client";

import { motion } from "framer-motion";

export function NexusforgeBrandShowcase() {
  return (
    <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="nexus-panel-strong relative overflow-hidden rounded-3xl p-5 sm:p-7"
      >
        <div className="absolute -top-24 right-[-72px] h-52 w-52 rounded-full bg-red-500/20 blur-3xl" />
        <div className="absolute -bottom-28 left-[-80px] h-56 w-56 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(122deg,rgba(34,211,238,0.06),transparent_30%,rgba(251,146,60,0.08))]" />
        <p className="relative z-10 text-[11px] uppercase tracking-[0.26em] text-amber-200">NexusForge Identity</p>
        <h2 className="relative z-10 mt-2 font-[family-name:var(--font-orbitron)] text-2xl text-slate-50 sm:text-4xl">
          Branded visuals, alive in real time.
        </h2>
        <p className="relative z-10 mt-2 max-w-2xl text-sm text-slate-300">
          The app now supports cinematic branding surfaces with motion layers, premium card framing, and reactive glow treatment.
        </p>

        <div className="relative z-10 mt-4 grid gap-2 text-xs text-slate-200 sm:grid-cols-3">
          <div className="glass-cut rounded-xl px-3 py-2">Reactive gradients</div>
          <div className="glass-cut rounded-xl px-3 py-2">Animated premium framing</div>
          <div className="glass-cut rounded-xl px-3 py-2">Live app identity surfaces</div>
        </div>

        <motion.div
          className="relative z-10 mt-6"
          animate={{ y: [0, -5, 0], scale: [1, 1.01, 1] }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          whileHover={{ scale: 1.015, rotateX: -1.5, rotateY: 1.5 }}
        >
          <div className="ember-frame holo-frame orbital-logo">
            <img
              src="/brand/nexusforge-main-logo.png"
              alt="NexusForge logo"
              className="image-pan h-[280px] w-full rounded-2xl object-cover sm:h-[320px]"
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
          className="nexus-panel relative overflow-hidden rounded-3xl p-5"
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200">Core+ Card</p>
          <p className="mt-1 text-xs text-slate-400">Premium identity card with utility and cosmetic perks.</p>
          <motion.div whileHover={{ scale: 1.02, rotateX: -1.5, rotateY: 1.5 }} className="ember-frame holo-frame mt-3">
            <img
              src="/brand/core-plus-card.png"
              alt="NexusForge Core+ membership card"
              className="image-pan h-52 w-full rounded-2xl object-cover"
            />
          </motion.div>
          <p className="mt-3 text-xs text-cyan-100">Includes profile prestige, queue priority, and premium visuals.</p>
        </motion.article>

        <motion.article
          initial={{ opacity: 0, x: 18 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.12 }}
          className="nexus-panel relative overflow-hidden rounded-3xl p-5"
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200">Boost Levels</p>
          <p className="mt-1 text-xs text-slate-400">Tiered performance and access upgrades with forge progression.</p>
          <motion.div whileHover={{ scale: 1.02, rotateX: -1.5, rotateY: 1.5 }} className="ember-frame holo-frame mt-3">
            <img
              src="/brand/boost-levels-card.png"
              alt="NexusForge boost level tiers"
              className="image-pan h-52 w-full rounded-2xl object-cover"
            />
          </motion.div>
          <p className="mt-3 text-xs text-emerald-100">Designed for visible progression and high-retention engagement loops.</p>
        </motion.article>
      </div>
    </section>
  );
}
