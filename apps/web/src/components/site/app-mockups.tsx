import Image from "next/image";
import type { ReactNode } from "react";
import { BarChart3, Hash, Headphones, Mic, MonitorUp, PhoneOff, Smile, Video, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Static pictures of the app for the public site, built from markup so they never go stale
 * and never show other people's data. They are decorative, so they are hidden from screen readers;
 * the text next to them carries the meaning.
 */

/** A browser-style window around a picture of the app. */
export function DeviceFrame({ url, className, children }: { url: string; className?: string; children: ReactNode }) {
  return (
    <div aria-hidden="true" className={cn("relative w-full select-none", className)}>
      <div className="relative overflow-hidden rounded-[22px] border border-amber-400/25 bg-[#0b0f17] shadow-[0_30px_90px_rgba(46,164,255,0.18)]">
        <div className="flex items-center gap-1.5 border-b border-white/5 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 min-w-0 truncate rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">{url}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

const serverRail = ["from-amber-300 to-amber-600", "from-violet-400 to-fuchsia-500", "from-sky-400 to-cyan-500", "from-emerald-400 to-teal-500"];
const channels = ["general", "scrims", "highlights", "lfg"];
const chatMessages = [
  { name: "Raven", color: "text-violet-300", text: "Scrims at 9? I'll set up the bracket." },
  { name: "Kade", color: "text-sky-300", text: "In. Need one more for the 5-stack 🎮" },
  { name: "Nova", color: "text-amber-300", text: "Clip from last night is in #highlights 🔥" },
];

/** A server with channels, a voice channel and a chat with a poll. */
export function ServerMockup({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("relative mx-auto w-full max-w-xl select-none", className)}>
      <div className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(46,164,255,0.28),transparent_62%)] blur-2xl" />
      <div className="relative">
        <DeviceFrame url="nfgcord.com/app">
          <div className="grid h-[300px] grid-cols-[44px_1fr] sm:h-[340px] sm:grid-cols-[52px_150px_1fr]">
            <div className="flex flex-col items-center gap-2 border-r border-white/5 bg-[#080b12] py-3">
              <Image src="/brand/nexusforge-emblem-256.png" alt="" width={30} height={30} className="h-7 w-7 rounded-lg sm:h-8 sm:w-8" />
              <span className="h-px w-6 bg-white/10" />
              {serverRail.map((gradient, index) => (
                <span key={gradient} className={`relative h-7 w-7 rounded-[12px] bg-gradient-to-br sm:h-8 sm:w-8 ${gradient} ${index === 0 ? "ring-2 ring-amber-300/70 ring-offset-2 ring-offset-[#080b12]" : "opacity-80"}`}>
                  {index === 1 ? <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">3</span> : null}
                </span>
              ))}
            </div>
            <div className="hidden space-y-1 border-r border-white/5 bg-[#0d1119] p-2.5 text-[12px] text-slate-400 sm:block">
              <p className="mb-2 truncate text-[12px] font-bold text-white">Night Raid</p>
              {channels.map((channel, index) => (
                <p key={channel} className={`flex items-center gap-1 rounded px-1.5 py-1 ${index === 0 ? "bg-white/[0.06] text-white" : ""}`}>
                  <Hash className="h-3 w-3" /> {channel}
                </p>
              ))}
              <p className="mt-2 flex items-center gap-1 px-1.5 py-1 text-emerald-300"><Volume2 className="h-3 w-3" /> Squad VC</p>
              <div className="ml-4 space-y-1">
                {["Raven", "Kade"].map((name) => (
                  <p key={name} className="flex items-center gap-1 text-[11px] text-slate-300"><span className="h-3 w-3 rounded-full bg-gradient-to-br from-violet-400 to-sky-400 ring-2 ring-emerald-400/70" /> {name}</p>
                ))}
              </div>
            </div>
            <div className="flex min-w-0 flex-col p-3">
              <p className="mb-3 flex items-center gap-1 border-b border-white/5 pb-2 text-[12px] font-semibold text-white"><Hash className="h-3 w-3 text-slate-500" /> general</p>
              <div className="flex-1 space-y-3 overflow-hidden">
                {chatMessages.map((message) => (
                  <div key={message.name} className="flex gap-2">
                    <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-slate-600 to-slate-800" />
                    <div className="min-w-0">
                      <p className={`text-[12px] font-semibold ${message.color}`}>{message.name}</p>
                      <p className="text-[12px] leading-snug text-slate-300">{message.text}</p>
                    </div>
                  </div>
                ))}
                <div className="ml-0 inline-flex max-w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[11px] text-slate-300 sm:ml-8">
                  <BarChart3 className="h-3 w-3 shrink-0 text-amber-300" /> <span className="min-w-0">Poll · Map for tonight?</span> <span className="shrink-0 text-amber-200">62%</span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-white/[0.05] px-2 py-1.5 text-[11px] text-slate-500">
                Message #general <Smile className="ml-auto h-3 w-3" />
              </div>
            </div>
          </div>
        </DeviceFrame>
      </div>
    </div>
  );
}

const voiceMembers = [
  { name: "Raven", gradient: "from-violet-400 to-fuchsia-500", speaking: true },
  { name: "Kade", gradient: "from-sky-400 to-cyan-500", speaking: false },
  { name: "Nova", gradient: "from-amber-300 to-amber-600", speaking: false },
  { name: "Ash", gradient: "from-emerald-400 to-teal-500", speaking: false },
];

/** A voice channel with people, a screen share and the call controls. */
export function VoiceMockup({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("relative mx-auto w-full max-w-xl select-none", className)}>
      <div className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.22),transparent_62%)] blur-2xl" />
      <div className="relative">
        <DeviceFrame url="nfgcord.com/app/voice">
          <div className="flex h-[300px] flex-col gap-3 p-3 sm:h-[340px] sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-300"><Volume2 className="h-3.5 w-3.5" /> Squad VC</p>
              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">4 connected</span>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2 sm:gap-3">
              <div className="col-span-2 flex items-center gap-3 rounded-xl border border-sky-400/25 bg-sky-500/[0.08] px-3 py-2">
                <MonitorUp className="h-5 w-5 shrink-0 text-sky-200" />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-white">Kade is sharing a screen</p>
                  <p className="text-[11px] text-slate-400">HD screen share</p>
                </div>
              </div>
              {voiceMembers.map((member) => (
                <div
                  key={member.name}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 rounded-xl border bg-white/[0.03] p-2",
                    member.speaking ? "border-emerald-400/60 shadow-[0_0_20px_rgba(52,211,153,0.2)]" : "border-white/5",
                  )}
                >
                  <span className={cn("h-9 w-9 rounded-full bg-gradient-to-br ring-2 sm:h-10 sm:w-10", member.gradient, member.speaking ? "ring-emerald-400" : "ring-transparent")} />
                  <p className="text-[12px] font-semibold text-slate-100">{member.name}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-slate-100"><Mic className="h-4 w-4" /></span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-slate-100"><Video className="h-4 w-4" /></span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/30 text-sky-100"><MonitorUp className="h-4 w-4" /></span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-slate-100"><Headphones className="h-4 w-4" /></span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/80 text-white"><PhoneOff className="h-4 w-4" /></span>
            </div>
          </div>
        </DeviceFrame>
      </div>
    </div>
  );
}
