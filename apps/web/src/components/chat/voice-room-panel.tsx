"use client";

import { useEffect, useMemo, useRef } from "react";
import { Headphones, HeadphoneOff, Loader2, Mic, MicOff, MonitorUp, MonitorX, PhoneOff, Radio, Video, VideoOff, Wifi } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useVoiceStore } from "@/store/voice-store";

type MemberLike = { userId: string; user: { id: string; username: string; displayName?: string | null; avatar?: string | null } };

type Participant = { userId: string; name: string; avatar?: string | null; connected: boolean; self: boolean; muted: boolean; deafened: boolean; camera: MediaStream | null };

/** A camera feed filling a participant tile. Your own preview is mirrored, like a mirror. */
function CameraVideo({ stream, mirror }: { stream: MediaStream; mirror: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" style={mirror ? { transform: "scaleX(-1)" } : undefined} />;
}

function ScreenTile({ stream, label, muted = false }: { stream: MediaStream; label: string; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="overflow-hidden rounded-xl border border-amber-500/30 bg-black">
      <video ref={ref} autoPlay playsInline muted={muted} className="aspect-video w-full object-contain" />
      <p className="border-t border-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">{label}</p>
    </div>
  );
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "VX";
}

/** Visible voice room. All state comes from the voice store; the engine runs in the app shell. */
export function VoiceRoomPanel({ members = [] }: { members?: MemberLike[] }) {
  const user = useAuthStore((state) => state.user);
  const { session, flags, connection, remote, levels, localScreen, localCamera, error, toggle, leave, pushToTalk } = useVoiceStore();

  const nameOf = (userId: string) => {
    const member = members.find((entry) => entry.userId === userId || entry.user.id === userId);
    return member?.user.displayName || member?.user.username || "Member";
  };
  const avatarOf = (userId: string) => members.find((entry) => entry.userId === userId || entry.user.id === userId)?.user.avatar ?? null;

  const participants = useMemo<Participant[]>(() => {
    const self: Participant = {
      userId: user?.id ?? "self",
      name: user?.displayName || user?.username || "You",
      avatar: user?.avatar ?? null,
      connected: connection === "connected",
      self: true,
      // Deafen cuts the mic too; with push-to-talk the mic is off until the key is held.
      muted: flags.muted || flags.deafened || (pushToTalk.enabled && !pushToTalk.talking),
      deafened: flags.deafened,
      camera: localCamera,
    };
    return [self, ...remote.map((entry) => ({ userId: entry.userId, name: entry.name || nameOf(entry.userId), avatar: avatarOf(entry.userId), connected: entry.connected, self: false, muted: Boolean(entry.muted), deafened: Boolean(entry.deafened), camera: entry.camera ?? null }))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, connection, user, members, flags.muted, flags.deafened, pushToTalk, localCamera]);
  const anyCamera = participants.some((participant) => participant.camera);

  if (!session) return null;

  const tone =
    connection === "connected"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
      : connection === "disconnected"
        ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
        : "border-amber-400/40 bg-amber-500/10 text-amber-200";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300"><Radio className="h-4 w-4" /></span>
          <div>
            <p className="nf-heading text-sm font-bold text-white">{session.channelName}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{session.mode === "mesh" ? "Vexora voice · peer to peer" : "Vexora voice · LiveKit"}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${tone}`}>
          {connection === "connecting" || connection === "reconnecting" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />} {connection}
        </span>
      </div>

      {error ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{error}</p> : null}

      {localScreen || remote.some((entry) => entry.video) ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {localScreen ? <ScreenTile stream={localScreen} label="Your screen" muted /> : null}
          {remote.filter((entry) => entry.video).map((entry) => <ScreenTile key={entry.userId} stream={entry.video!} label={`${entry.name || nameOf(entry.userId)}'s screen`} />)}
        </div>
      ) : null}

      <div className={`grid gap-3 ${anyCamera ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
        {participants.map((participant) => {
          const level = levels[participant.self ? "self" : participant.userId] ?? 0;
          const speaking = level > 8;
          if (participant.camera) {
            return (
              <div key={participant.userId} className={`relative aspect-video overflow-hidden rounded-xl border-2 bg-black transition ${speaking ? "border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)]" : "border-white/10"}`}>
                <CameraVideo stream={participant.camera} mirror={participant.self} />
                <span className="absolute bottom-2 left-2 inline-flex max-w-[80%] items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
                  {participant.deafened ? <HeadphoneOff className="h-3 w-3 text-rose-300" /> : participant.muted ? <MicOff className="h-3 w-3 text-rose-300" /> : <Mic className="h-3 w-3 text-emerald-300" />}
                  <span className="truncate">{participant.name}{participant.self ? " (you)" : ""}</span>
                </span>
              </div>
            );
          }
          return (
            <div key={participant.userId} className={`flex flex-col items-center gap-2 rounded-xl border bg-[#11151e] px-3 py-4 transition ${speaking ? "border-emerald-400/60 shadow-[0_0_20px_rgba(52,211,153,0.25)]" : "border-white/5"}`}>
              <span className="relative">
                {participant.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={participant.avatar} alt="" className={`h-14 w-14 rounded-full border-2 object-cover ${speaking ? "border-emerald-400" : "border-amber-500/40"}`} />
                ) : (
                  <span className={`flex h-14 w-14 items-center justify-center rounded-full border-2 bg-slate-800 text-sm font-bold text-amber-100 ${speaking ? "border-emerald-400" : "border-amber-500/40"}`}>{initials(participant.name)}</span>
                )}
                {participant.deafened ? (
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-rose-500 p-1 text-white" title="Deafened"><HeadphoneOff className="h-3 w-3" /></span>
                ) : participant.muted && participant.connected ? (
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-rose-500 p-1 text-white" title="Muted"><MicOff className="h-3 w-3" /></span>
                ) : null}
                {!participant.connected ? <span className="absolute -bottom-1 -right-1 rounded-full bg-amber-500 p-1 text-slate-950"><Loader2 className="h-3 w-3 animate-spin" /></span> : null}
              </span>
              <p className="max-w-full truncate text-sm font-semibold text-white">{participant.name}{participant.self ? " (you)" : ""}</p>
              <span className="h-1 w-16 overflow-hidden rounded-full bg-slate-800"><span className="block h-full rounded-full bg-emerald-400 transition-[width]" style={{ width: `${Math.min(100, level)}%` }} /></span>
            </div>
          );
        })}
      </div>
      {pushToTalk.enabled ? (
        <p className="text-center text-xs text-slate-400">
          Push-to-talk is on: hold <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-slate-200">`</kbd> to talk.
          {pushToTalk.talking ? <span className="ml-1.5 font-semibold text-emerald-300">Talking</span> : null}
        </p>
      ) : null}
      {participants.length === 1 ? <p className="text-center text-xs text-slate-500">You are the only one here. Others in the forge see the count next to the channel and can hop in.</p> : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={() => toggle("muted")} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${flags.muted ? "border-rose-400/50 bg-rose-500/10 text-rose-200" : "border-white/10 text-slate-200 hover:border-amber-400/50"}`}>
          {flags.muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />} {flags.muted ? "Unmute" : "Mute"}
        </button>
        <button type="button" onClick={() => toggle("deafened")} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${flags.deafened ? "border-rose-400/50 bg-rose-500/10 text-rose-200" : "border-white/10 text-slate-200 hover:border-amber-400/50"}`}>
          {flags.deafened ? <HeadphoneOff className="h-3.5 w-3.5" /> : <Headphones className="h-3.5 w-3.5" />} {flags.deafened ? "Undeafen" : "Deafen"}
        </button>
        {session.mode === "mesh" ? (
          <button type="button" onClick={() => toggle("camera")} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${flags.camera ? "border-sky-400/60 bg-sky-500/10 text-sky-200" : "border-white/10 text-slate-200 hover:border-sky-400/50"}`}>
            {flags.camera ? <VideoOff className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />} {flags.camera ? "Stop video" : "Video"}
          </button>
        ) : null}
        {session.mode === "mesh" ? (
          <button type="button" onClick={() => toggle("screenSharing")} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${flags.screenSharing ? "border-amber-400/60 bg-amber-500/10 text-amber-200" : "border-white/10 text-slate-200 hover:border-amber-400/50"}`}>
            {flags.screenSharing ? <MonitorX className="h-3.5 w-3.5" /> : <MonitorUp className="h-3.5 w-3.5" />} {flags.screenSharing ? "Stop sharing" : "Share screen"}
          </button>
        ) : null}
        <button type="button" onClick={leave} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white hover:bg-rose-400">
          <PhoneOff className="h-3.5 w-3.5" /> Leave
        </button>
      </div>
    </div>
  );
}
