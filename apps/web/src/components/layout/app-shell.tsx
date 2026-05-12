"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import {
  Compass,
  Home,
  Plus,
  Shield,
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
const liveEvents = [
  { title: "Queue opens", detail: "Ranked push in 08:24", tone: "text-cyan-200" },
  { title: "Boost multipliers", detail: "Core+ raid bonus active", tone: "text-amber-200" },
  { title: "Moderation layer", detail: "AI guardrails synced", tone: "text-emerald-200" },
];

export function AppShell() {
  return (
    <div className="relative grid h-full w-full grid-cols-1 gap-0 lg:grid-cols-[84px_280px_minmax(0,1fr)_280px]">
      <aside className="nexus-display-panel rounded-[28px] p-3">
        <div className="grid h-full grid-rows-[auto_1fr_auto] gap-4">
          <button
            aria-label="User profile"
            title="User profile"
            className="orbital-logo slow-float relative grid h-14 place-items-center overflow-hidden rounded-xl border border-cyan-500/35 bg-slate-950/85 p-1.5"
          >
            <Image
              src="/brand/nexusforge-main-logo.png"
              alt="NexusForge logo"
              width={56}
              height={56}
              className="h-full w-full rounded-lg object-cover"
            />
          </button>
          <div className="grid content-start gap-3">
            {[Home, Users, Compass].map((Icon, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + index * 0.08 }}
                className="nexus-interactive-btn grid h-12 place-items-center rounded-xl border border-slate-700 bg-slate-900/85 text-slate-200 transition hover:-translate-y-0.5 hover:border-cyan-500/60"
              >
                <Icon size={20} />
              </motion.button>
            ))}
            <button
              aria-label="Add forge"
              title="Add forge"
              className="nexus-interactive-btn grid h-12 place-items-center rounded-xl border border-dashed border-slate-600 bg-slate-900/70 text-slate-300 hover:border-cyan-500/60"
            >
              <Plus size={20} />
            </button>
          </div>
          <button
            aria-label="Settings"
            title="Settings"
            className="nexus-interactive-btn grid h-12 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-500/60"
          >
            <Settings size={20} />
          </button>
        </div>
      </aside>

      <aside className="nexus-display-panel rounded-[28px] p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Forges</h2>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-100"><span className="nexus-signal-dot" />Live</span>
        </div>
        <div className="mb-4 grid gap-2">
          {forgeItems.map((forge, index) => (
            <button key={forge} className="nexus-interactive-card rounded-xl border border-slate-700/70 bg-slate-900/80 px-3 py-3 text-left text-sm text-slate-100 transition hover:border-cyan-500/60 hover:bg-cyan-950/20">
              <div className="flex items-center justify-between gap-3">
                <span>{forge}</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">0{index + 1}</span>
              </div>
            </button>
          ))}
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Text Channels</p>
        <div className="mb-4 grid gap-1">
          {textChannels.map((channel) => (
            <button key={channel} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-300 transition hover:bg-slate-800/80 hover:text-slate-50">
              <Hash size={15} /> {channel}
            </button>
          ))}
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Voice Channels</p>
        <div className="grid gap-1">
          {voiceChannels.map((channel) => (
            <button key={channel} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-300 transition hover:bg-slate-800/80 hover:text-slate-50">
              <Volume2 size={15} /> {channel}
            </button>
          ))}
        </div>
      </aside>

      <main className="nexus-display-panel nexus-grid-lines rounded-[28px] p-5">
        <div className="mb-5 flex items-center justify-between border-b border-slate-700/70 pb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-300">Featured Lane</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-50"># general</h3>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Video size={16} /> Live stream active
          </div>
        </div>

        <div className="mb-5 grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[24px] border border-slate-700/70 bg-[linear-gradient(135deg,rgba(8,47,73,0.72),rgba(15,23,42,0.82),rgba(251,146,60,0.12))] p-4 shadow-[0_24px_40px_rgba(2,6,23,0.35)]">
            <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-200">Command Broadcast</p>
            <h4 className="mt-2 font-[family-name:var(--font-orbitron)] text-2xl text-white">Squad relay is green across every active forge.</h4>
            <p className="mt-2 max-w-xl text-sm text-slate-200">Messages, voice traffic, and event prompts are aligned in one operational lane instead of feeling scattered.</p>
          </div>
          <div className="nexus-signal-rail rounded-[24px] p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">System Status</p>
            <div className="mt-3 grid gap-2">
              {liveEvents.map((event) => (
                <div key={event.title} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/65 px-3 py-2.5 text-sm text-slate-200">
                  <div>
                    <p className="font-medium text-slate-100">{event.title}</p>
                    <p className="text-xs text-slate-400">{event.detail}</p>
                  </div>
                  <Shield size={16} className={event.tone} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {["Welcome to NexusForge.", "Squad queue starts in 10 minutes.", "Upload your best clip in #clips."].map((message, idx) => (
            <motion.article
              key={message}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + idx * 0.1 }}
              className="nexus-interactive-card rounded-xl border border-slate-700/70 bg-slate-900/85 p-3 text-sm text-slate-200 shadow-[0_12px_24px_rgba(2,6,23,0.22)]"
            >
              {message}
            </motion.article>
          ))}
        </div>
      </main>

      <aside className="nexus-display-panel rounded-[28px] p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Activity</h2>
        <div className="nexus-display-panel mb-5 rounded-[22px] p-3 text-sm text-slate-200 shadow-[0_10px_24px_rgba(15,23,42,0.35)]">
          <p className="mb-2 flex items-center gap-2 text-cyan-300">
            <Radio size={15} /> Streaming now
          </p>
          <p>NovaCaster in Squad Alpha</p>
        </div>

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Members Online</h3>
        <div className="grid gap-2">
          {["Astra", "Cipher", "Lynx", "Vektor"].map((member, index) => (
            <div key={member} className="nexus-interactive-card flex items-center justify-between rounded-lg border border-slate-700/80 bg-slate-900/75 px-3 py-2 text-sm text-slate-200">
              <span>{member}</span>
              <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">R0{index + 1}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
