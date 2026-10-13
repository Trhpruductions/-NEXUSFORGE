"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMyLimits, getSettings } from "@/lib/api";
// LiveKit is only needed when the server hands out a LiveKit session, so the library is
// loaded on demand (it used to ship in the app shell bundle for every page).
import type { Room } from "livekit-client";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth-store";
import { useVoiceStore } from "@/store/voice-store";
import { MeshVoice, type MeshPeer } from "@/components/chat/mesh-voice";

/**
 * Headless voice engine. Mounted once in the app shell so a call survives page
 * navigation; the visible room UI (VoiceRoomPanel) only reads the voice store.
 */
export function VoiceEngine() {
  const { user, accessToken } = useAuthStore();
  const session = useVoiceStore((state) => state.session);
  const flags = useVoiceStore((state) => state.flags);
  const meshRef = useRef<MeshVoice | null>(null);
  const roomRef = useRef<Room | null>(null);
  const audioHostRef = useRef<HTMLDivElement | null>(null);
  const flagsRef = useRef(flags);
  // Saved voice settings (Settings > Voice & Video). Shares the cached settings query.
  const settingsQuery = useQuery({ queryKey: ["settings", accessToken], queryFn: () => getSettings(accessToken!), enabled: Boolean(accessToken) });
  // Plan limits: ultra video (1440p60) is a Core+ Plus perk; everyone gets HD.
  const limitsQuery = useQuery({ queryKey: ["my-limits", accessToken], queryFn: () => getMyLimits(accessToken!), enabled: Boolean(accessToken), staleTime: 5 * 60_000 });
  const hdVideo = Boolean(limitsQuery.data?.ultraVideo);
  const hdVideoRef = useRef(hdVideo);
  useEffect(() => {
    hdVideoRef.current = hdVideo;
    meshRef.current?.setHdVideo(hdVideo);
  }, [hdVideo]);
  const voicePrefs = settingsQuery.data?.preferences.voice;
  const voicePrefsRef = useRef(voicePrefs);

  useEffect(() => {
    flagsRef.current = flags;
  }, [flags]);
  useEffect(() => {
    voicePrefsRef.current = voicePrefs;
  }, [voicePrefs]);

  // The server pulls people out of voice when they're timed out or lose access to a
  // private channel; hang up so the call (and everyone's occupancy count) ends cleanly.
  const sessionChannelId = session?.channelId ?? null;
  useEffect(() => {
    if (!sessionChannelId || !accessToken) return;
    const socket = getSocket(accessToken);
    const handleForceLeave = (payload: { channelIds?: string[]; reason?: string }) => {
      if (!payload.channelIds?.includes(sessionChannelId)) return;
      const store = useVoiceStore.getState();
      store.setError(payload.reason === "timeout" ? "You were timed out, so you've been disconnected from voice." : "You no longer have access to this voice channel.");
      store.leave();
    };
    socket.on("voice:force-leave", handleForceLeave);
    return () => {
      socket.off("voice:force-leave", handleForceLeave);
    };
  }, [sessionChannelId, accessToken]);

  // Soundboard: someone in the room played a sound. Played here (not through the call),
  // at the sound's volume times your output volume, on your chosen speaker, unless deafened.
  useEffect(() => {
    if (!sessionChannelId || !accessToken) return;
    const socket = getSocket(accessToken);
    const onPlayed = (payload: { channelId: string; userId: string; name: string; emoji: string | null; soundUrl: string; volume: number }) => {
      if (payload.channelId !== sessionChannelId) return;
      useVoiceStore.getState().setLastSound({ userId: payload.userId, name: payload.name, emoji: payload.emoji, at: Date.now() });
      if (useVoiceStore.getState().flags.deafened) return;
      const audio = new Audio(payload.soundUrl);
      audio.volume = Math.max(0, Math.min(1, payload.volume * ((voicePrefsRef.current?.outputVolume ?? 100) / 100)));
      const sinkId = voicePrefsRef.current?.outputDeviceId;
      const withSink = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
      const start = () => void audio.play().catch(() => undefined);
      if (sinkId && withSink.setSinkId) void withSink.setSinkId(sinkId).catch(() => undefined).finally(start);
      else start();
    };
    const onError = (payload: { error: string }) => useVoiceStore.getState().setError(payload.error);
    socket.on("soundboard:played", onPlayed);
    socket.on("soundboard:error", onError);
    return () => {
      socket.off("soundboard:played", onPlayed);
      socket.off("soundboard:error", onError);
    };
  }, [sessionChannelId, accessToken]);

  // Stage channels: who's speaking, who has a hand up, who runs the stage.
  const stageSession = Boolean(session?.stage);
  useEffect(() => {
    if (!sessionChannelId || !accessToken || !stageSession) return;
    const socket = getSocket(accessToken);
    const onStage = (payload: { channelId: string; speakers: string[]; raised: string[]; moderators: string[] }) => {
      if (payload.channelId !== sessionChannelId) return;
      useVoiceStore.getState().setStage({ speakers: payload.speakers, raised: payload.raised, moderators: payload.moderators });
    };
    socket.on("stage:state", onStage);
    return () => {
      socket.off("stage:state", onStage);
    };
  }, [sessionChannelId, accessToken, stageSession]);
  const stage = useVoiceStore((state) => state.stage);
  useEffect(() => {
    // Until the first stage update arrives, nobody is heard (and your mic stays off).
    meshRef.current?.setStage(stageSession ? stage?.speakers ?? [] : null);
    // Moved to the audience: switch off your camera and screen share.
    if (stageSession && stage && user && !stage.speakers.includes(user.id)) {
      const { flags, toggle } = useVoiceStore.getState();
      if (flags.camera) toggle("camera");
      if (flags.screenSharing) toggle("screenSharing");
    }
  }, [stage, stageSession, user]);

  // ------------------------------------------------------------- built-in mesh
  useEffect(() => {
    if (!session || session.mode !== "mesh" || !accessToken || !user) return;
    const store = useVoiceStore.getState();
    store.setConnection("connecting");
    store.setError(null);
    const mesh = new MeshVoice({
      socket: getSocket(accessToken),
      channelId: session.channelId,
      selfId: user.id,
      iceServers: session.iceServers ?? [],
      constraints: {
        noiseSuppression: voicePrefsRef.current?.noiseSuppression ?? flagsRef.current.noiseSuppression,
        echoCancellation: voicePrefsRef.current?.echoCancellation ?? true,
        autoGainControl: true,
        ...(voicePrefsRef.current?.inputDeviceId ? { deviceId: { exact: voicePrefsRef.current.inputDeviceId } } : {}),
      },
      inputGain: (voicePrefsRef.current?.inputVolume ?? 100) / 100,
      outputVolume: (voicePrefsRef.current?.outputVolume ?? 100) / 100,
      outputDeviceId: voicePrefsRef.current?.outputDeviceId ?? null,
      onFull: (limit) => {
        useVoiceStore.getState().setError(`This voice channel is full (${limit} people max for peer-to-peer voice).`);
        useVoiceStore.getState().leave();
      },
      onPeersChanged: (peers: MeshPeer[]) =>
        useVoiceStore.getState().setRemote(peers.map((peer) => ({ userId: peer.userId, connected: peer.state === "connected", video: peer.video, camera: peer.camera, muted: peer.remoteMuted, deafened: peer.remoteDeafened }))),
      onLocalCamera: (stream) => useVoiceStore.getState().setLocalCamera(stream),
      onCameraEnded: () => {
        if (useVoiceStore.getState().flags.camera) useVoiceStore.getState().toggle("camera");
      },
      onScreenShareEnded: () => {
        if (useVoiceStore.getState().flags.screenSharing) useVoiceStore.getState().toggle("screenSharing");
      },
      onLocalScreen: (stream) => useVoiceStore.getState().setLocalScreen(stream),
      onLevel: (key, level) => useVoiceStore.getState().setLevel(key, level),
      onError: (message) => useVoiceStore.getState().setError(message),
    });
    meshRef.current = mesh;
    mesh.setHdVideo(hdVideoRef.current);
    if (session.stage) mesh.setStage(useVoiceStore.getState().stage?.speakers ?? []);
    void mesh.start().then(() => {
      if (meshRef.current === mesh) useVoiceStore.getState().setConnection("connected");
    });
    mesh.setMuted(flagsRef.current.muted);
    mesh.setDeafened(flagsRef.current.deafened);
    return () => {
      mesh.stop();
      if (meshRef.current === mesh) meshRef.current = null;
    };
  }, [session, accessToken, user]);

  useEffect(() => {
    meshRef.current?.setMuted(flags.muted);
  }, [flags.muted]);
  // Output volume and speaker apply live; mic device and processing apply on the next join.
  useEffect(() => {
    if (!voicePrefs) return;
    meshRef.current?.setOutputVolume(voicePrefs.outputVolume / 100);
    meshRef.current?.setOutputDevice(voicePrefs.outputDeviceId);
  }, [voicePrefs, session]);

  // Push-to-talk: hold ` (backquote) to talk. Ignored while typing in a text field.
  const pushToTalk = voicePrefs?.inputMode === "ptt" && session?.mode === "mesh";
  useEffect(() => {
    const store = useVoiceStore.getState();
    meshRef.current?.setPushToTalk(pushToTalk);
    store.setPushToTalk({ enabled: pushToTalk, talking: false });
    if (!pushToTalk) return;
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable));
    };
    const set = (talking: boolean) => {
      meshRef.current?.setTalking(talking);
      useVoiceStore.getState().setPushToTalk({ enabled: true, talking });
    };
    const down = (event: KeyboardEvent) => {
      if (event.code === "Backquote" && !event.repeat && !isTyping()) {
        event.preventDefault();
        set(true);
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Backquote") set(false);
    };
    const blur = () => set(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      meshRef.current?.setPushToTalk(false);
    };
  }, [pushToTalk, session]);
  useEffect(() => {
    meshRef.current?.setDeafened(flags.deafened);
  }, [flags.deafened]);
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (flags.screenSharing) void mesh.startScreenShare();
    else mesh.stopScreenShare(false);
  }, [flags.screenSharing]);

  // Camera on/off (built-in voice).
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (flags.camera) void mesh.startCamera(voicePrefsRef.current?.cameraDeviceId ?? null);
    else mesh.stopCamera(false);
  }, [flags.camera]);

  // ------------------------------------------------------------- LiveKit
  useEffect(() => {
    if (!session || session.mode !== "livekit" || !accessToken) return;
    const audioHost = audioHostRef.current;
    const socket = getSocket(accessToken);
    const store = useVoiceStore.getState();
    let cancelled = false;
    let room: Room | null = null;
    store.setConnection("connecting");
    store.setError(null);

    void import("livekit-client").then(({ Room: LiveKitRoom, RoomEvent, Track }) => {
    if (cancelled) return;
    room = new LiveKitRoom({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    const liveRoom = room;

    const syncParticipants = () =>
      useVoiceStore.getState().setRemote(Array.from(liveRoom.remoteParticipants.values()).map((participant) => ({ userId: participant.identity, name: participant.name, connected: true })));
    const syncAudioTracks = () => {
      if (!audioHost) return;
      audioHost.replaceChildren();
      liveRoom.remoteParticipants.forEach((participant) => {
        participant.getTrackPublications().forEach((publication) => {
          if (publication.kind !== Track.Kind.Audio || !publication.track) return;
          const element = publication.track.attach();
          element.autoplay = true;
          audioHost.appendChild(element);
        });
      });
    };

    liveRoom.on(RoomEvent.Connected, () => {
      useVoiceStore.getState().setConnection("connected");
      syncParticipants();
      syncAudioTracks();
    });
    liveRoom.on(RoomEvent.Reconnecting, () => useVoiceStore.getState().setConnection("reconnecting"));
    liveRoom.on(RoomEvent.Reconnected, () => useVoiceStore.getState().setConnection("connected"));
    liveRoom.on(RoomEvent.Disconnected, () => {
      useVoiceStore.getState().setConnection("disconnected");
      useVoiceStore.getState().setRemote([]);
      audioHost?.replaceChildren();
    });
    liveRoom.on(RoomEvent.ParticipantConnected, syncParticipants);
    liveRoom.on(RoomEvent.ParticipantDisconnected, syncParticipants);
    liveRoom.on(RoomEvent.TrackSubscribed, syncAudioTracks);
    liveRoom.on(RoomEvent.TrackUnsubscribed, syncAudioTracks);
    liveRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const next: Record<string, number> = {};
      for (const speaker of speakers) next[speaker.identity === liveRoom.localParticipant.identity ? "self" : speaker.identity] = Math.round(speaker.audioLevel * 100);
      useVoiceStore.getState().setLevels(next);
    });

    socket.emit("voice:join", session.channelId);
    liveRoom
      .connect(session.wsUrl, session.token, { autoSubscribe: true })
      .then(() => liveRoom.localParticipant.setMicrophoneEnabled(!flagsRef.current.muted))
      .catch((connectError: unknown) => {
        useVoiceStore.getState().setError(connectError instanceof Error ? connectError.message : "Unable to connect to voice.");
        useVoiceStore.getState().setConnection("disconnected");
      });
    }).catch(() => {
      useVoiceStore.getState().setError("Couldn't load voice. Check your connection and try again.");
      useVoiceStore.getState().setConnection("disconnected");
    });

    return () => {
      cancelled = true;
      if (room) {
        room.removeAllListeners();
        void room.disconnect();
        if (roomRef.current === room) roomRef.current = null;
        socket.emit("voice:leave", session.channelId);
      }
      audioHost?.replaceChildren();
    };
  }, [session, accessToken]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== "connected") return;
    void room.localParticipant.setMicrophoneEnabled(!flags.muted);
  }, [flags.muted]);

  // Leaving the app (sign out) ends the call.
  useEffect(() => {
    if (!accessToken && session) useVoiceStore.getState().leave();
  }, [accessToken, session]);

  return <div ref={audioHostRef} className="sr-only" aria-hidden="true" />;
}
