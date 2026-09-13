"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConnectionState, Room, RoomEvent, Track } from "livekit-client";
import { Headphones, HeadphoneOff, Loader2, Mic, MicOff, PhoneOff, Radio, Wifi } from "lucide-react";
import type { VoiceTokenResponse } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth-store";
import { MeshVoice, type MeshPeer } from "@/components/chat/mesh-voice";

type VoiceState = {
  muted: boolean;
  deafened: boolean;
  screenSharing: boolean;
  noiseSuppression: boolean;
  voiceActivity: boolean;
};

type VoiceRoomSession = VoiceTokenResponse & {
  channelId: string;
};

type MemberLike = { userId: string; user: { id: string; username: string; displayName?: string | null; avatar?: string | null } };

type VoiceRoomPanelProps = {
  session: VoiceRoomSession | null;
  channelName?: string;
  voiceState: VoiceState;
  members?: MemberLike[];
  onToggleVoiceFlag: (flag: keyof VoiceState) => void;
  onLeave: () => void;
  statusMessage?: string;
};

type Participant = { userId: string; name: string; avatar?: string | null; connected: boolean; self: boolean };

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "VX";
}

export function VoiceRoomPanel({ session, channelName, voiceState, members = [], onToggleVoiceFlag, onLeave, statusMessage }: VoiceRoomPanelProps) {
  const { user, accessToken } = useAuthStore();
  const roomRef = useRef<Room | null>(null);
  const meshRef = useRef<MeshVoice | null>(null);
  const remoteAudioHostRef = useRef<HTMLDivElement | null>(null);
  const [connection, setConnection] = useState<"connecting" | "connected" | "reconnecting" | "disconnected">("connecting");
  const [remote, setRemote] = useState<Array<{ userId: string; name?: string; connected: boolean }>>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const nameOf = (userId: string) => {
    const member = members.find((entry) => entry.userId === userId || entry.user.id === userId);
    return member?.user.displayName || member?.user.username || "Member";
  };
  const avatarOf = (userId: string) => members.find((entry) => entry.userId === userId || entry.user.id === userId)?.user.avatar ?? null;

  // ------------------------------------------------------------- built-in WebRTC mesh
  useEffect(() => {
    if (!session || session.mode !== "mesh" || !accessToken || !user) return;
    setConnection("connecting");
    setError(null);
    const mesh = new MeshVoice({
      socket: getSocket(accessToken),
      channelId: session.channelId,
      selfId: user.id,
      iceServers: session.iceServers ?? [],
      constraints: { noiseSuppression: voiceState.noiseSuppression, echoCancellation: true, autoGainControl: true },
      onPeersChanged: (peers: MeshPeer[]) => {
        setRemote(peers.map((peer) => ({ userId: peer.userId, connected: peer.state === "connected" })));
      },
      onLevel: (userId, level) => setLevels((current) => (current[userId] === level ? current : { ...current, [userId]: level })),
      onError: (message) => setError(message),
    });
    meshRef.current = mesh;
    void mesh.start().then(() => setConnection("connected"));
    return () => {
      mesh.stop();
      meshRef.current = null;
      setRemote([]);
      setLevels({});
      setConnection("disconnected");
    };
    // Constraints only apply at start; toggling noise suppression rejoins via the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.channelId, session?.mode, accessToken, user?.id]);

  useEffect(() => {
    meshRef.current?.setMuted(voiceState.muted);
  }, [voiceState.muted]);
  useEffect(() => {
    meshRef.current?.setDeafened(voiceState.deafened);
  }, [voiceState.deafened]);

  // ------------------------------------------------------------- LiveKit (when configured)
  useEffect(() => {
    if (!session || session.mode !== "livekit" || !accessToken) return;
    const audioHost = remoteAudioHostRef.current;
    const socket = getSocket(accessToken);
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const syncParticipants = () => {
      setRemote(Array.from(room.remoteParticipants.values()).map((participant) => ({ userId: participant.identity, name: participant.name, connected: true })));
    };
    const syncAudioTracks = () => {
      if (!audioHost) return;
      audioHost.replaceChildren();
      room.remoteParticipants.forEach((participant) => {
        participant.getTrackPublications().forEach((publication) => {
          if (publication.kind !== Track.Kind.Audio || !publication.track) return;
          const element = publication.track.attach();
          element.autoplay = true;
          audioHost.appendChild(element);
        });
      });
    };

    room.on(RoomEvent.Connected, () => {
      setConnection("connected");
      syncParticipants();
      syncAudioTracks();
    });
    room.on(RoomEvent.Reconnecting, () => setConnection("reconnecting"));
    room.on(RoomEvent.Reconnected, () => setConnection("connected"));
    room.on(RoomEvent.Disconnected, () => {
      setConnection("disconnected");
      setRemote([]);
      audioHost?.replaceChildren();
    });
    room.on(RoomEvent.ParticipantConnected, syncParticipants);
    room.on(RoomEvent.ParticipantDisconnected, syncParticipants);
    room.on(RoomEvent.TrackSubscribed, syncAudioTracks);
    room.on(RoomEvent.TrackUnsubscribed, syncAudioTracks);
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const next: Record<string, number> = {};
      for (const speaker of speakers) next[speaker.identity === room.localParticipant.identity ? "self" : speaker.identity] = Math.round(speaker.audioLevel * 100);
      setLevels(next);
    });

    setConnection("connecting");
    setError(null);
    socket.emit("voice:join", session.channelId);
    room
      .connect(session.wsUrl, session.token, { autoSubscribe: true })
      .then(() => room.localParticipant.setMicrophoneEnabled(!voiceState.muted))
      .catch((connectError: unknown) => {
        setError(connectError instanceof Error ? connectError.message : "Unable to connect to voice.");
        setConnection("disconnected");
      });

    return () => {
      room.removeAllListeners();
      void room.disconnect();
      roomRef.current = null;
      socket.emit("voice:leave", session.channelId);
      audioHost?.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.channelId, session?.mode, accessToken]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    void room.localParticipant.setMicrophoneEnabled(!voiceState.muted);
  }, [voiceState.muted]);

  const participants = useMemo<Participant[]>(() => {
    const self: Participant = { userId: user?.id ?? "self", name: user?.displayName || user?.username || "You", avatar: user?.avatar ?? null, connected: connection === "connected", self: true };
    return [self, ...remote.map((entry) => ({ userId: entry.userId, name: entry.name || nameOf(entry.userId), avatar: avatarOf(entry.userId), connected: entry.connected, self: false }))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, connection, user, members]);

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
            <p className="nf-heading text-sm font-bold text-white">{channelName ?? session.roomName}</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{session.mode === "mesh" ? "Vexora voice · peer to peer" : "Vexora voice · LiveKit"}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${tone}`}>
          {connection === "connecting" || connection === "reconnecting" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />} {connection}
        </span>
      </div>

      {error ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {participants.map((participant) => {
          const level = levels[participant.self ? "self" : participant.userId] ?? 0;
          const speaking = level > 8;
          return (
            <div key={participant.userId} className={`flex flex-col items-center gap-2 rounded-xl border bg-[#11151e] px-3 py-4 transition ${speaking ? "border-emerald-400/60 shadow-[0_0_20px_rgba(52,211,153,0.25)]" : "border-white/5"}`}>
              <span className="relative">
                {participant.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={participant.avatar} alt="" className={`h-14 w-14 rounded-full border-2 object-cover ${speaking ? "border-emerald-400" : "border-amber-500/40"}`} />
                ) : (
                  <span className={`flex h-14 w-14 items-center justify-center rounded-full border-2 bg-slate-800 text-sm font-bold text-amber-100 ${speaking ? "border-emerald-400" : "border-amber-500/40"}`}>{initials(participant.name)}</span>
                )}
                {participant.self && voiceState.muted ? <span className="absolute -bottom-1 -right-1 rounded-full bg-rose-500 p-1 text-white"><MicOff className="h-3 w-3" /></span> : null}
                {!participant.connected ? <span className="absolute -bottom-1 -right-1 rounded-full bg-amber-500 p-1 text-slate-950"><Loader2 className="h-3 w-3 animate-spin" /></span> : null}
              </span>
              <p className="max-w-full truncate text-sm font-semibold text-white">{participant.name}{participant.self ? " (you)" : ""}</p>
              <span className="h-1 w-16 overflow-hidden rounded-full bg-slate-800"><span className="block h-full rounded-full bg-emerald-400 transition-[width]" style={{ width: `${Math.min(100, level)}%` }} /></span>
            </div>
          );
        })}
      </div>
      {participants.length === 1 ? <p className="text-center text-xs text-slate-500">You are the only one here. Others in the forge see the count next to the channel and can hop in.</p> : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={() => onToggleVoiceFlag("muted")} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${voiceState.muted ? "border-rose-400/50 bg-rose-500/10 text-rose-200" : "border-white/10 text-slate-200 hover:border-amber-400/50"}`}>
          {voiceState.muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />} {voiceState.muted ? "Unmute" : "Mute"}
        </button>
        <button type="button" onClick={() => onToggleVoiceFlag("deafened")} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${voiceState.deafened ? "border-rose-400/50 bg-rose-500/10 text-rose-200" : "border-white/10 text-slate-200 hover:border-amber-400/50"}`}>
          {voiceState.deafened ? <HeadphoneOff className="h-3.5 w-3.5" /> : <Headphones className="h-3.5 w-3.5" />} {voiceState.deafened ? "Undeafen" : "Deafen"}
        </button>
        <button type="button" onClick={onLeave} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white hover:bg-rose-400">
          <PhoneOff className="h-3.5 w-3.5" /> Leave
        </button>
      </div>
      {statusMessage ? <p className="text-center text-[11px] text-slate-500">{statusMessage}</p> : null}

      <div ref={remoteAudioHostRef} className="sr-only" aria-hidden="true" />
    </div>
  );
}
