"use client";

import { motion } from "framer-motion";
import {
  Compass,
  Home,
  Plus,
  Settings,
  Users,
  Volume2,
  Hash,
  Video,
  Radio,
} from "lucide-react";

const forgeItems = ["Nexus Core", "RaidOps", "Arc Forge", "Pixel Syndicate"];
const textChannels = ["general", "clips", "strategy", "trade-hub"];
const voiceChannels = ["Squad Alpha", "Raid Room", "Stage Broadcast"];

export function AppShell() {
  return (
    <div className="relative grid min-h-[74vh] grid-cols-1 gap-3 lg:grid-cols-[84px_280px_minmax(0,1fr)_280px]">
      <aside className="nexus-panel rounded-2xl p-3">
        <div className="grid h-full grid-rows-[auto_1fr_auto] gap-4">
          <button
            aria-label="User profile"
            title="User profile"
            className="grid h-14 place-items-center overflow-hidden rounded-xl border border-cyan-500/35 bg-slate-950/85 p-1.5"
          >
            <img src="/brand/nexusforge-main-logo.png" alt="NexusForge logo" className="h-full w-full rounded-lg object-cover" />
          </button>
          <div className="grid content-start gap-3">
            {[Home, Users, Compass].map((Icon, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + index * 0.08 }}
                className="grid h-12 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-500/60"
              >
                <Icon size={20} />
              </motion.button>
            ))}
            <button
              aria-label="Add forge"
              title="Add forge"
              className="grid h-12 place-items-center rounded-xl border border-dashed border-slate-600 bg-slate-900/70 text-slate-300 hover:border-cyan-500/60"
            >
              <Plus size={20} />
            </button>
          </div>
          <button
            aria-label="Settings"
            title="Settings"
            className="grid h-12 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-500/60"
          >
            <Settings size={20} />
          </button>
        </div>
      </aside>

      <aside className="nexus-panel rounded-2xl p-4">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Forges</h2>
        <div className="mb-4 grid gap-2">
          {forgeItems.map((forge) => (
            <button key={forge} className="rounded-lg border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-left text-sm text-slate-100 transition hover:border-cyan-500/60 hover:bg-cyan-950/20">
              {forge}
            </button>
          ))}
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Text Channels</p>
        <div className="mb-4 grid gap-1">
          {textChannels.map((channel) => (
            <button key={channel} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-800/80 hover:text-slate-50">
              <Hash size={15} /> {channel}
            </button>
          ))}
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Voice Channels</p>
        <div className="grid gap-1">
          {voiceChannels.map((channel) => (
            <button key={channel} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-800/80 hover:text-slate-50">
              <Volume2 size={15} /> {channel}
            </button>
          ))}
        </div>
      </aside>

      <main className="nexus-panel-strong rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between border-b border-slate-700/70 pb-3">
          <h3 className="text-lg font-semibold text-slate-50"># general</h3>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Video size={16} /> Live stream active
          </div>
        </div>

        <div className="grid gap-3">
          {["Welcome to NexusForge.", "Squad queue starts in 10 minutes.", "Upload your best clip in #clips."].map((message, idx) => (
            <motion.article
              key={message}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + idx * 0.1 }}
              className="rounded-xl border border-slate-700/70 bg-slate-900/85 p-3 text-sm text-slate-200"
            >
              {message}
            </motion.article>
          ))}
        </div>
      </main>

      <aside className="nexus-panel rounded-2xl p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Activity</h2>
        <div className="mb-5 rounded-xl border border-slate-700/80 bg-slate-900/80 p-3 text-sm text-slate-200 shadow-[0_10px_24px_rgba(15,23,42,0.35)]">
          <p className="mb-2 flex items-center gap-2 text-cyan-300">
            <Radio size={15} /> Streaming now
          </p>
          <p>NovaCaster in Squad Alpha</p>
        </div>

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Members Online</h3>
        <div className="grid gap-2">
          {["Astra", "Cipher", "Lynx", "Vektor"].map((member) => (
            <div key={member} className="rounded-lg border border-slate-700/80 bg-slate-900/75 px-3 py-2 text-sm text-slate-200">
              {member}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
