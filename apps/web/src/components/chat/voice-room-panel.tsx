"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConnectionState, Room, RoomEvent, Track } from "livekit-client";
import { Button } from "@/components/ui/button";
import type { VoiceTokenResponse } from "@/lib/api";

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

type VoiceRoomPanelProps = {
  session: VoiceRoomSession | null;
  voiceState: VoiceState;
  onToggleVoiceFlag: (flag: keyof VoiceState) => void;
  onLeave: () => void;
  statusMessage?: string;
};

export function VoiceRoomPanel({ session, voiceState, onToggleVoiceFlag, onLeave, statusMessage }: VoiceRoomPanelProps) {
  const roomRef = useRef<Room | null>(null);
  const remoteAudioHostRef = useRef<HTMLDivElement | null>(null);
  const mutedRef = useRef(voiceState.muted);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [participants, setParticipants] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const participantSummary = useMemo(() => {
    if (!participants.length) return "Solo session";
    return participants.join(" • ");
  }, [participants]);

  const connectionTone = useMemo(() => {
    if (connectionState === ConnectionState.Connected) return "border-amber-200 bg-amber-50 text-amber-700";
    if (connectionState === ConnectionState.Reconnecting) return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-slate-900/10 bg-slate-50 text-slate-600";
  }, [connectionState]);

  useEffect(() => {
    mutedRef.current = voiceState.muted;
  }, [voiceState.muted]);

  useEffect(() => {
    const audioHost = remoteAudioHostRef.current;

    if (!session) {
      const room = roomRef.current;
      if (room) {
        void room.disconnect();
      }
      roomRef.current = null;
      if (audioHost) {
        audioHost.replaceChildren();
      }
      return;
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    roomRef.current = room;

    const syncParticipants = () => {
      setParticipants(Array.from(room.remoteParticipants.values()).map((participant) => participant.name || participant.identity));
    };

    const syncAudioTracks = () => {
      if (!audioHost) return;
      audioHost.replaceChildren();

      room.remoteParticipants.forEach((participant) => {
        participant.getTrackPublications().forEach((publication) => {
          if (publication.kind !== Track.Kind.Audio) return;

          const track = publication.track;
          if (!track || track.kind !== Track.Kind.Audio) return;
          const element = track.attach();
          element.autoplay = true;
          audioHost.appendChild(element);
        });
      });
    };

    const handleDisconnected = () => {
      setConnectionState(ConnectionState.Disconnected);
      setParticipants([]);
      if (audioHost) {
        audioHost.replaceChildren();
      }
    };

    room.on(RoomEvent.Connected, () => {
      setConnectionState(ConnectionState.Connected);
      syncParticipants();
      syncAudioTracks();
    });
    room.on(RoomEvent.Reconnecting, () => setConnectionState(ConnectionState.Reconnecting));
    room.on(RoomEvent.Reconnected, () => setConnectionState(ConnectionState.Connected));
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.ParticipantConnected, syncParticipants);
    room.on(RoomEvent.ParticipantDisconnected, syncParticipants);
    room.on(RoomEvent.TrackSubscribed, syncAudioTracks);
    room.on(RoomEvent.TrackUnsubscribed, syncAudioTracks);

    const connect = async () => {
      try {
        setError(null);
        await room.connect(session.wsUrl, session.token, {
          autoSubscribe: true,
        });
        await room.localParticipant.setMicrophoneEnabled(!mutedRef.current);
        syncParticipants();
        syncAudioTracks();
      } catch (connectError) {
        setError(connectError instanceof Error ? connectError.message : "Unable to connect to voice.");
        setConnectionState(ConnectionState.Disconnected);
      }
    };

    void connect();

    return () => {
      room.removeAllListeners();
      void room.disconnect();
      roomRef.current = null;
      if (audioHost) {
        audioHost.replaceChildren();
      }
    };
  }, [session]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;

    void room.localParticipant.setMicrophoneEnabled(!voiceState.muted);
  }, [voiceState.muted]);

  if (!session) {
    return (
      <div className="nexus-panel rounded-[16px] border border-slate-900/10 bg-white/85 p-3 text-xs text-slate-600">
        Select a voice or stage channel to start a LiveKit session.
      </div>
    );
  }

  return (
    <div className="nexus-panel rounded-[16px] border border-slate-900/10 bg-white/85 p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span className="truncate">{session.roomName}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${connectionTone}`}>
          {connectionState}
        </span>
      </div>

      <p className="text-sm text-slate-900">{participantSummary}</p>
      {participants.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {participants.map((participant) => (
            <span key={participant} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
              {participant}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <button className={`nexus-interactive-btn rounded-[10px] border px-2 py-1 text-slate-700 ${voiceState.muted ? "border-rose-200 bg-rose-50" : "border-slate-900/10 bg-slate-50"}`} onClick={() => onToggleVoiceFlag("muted")}>
          Mute: {voiceState.muted ? "On" : "Off"}
        </button>
        <button className={`nexus-interactive-btn rounded-[10px] border px-2 py-1 text-slate-700 ${voiceState.deafened ? "border-amber-200 bg-amber-50" : "border-slate-900/10 bg-slate-50"}`} onClick={() => onToggleVoiceFlag("deafened")}>
          Deafen: {voiceState.deafened ? "On" : "Off"}
        </button>
        <button className={`nexus-interactive-btn rounded-[10px] border px-2 py-1 text-slate-700 ${voiceState.screenSharing ? "border-violet-200 bg-violet-50" : "border-slate-900/10 bg-slate-50"}`} onClick={() => onToggleVoiceFlag("screenSharing")}>
          Screen: {voiceState.screenSharing ? "On" : "Off"}
        </button>
        <button className={`nexus-interactive-btn rounded-[10px] border px-2 py-1 text-slate-700 ${voiceState.noiseSuppression ? "border-amber-200 bg-amber-50" : "border-slate-900/10 bg-slate-50"}`} onClick={() => onToggleVoiceFlag("noiseSuppression")}>
          Noise: {voiceState.noiseSuppression ? "On" : "Off"}
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={onLeave} className="h-8 px-3 text-xs">
          Leave Voice
        </Button>
        <span className="text-[11px] text-slate-500">{statusMessage ?? error ?? "Mic stream active"}</span>
      </div>

      <div ref={remoteAudioHostRef} className="sr-only" aria-hidden="true" />
    </div>
  );
}
