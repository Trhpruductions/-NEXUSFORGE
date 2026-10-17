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
import { watchMediaDevices } from "@/lib/media/media-devices";
import { micSettingsFrom } from "@/lib/media/media-prefs";
import { useMediaPrefsSync, useMediaStore } from "@/lib/media/media-store";

/**
 * Headless voice engine. Mounted once in the app shell so a call survives page
 * navigation; the visible room UI (VoiceRoomPanel) only reads the voice store.
 */
export function VoiceEngine() {
  const { user, accessToken } = useAuthStore();
  // The call is built once per voice session. A token refresh (every 15 minutes) or a profile reload hands the store a
  // new token or user object, and the call must survive both: the realtime socket is shared and takes the new token in
  // place (lib/socket.ts). Depending on these stable values instead of the token and user object stops a refresh from
  // tearing the call down, which ended screen shares and cameras while the buttons still said they were on.
  const userId = user?.id ?? null;
  const signedIn = Boolean(accessToken);
  const session = useVoiceStore((state) => state.session);
  const flags = useVoiceStore((state) => state.flags);
  const meshRef = useRef<MeshVoice | null>(null);
  const roomRef = useRef<Room | null>(null);
  const audioHostRef = useRef<HTMLDivElement | null>(null);
  const flagsRef = useRef(flags);
  // Saved account settings. Used only to seed this PC the first time (see useMediaPrefsSync).
  const settingsQuery = useQuery({ queryKey: ["settings", accessToken], queryFn: () => getSettings(accessToken!), enabled: Boolean(accessToken) });
  // Plan limits: ultra video (1440p60) is a Core+ Plus perk; everyone gets HD.
  const limitsQuery = useQuery({ queryKey: ["my-limits", accessToken], queryFn: () => getMyLimits(accessToken!), enabled: Boolean(accessToken), staleTime: 5 * 60_000 });
  const hdVideo = Boolean(limitsQuery.data?.ultraVideo);
  const hdVideoRef = useRef(hdVideo);
  useEffect(() => {
    hdVideoRef.current = hdVideo;
    meshRef.current?.setHdVideo(hdVideo);
  }, [hdVideo]);
  // This PC's choices for the signed-in account: devices, processing, volumes, push to talk.
  useMediaPrefsSync(user?.id ?? null, settingsQuery.data?.preferences.voice);
  const prefs = useMediaStore((state) => state.prefs);
  const prefsRef = useRef(prefs);

  useEffect(() => {
    flagsRef.current = flags;
  }, [flags]);
  // Declared before the call effects below, so they read the latest choices.
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

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
      audio.volume = Math.max(0, Math.min(1, payload.volume * (prefsRef.current.outputVolume / 100)));
      const sinkId = prefsRef.current.speakerDeviceId;
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
    if (stageSession && stage && userId && !stage.speakers.includes(userId)) {
      const { flags, toggle } = useVoiceStore.getState();
      if (flags.camera) toggle("camera");
      if (flags.screenSharing) toggle("screenSharing");
    }
  }, [stage, stageSession, userId]);

  // ------------------------------------------------------------- built-in mesh
  useEffect(() => {
    if (!session || session.mode !== "mesh" || !signedIn || !userId) return;
    const store = useVoiceStore.getState();
    store.setConnection("connecting");
    store.setError(null);
    useMediaStore.getState().setScreenShare({ state: "idle", message: null });
    const choices = prefsRef.current;
    const mesh = new MeshVoice({
      socket: getSocket(useAuthStore.getState().accessToken ?? undefined),
      channelId: session.channelId,
      selfId: userId,
      iceServers: session.iceServers ?? [],
      mic: micSettingsFrom(choices),
      outputVolume: choices.outputVolume / 100,
      outputDeviceId: choices.speakerDeviceId,
      cameraDeviceId: choices.cameraDeviceId,
      onFull: (limit) => {
        useVoiceStore.getState().setError(`This voice channel is full (${limit} people max for peer-to-peer voice).`);
        useVoiceStore.getState().leave();
      },
      onPeersChanged: (peers: MeshPeer[]) =>
        useVoiceStore.getState().setRemote(peers.map((peer) => ({ userId: peer.userId, connected: peer.state === "connected", state: peer.state, video: peer.video, camera: peer.camera, muted: peer.remoteMuted, deafened: peer.remoteDeafened }))),
      onLocalCamera: (stream) => useVoiceStore.getState().setLocalCamera(stream),
      onCameraEnded: () => {
        if (useVoiceStore.getState().flags.camera) useVoiceStore.getState().toggle("camera");
      },
      onScreenShareEnded: () => {
        if (useVoiceStore.getState().flags.screenSharing) useVoiceStore.getState().toggle("screenSharing");
      },
      onScreenState: (update) => useMediaStore.getState().setScreenShare({ state: update.state, message: update.message ?? null, detail: update.detail ?? null }),
      onMicNotice: (notice) => useMediaStore.getState().setMicNotice(notice),
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
      useMediaStore.getState().setScreenShare({ state: "idle", message: null });
      useMediaStore.getState().setMicNotice(null);
    };
  }, [session, signedIn, userId]);

  useEffect(() => {
    meshRef.current?.setMuted(flags.muted);
  }, [flags.muted]);

  // Per-person volume (on this device only), for everyone in the call and anyone who joins later.
  const peerVolumes = useVoiceStore((state) => state.peerVolumes);
  useEffect(() => {
    meshRef.current?.setPeerVolumes(peerVolumes);
  }, [peerVolumes, session]);

  // Microphone choice and processing apply to a live call at once (the outgoing track is replaced,
  // nobody renegotiates). Gain and sensitivity change the live graph only.
  useEffect(() => {
    void meshRef.current?.setMic(micSettingsFrom(prefsRef.current));
  }, [prefs.micDeviceId, prefs.noiseSuppression, prefs.echoCancellation, prefs.autoGainControl, prefs.inputVolume, prefs.inputSensitivity]);
  // Output volume and speaker apply live.
  useEffect(() => {
    meshRef.current?.setOutputVolume(prefs.outputVolume / 100);
    meshRef.current?.setOutputDevice(prefs.speakerDeviceId);
  }, [prefs.outputVolume, prefs.speakerDeviceId, session]);
  // Camera switch while the camera is on (replaceTrack on each camera sender).
  useEffect(() => {
    void meshRef.current?.setCameraDevice(prefs.cameraDeviceId);
  }, [prefs.cameraDeviceId]);

  // Hot-plug: a saved microphone that goes away moves the call to the default, and comes back into use when listed again.
  const meshSession = session?.mode === "mesh";
  useEffect(() => {
    if (!meshSession) return;
    return watchMediaDevices(() => meshRef.current?.handleDevicesChanged());
  }, [meshSession]);

  // Push-to-talk: hold ` (backquote) to talk. Ignored while typing in a text field.
  const pushToTalk = prefs.inputMode === "ptt" && session?.mode === "mesh";
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
    if (flags.camera) void mesh.startCamera(prefsRef.current.cameraDeviceId);
    else mesh.stopCamera(false);
  }, [flags.camera]);

  // ------------------------------------------------------------- LiveKit
  useEffect(() => {
    if (!session || session.mode !== "livekit" || !signedIn) return;
    const audioHost = audioHostRef.current;
    const socket = getSocket(useAuthStore.getState().accessToken ?? undefined);
    const store = useVoiceStore.getState();
    let cancelled = false;
    let room: Room | null = null;
    store.setConnection("connecting");
    store.setError(null);

    void import("livekit-client").then(({ Room: LiveKitRoom, RoomEvent, Track }) => {
    if (cancelled) return;
    // Processing toggles apply to the LiveKit microphone. Device choice is applied on the mesh path only.
    const choices = prefsRef.current;
    room = new LiveKitRoom({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: { noiseSuppression: choices.noiseSuppression, echoCancellation: choices.echoCancellation, autoGainControl: choices.autoGainControl },
    });
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
  }, [session, signedIn]);

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
