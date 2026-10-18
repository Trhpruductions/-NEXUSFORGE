"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AudioLines } from "lucide-react";
import { listForgeSounds } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth-store";
import { useVoiceStore } from "@/store/voice-store";

/** Voice room soundboard: pick one of the forge's sounds to play for everyone in the room. */
export function SoundboardButton({ forgeId, channelId, nameOf }: { forgeId: string; channelId: string; nameOf: (userId: string) => string }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const lastSound = useVoiceStore((state) => state.lastSound);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["forge-sounds", forgeId, accessToken], queryFn: () => listForgeSounds(accessToken!, forgeId), enabled: Boolean(accessToken && open), staleTime: 60_000 });

  // "X played Y" for a few seconds after each sound.
  useEffect(() => {
    if (!lastSound || Date.now() - lastSound.at > 4000) return;
    setNote(`${nameOf(lastSound.userId)} played ${lastSound.emoji ? `${lastSound.emoji} ` : ""}${lastSound.name}`);
    const timer = window.setTimeout(() => setNote(null), 3500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSound]);

  const play = (soundId: string) => {
    if (!accessToken) return;
    getSocket(accessToken).emit("soundboard:play", { channelId, soundId });
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Soundboard" title="Soundboard" className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-semibold uppercase tracking-[0.14em] ${open ? "border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-100" : "border-white/10 text-slate-200 hover:border-fuchsia-400/50"}`}>
        {/* In a narrow call window (the controls' container) only the icon shows; the name stays for screen readers. */}
        <AudioLines className="h-4 w-4" /> <span className="hidden @3xl/controls:inline">Soundboard</span>
      </button>
      {note ? <p role="status" className="absolute -top-7 left-1/2 w-max max-w-[16rem] -translate-x-1/2 truncate rounded-full bg-fuchsia-500/20 px-2.5 py-0.5 text-[11px] text-fuchsia-100">{note}</p> : null}
      {open ? (
        <div className="absolute bottom-[calc(100%+10px)] left-1/2 z-30 w-72 -translate-x-1/2 rounded-xl border border-white/10 bg-[#0d1119] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
          <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-300/80">Soundboard</p>
          {query.isLoading ? (
            <p className="px-1 py-3 text-xs text-slate-400">Loading…</p>
          ) : query.data?.sounds.length ? (
            <div className="grid max-h-64 grid-cols-2 gap-1 overflow-y-auto">
              {query.data.sounds.map((sound) => (
                <button key={sound.id} type="button" onClick={() => play(sound.id)} className="truncate rounded-lg border border-white/5 bg-white/[0.03] px-2 py-2 text-left text-xs text-slate-100 hover:border-fuchsia-400/40 hover:bg-fuchsia-500/10">
                  {sound.emoji ? `${sound.emoji} ` : "🔊 "}{sound.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="px-1 py-3 text-xs text-slate-400">No sounds yet. Server managers can add them in server settings, under Soundboard.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
