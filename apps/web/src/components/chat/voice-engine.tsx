"use client";

import { useEffect, useRef } from "react";
import { ConnectionState, Room, RoomEvent, Track } from "livekit-client";
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

  useEffect(() => {
    flagsRef.current = flags;
  }, [flags]);

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
      constraints: { noiseSuppression: flagsRef.current.noiseSuppression, echoCancellation: true, autoGainControl: true },
      onPeersChanged: (peers: MeshPeer[]) => useVoiceStore.getState().setRemote(peers.map((peer) => ({ userId: peer.userId, connected: peer.state === "connected", video: peer.video }))),
      onScreenShareEnded: () => {
        if (useVoiceStore.getState().flags.screenSharing) useVoiceStore.getState().toggle("screenSharing");
      },
      onLocalScreen: (stream) => useVoiceStore.getState().setLocalScreen(stream),
      onLevel: (key, level) => useVoiceStore.getState().setLevel(key, level),
      onError: (message) => useVoiceStore.getState().setError(message),
    });
    meshRef.current = mesh;
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
  useEffect(() => {
    meshRef.current?.setDeafened(flags.deafened);
  }, [flags.deafened]);
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (flags.screenSharing) void mesh.startScreenShare();
    else mesh.stopScreenShare(false);
  }, [flags.screenSharing]);

  // ------------------------------------------------------------- LiveKit
  useEffect(() => {
    if (!session || session.mode !== "livekit" || !accessToken) return;
    const audioHost = audioHostRef.current;
    const socket = getSocket(accessToken);
    const store = useVoiceStore.getState();
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const syncParticipants = () =>
      useVoiceStore.getState().setRemote(Array.from(room.remoteParticipants.values()).map((participant) => ({ userId: participant.identity, name: participant.name, connected: true })));
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
      useVoiceStore.getState().setConnection("connected");
      syncParticipants();
      syncAudioTracks();
    });
    room.on(RoomEvent.Reconnecting, () => useVoiceStore.getState().setConnection("reconnecting"));
    room.on(RoomEvent.Reconnected, () => useVoiceStore.getState().setConnection("connected"));
    room.on(RoomEvent.Disconnected, () => {
      useVoiceStore.getState().setConnection("disconnected");
      useVoiceStore.getState().setRemote([]);
      audioHost?.replaceChildren();
    });
    room.on(RoomEvent.ParticipantConnected, syncParticipants);
    room.on(RoomEvent.ParticipantDisconnected, syncParticipants);
    room.on(RoomEvent.TrackSubscribed, syncAudioTracks);
    room.on(RoomEvent.TrackUnsubscribed, syncAudioTracks);
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const next: Record<string, number> = {};
      for (const speaker of speakers) next[speaker.identity === room.localParticipant.identity ? "self" : speaker.identity] = Math.round(speaker.audioLevel * 100);
      useVoiceStore.getState().setLevels(next);
    });

    store.setConnection("connecting");
    store.setError(null);
    socket.emit("voice:join", session.channelId);
    room
      .connect(session.wsUrl, session.token, { autoSubscribe: true })
      .then(() => room.localParticipant.setMicrophoneEnabled(!flagsRef.current.muted))
      .catch((connectError: unknown) => {
        useVoiceStore.getState().setError(connectError instanceof Error ? connectError.message : "Unable to connect to voice.");
        useVoiceStore.getState().setConnection("disconnected");
      });

    return () => {
      room.removeAllListeners();
      void room.disconnect();
      if (roomRef.current === room) roomRef.current = null;
      socket.emit("voice:leave", session.channelId);
      audioHost?.replaceChildren();
    };
  }, [session, accessToken]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    void room.localParticipant.setMicrophoneEnabled(!flags.muted);
  }, [flags.muted]);

  // Leaving the app (sign out) ends the call.
  useEffect(() => {
    if (!accessToken && session) useVoiceStore.getState().leave();
  }, [accessToken, session]);

  return <div ref={audioHostRef} className="sr-only" aria-hidden="true" />;
}
