"use client";
// Voice room view layout

import { motion } from "framer-motion";
import { Bell, Mic, Play, Users } from "lucide-react";
import { RevealSection } from "@/components/ui/reveal-section";
import { DynamicBackground } from "@/components/ui/dynamic-background";

const participants = [
  { name: "Astra", role: "Lead", status: "Live", levels: [92, 78, 84] },
  { name: "Nova", role: "Support", status: "Muted", levels: [18, 10, 0] },
  { name: "Vex", role: "Tactics", status: "Live", levels: [86, 74, 64] },
  { name: "Cora", role: "Stream", status: "Live", levels: [94, 90, 88] },
];

const waveformWidths = ["w-[88%]", "w-[76%]", "w-[64%]", "w-[52%]", "w-[40%]"];
const levelWidthClasses = new Map<number, string>([
  [0, "w-[0%]"],
  [10, "w-[10%]"],
  [18, "w-[18%]"],
  [64, "w-[64%]"],
  [74, "w-[74%]"],
  [78, "w-[78%]"],
  [84, "w-[84%]"],
  [86, "w-[86%]"],
  [88, "w-[88%]"],
  [90, "w-[90%]"],
  [92, "w-[92%]"],
  [94, "w-[94%]"],
]);

function getLevelWidthClass(level: number) {
  return levelWidthClasses.get(level) ?? `w-[${Math.round(level / 5) * 5}%]`;
}

function participantBadge(status: string) {
  if (status === "Live") return "bg-amber-400";
  if (status === "Muted") return "bg-slate-500";
  return "bg-rose-500";
}

export function VoiceRoomView({ heroImageSrc, chatPreviewSrc }: { heroImageSrc: string; chatPreviewSrc: string }) {
  return (
    <div className="relative grid gap-6 pb-28 md:pb-0">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_top,rgba(227,27,35,0.18),transparent_30%)]" />
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <RevealSection delay={120} className="reveal-root">
          <header className="nexus-panel-glass relative overflow-hidden rounded-[32px] border border-slate-700/70 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,184,108,0.12),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.12),transparent_20%)]" />
          <div className="relative mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-amber-400/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-3 text-amber-100">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_16px_rgba(255,184,108,0.35)]" />
              Live Arena Open
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-slate-400">
              <span>Audience 8,543</span>
              <span>Latency 22ms</span>
              <span>Spatial audio</span>
            </div>
          </div>
          <div className="mb-4 flex gap-2 overflow-x-auto rounded-[28px] border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-200 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-xl xl:hidden snap-x snap-mandatory scroll-pl-4">
            {[
              { label: "Mute", icon: "M" },
              { label: "Invite", icon: "I" },
              { label: "Share", icon: "S" },
              { label: "Stage", icon: "T" },
            ].map((action) => (
              <button key={action.label} className="snap-start whitespace-nowrap rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-amber-400/50 hover:bg-slate-900/95">
                {action.label}
              </button>
            ))}
          </div>
          <div className="grid gap-3 rounded-[28px] border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-200 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-xl xl:hidden">
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { label: "Audience", value: "8.5K" },
                { label: "Latency", value: "22ms" },
                { label: "Spatial", value: "Audio" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-3xl border border-slate-700/70 bg-slate-900/85 px-3 py-3 text-center">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">{stat.label}</p>
                  <p className="mt-2 text-sm font-semibold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-100">Stage tuned</span>
              <button type="button" className="rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-amber-400/50 hover:bg-slate-900/95">
                Stage tools
              </button>
            </div>
          </div>
          <div className="hidden rounded-[28px] border border-slate-700/70 bg-slate-950/70 px-4 py-3 text-sm text-slate-200 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-xl xl:flex xl:items-center xl:justify-between xl:gap-3">
            <div className="flex flex-wrap items-center gap-3 text-slate-300">
              <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-100">Stage ready</span>
              <span className="rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">3 active channels</span>
              <span className="rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">Mix mode</span>
            </div>
            <button type="button" className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-100 transition hover:bg-amber-500/20">
              Manage stage
            </button>
          </div>
          <div className="grid gap-3 rounded-[28px] border border-slate-700/70 bg-slate-950/70 p-4 text-slate-200 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] xl:grid-cols-[1fr_1fr]">
            <div className="flex flex-col gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-100">
                Stage aura
              </div>
              <p className="text-sm text-slate-300">The listening stage is tuned for low latency, immersive audio, and squad sync.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: "Audio", active: true },
                { label: "Chat", active: false },
                { label: "Security", active: false },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${action.active ? "bg-amber-500/15 text-amber-100 border border-amber-400/30" : "bg-slate-900/80 text-slate-200 border border-slate-700/70 hover:border-amber-400/50 hover:bg-slate-900/95"}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,184,108,0.12),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.12),transparent_20%)]" />
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: "easeOut" }} className="relative grid gap-6 lg:grid-cols-[1.45fr_0.95fr] lg:items-center">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.3em] text-amber-300">Community Listenings</p>
              <h1 className="text-4xl font-semibold text-white">Forge Arena: Shared Listening Stage</h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-300">Hold live audio sessions, discover audience rooms, and keep your community connected through immersive shared sound.</p>
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
                <div className="rounded-3xl border border-slate-700/70 bg-slate-950/85 p-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Active speakers</p>
                  <p className="mt-2 text-2xl font-semibold text-white">3</p>
                </div>
                <div className="rounded-3xl border border-slate-700/70 bg-slate-950/85 p-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Latency</p>
                  <p className="mt-2 text-2xl font-semibold text-white">22ms</p>
                </div>
                <div className="rounded-3xl border border-slate-700/70 bg-slate-950/85 p-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Stage</p>
                  <p className="mt-2 text-2xl font-semibold text-white">Stage One</p>
                </div>
                <div className="rounded-3xl border border-slate-700/70 bg-slate-900/85 p-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Audience</p>
                  <p className="mt-2 text-2xl font-semibold text-white">8.5K</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-slate-700/70 bg-slate-900/85 p-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Mic state</p>
                  <p className="mt-2 text-2xl font-semibold text-white">Connected</p>
                </div>
                <div className="rounded-3xl border border-slate-700/70 bg-slate-900/85 p-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Space</p>
                  <p className="mt-2 text-2xl font-semibold text-white">4 speakers</p>
                </div>
                <div className="rounded-3xl border border-slate-700/70 bg-slate-900/85 p-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Spatial mix</p>
                  <p className="mt-2 text-2xl font-semibold text-white">7.2</p>
                </div>
              </div>
            </div>

            <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55, ease: "easeOut" }} className="space-y-4 rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] nexus-glow-border">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Spatial audio status</p>
                  <p className="mt-2 text-xl font-semibold text-white">Live and tuned</p>
                </div>
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-amber-100">Active</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button className="nexus-button-primary inline-flex w-full items-center justify-center gap-2 rounded-3xl px-4 py-3 text-sm font-semibold">
                  <Play className="h-4 w-4" />
                  Join Voice
                </button>
                <button className="nexus-button-secondary w-full rounded-3xl px-4 py-3 text-sm font-semibold">Stage Controls</button>
                <button className="nexus-button-secondary w-full rounded-3xl px-4 py-3 text-sm font-semibold sm:col-span-2">Audio Settings</button>
              </div>
            </motion.div>
          </motion.div>
        </header>
        </RevealSection>

        <RevealSection delay={180} className="reveal-root">
          <section className="grid gap-4 md:grid-cols-[1.4fr_0.95fr] xl:grid-cols-[1.6fr_0.9fr]">
          <div className="nexus-panel-glass relative rounded-[32px] border border-slate-700/70 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(255,215,0,0.12),transparent_40%)]" />
            <div className="relative z-10 grid gap-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Arena preview</p>
                  <h2 className="mt-2 text-3xl font-semibold text-white">Raid audio stage</h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-sm text-slate-200">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  Live room
                </div>
              </div>

              <DynamicBackground
                url={heroImageSrc}
                className="relative overflow-hidden rounded-[28px] border border-slate-700/70 bg-slate-900/80 nexus-hero nexus-glow-border h-[420px] sm:h-[360px] transition-transform duration-500 ease-out hover:-translate-y-0.5 bg-cover bg-center"
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_40%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,184,108,0.06),transparent_35%)] mix-blend-screen" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-transparent to-transparent" />
                <div className="absolute left-6 top-6 rounded-[24px] border border-amber-400/20 bg-[#09040b]/85 px-4 py-3 text-sm text-amber-100 shadow-[0_18px_40px_rgba(0,0,0,0.32)] backdrop-blur-xl">
                  <p className="uppercase tracking-[0.22em] text-amber-300">Stage view</p>
                  <p className="mt-2 font-semibold text-white">Harmonic lounge</p>
                </div>
                <div className="absolute right-6 top-24 rounded-[26px] border border-slate-700/70 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 shadow-[0_18px_40px_rgba(0,0,0,0.32)] backdrop-blur-xl">
                  <p className="uppercase tracking-[0.22em] text-amber-300">Signal strength</p>
                  <div className="mt-3 space-y-2">
                    {[
                      { label: "Audio", value: "98%" },
                      { label: "Network", value: "92%" },
                      { label: "Sync", value: "100%" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900/80 px-3 py-2">
                        <span className="text-xs text-slate-400">{item.label}</span>
                        <span className="text-sm font-semibold text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="absolute inset-x-6 bottom-6 rounded-[26px] border border-slate-700/70 bg-slate-950/85 p-4 backdrop-blur-xl">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-amber-300">Live waveform</p>
                  <div className="mt-3 space-y-2">
                    {waveformWidths.map((widthClass, index) => (
                      <div key={index} className={`h-2 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 opacity-90 ${widthClass}`} />
                    ))}
                  </div>
                </div>
              </DynamicBackground>

              <div className="grid gap-4">
                <div className="rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Voice Mix</p>
                  <div className="mt-4 grid gap-3">
                    {participants.map((participant) => (
                      <div key={participant.name} className="rounded-3xl border border-slate-700/70 bg-slate-900/85 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{participant.name}</p>
                            <p className="text-[11px] text-slate-400">{participant.role}</p>
                          </div>
                          <span className={`inline-flex h-2.5 w-2.5 rounded-full ${participantBadge(participant.status)}`} />
                        </div>
                        <div className="mt-3 grid gap-2">
                          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-slate-500">
                            <span>Voice level</span>
                            <span>{participant.status === "Muted" ? "Muted" : "Live"}</span>
                          </div>
                          <div className="flex items-end gap-2">
                            {participant.levels.map((level, index) => (
                              <div key={index} className={`h-2 rounded-full bg-slate-800 overflow-hidden ${getLevelWidthClass(level)}`}>
                                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500" />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Live controls</p>
                  <div className="mt-4 grid gap-3">
                    <button className="nexus-button-secondary inline-flex w-full items-center justify-between rounded-3xl px-4 py-3 text-sm font-semibold">
                      <Mic size={16} /> Mute mic
                    </button>
                    <button className="nexus-button-secondary inline-flex w-full items-center justify-between rounded-3xl px-4 py-3 text-sm font-semibold">
                      <Bell size={16} /> Silence alerts
                    </button>
                    <button className="nexus-button-secondary inline-flex w-full items-center justify-between rounded-3xl px-4 py-3 text-sm font-semibold">
                      <Users size={16} /> Invite squad
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
            <div className="rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Stage roster</p>
              <div className="mt-4 space-y-3">
                {participants.map((participant) => (
                  <div key={participant.name} className="flex items-center justify-between rounded-3xl border border-slate-700/70 bg-slate-900/85 px-4 py-3">
                    <div>
                      <p className="font-semibold text-white">{participant.name}</p>
                      <p className="text-[11px] text-slate-400">{participant.role}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white ${participant.status === "Live" ? "bg-amber-500/20 text-amber-200" : "bg-slate-600/20 text-slate-300"}`}>
                      {participant.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Room metrics</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-4">
                  <p className="text-[11px] text-slate-400">Max volume</p>
                  <p className="mt-1 text-2xl font-semibold text-white">82%</p>
                </div>
                <div className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-4">
                  <p className="text-[11px] text-slate-400">Echo reduction</p>
                  <p className="mt-1 text-2xl font-semibold text-white">Enabled</p>
                </div>
                <div className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-4">
                  <p className="text-[11px] text-slate-400">Noise gate</p>
                  <p className="mt-1 text-2xl font-semibold text-white">Active</p>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Room health</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Signal", value: "Excellent" },
                  { label: "Sync", value: "Stable" },
                  { label: "Echo", value: "Suppressed" },
                ].map((item) => (
                  <div key={item.label} className="rounded-3xl border border-slate-700/70 bg-slate-900/85 p-4">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Live queue</p>
                <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Now tuning</span>
              </div>
              <div className="mt-4 space-y-3">
                {[
                  { label: "Nexus Pulse", eta: "+2 min" },
                  { label: "Orbit Drop", eta: "+5 min" },
                  { label: "Spectral Sync", eta: "+10 min" },
                ].map((track) => (
                  <div key={track.label} className="rounded-3xl border border-slate-700/70 bg-slate-900/85 px-4 py-3">
                    <div className="flex items-center justify-between gap-3 text-sm text-slate-100">
                      <span>{track.label}</span>
                      <span className="rounded-full bg-slate-800/90 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                        {track.eta}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Command highlights</p>
              <div className="mt-4 space-y-3">
                {[
                  { cmd: "/echo", desc: "Broadcast sensor ping." },
                  { cmd: "/stage", desc: "Toggle stage access." },
                  { cmd: "/pulse", desc: "Sync audience tempo." },
                ].map((item) => (
                  <div key={item.cmd} className="rounded-3xl border border-slate-700/70 bg-slate-900/85 px-4 py-3">
                    <p className="text-sm font-semibold text-white">{item.cmd}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-700/70 bg-slate-950/85 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300">Chat command preview</p>
              <DynamicBackground
                url={chatPreviewSrc}
                className="mt-4 overflow-hidden rounded-[28px] border border-slate-700/70 bg-slate-900/80 bg-cover bg-center"
              />
            </div>
          </aside>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 md:hidden">
          <div className="mx-auto flex max-w-[1440px] rounded-[28px] border border-slate-700/70 bg-slate-950/95 p-3 shadow-[0_-18px_45px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Voice quick controls</p>
              <p className="truncate text-sm font-semibold text-white">Live room ready</p>
            </div>
            <div className="ml-3 grid w-full grid-cols-3 gap-2">
              <button className="nexus-button-primary inline-flex h-11 items-center justify-center rounded-3xl px-3 text-xs font-semibold">Join</button>
              <button className="nexus-button-secondary inline-flex h-11 items-center justify-center rounded-3xl px-3 text-xs font-semibold">Stage</button>
              <button className="nexus-button-secondary inline-flex h-11 items-center justify-center rounded-3xl px-3 text-xs font-semibold">Audio</button>
            </div>
          </div>
        </div>
        </RevealSection>
      </div>
    </div>
  );
}
