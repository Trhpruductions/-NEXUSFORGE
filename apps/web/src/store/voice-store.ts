"use client";

import { create } from "zustand";
import type { VoiceTokenResponse } from "@/lib/api";

/**
 * Global voice call state. The engine (components/chat/voice-engine.tsx) lives in
 * the app shell, so a call keeps running while the user browses other pages.
 */

export type VoiceFlags = { muted: boolean; deafened: boolean; screenSharing: boolean; camera: boolean; noiseSuppression: boolean; voiceActivity: boolean };
export type VoiceSession = VoiceTokenResponse & { channelId: string; channelName: string; forgeId: string | null; /** Stage channel: speakers and audience. */ stage?: boolean };
export type StageState = { speakers: string[]; raised: string[]; moderators: string[] };
export type VoiceConnection = "connecting" | "connected" | "reconnecting" | "disconnected";
/** state is the peer connection's real state (new, connecting, connected, disconnected, failed, closed). */
export type RemotePeer = { userId: string; name?: string; connected: boolean; state?: RTCPeerConnectionState; video?: MediaStream | null; camera?: MediaStream | null; muted?: boolean; deafened?: boolean };

// How loud each person is for you (0 to 1), kept on this device. Changing it only affects what you hear.
const PEER_VOLUME_KEY = "nf-peer-volumes";
function loadPeerVolumes(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PEER_VOLUME_KEY) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === "number" && value >= 0 && value <= 1)) as Record<string, number>;
  } catch {
    return {};
  }
}

type VoiceStore = {
  session: VoiceSession | null;
  flags: VoiceFlags;
  connection: VoiceConnection;
  remote: RemotePeer[];
  levels: Record<string, number>;
  localScreen: MediaStream | null;
  localCamera: MediaStream | null;
  stage: StageState | null;
  /** The last soundboard sound played in the room (for a short "X played Y" note). */
  lastSound: { userId: string; name: string; emoji: string | null; at: number } | null;
  error: string | null;
  /** Push-to-talk is on (Settings > Voice > input mode) and whether the key is held. */
  pushToTalk: { enabled: boolean; talking: boolean };
  /** Per-person volume (0 to 1) on this device; missing means 100%. */
  peerVolumes: Record<string, number>;
  setPeerVolume: (userId: string, volume: number) => void;
  join: (session: VoiceSession) => void;
  leave: () => void;
  toggle: (flag: keyof VoiceFlags) => void;
  setConnection: (connection: VoiceConnection) => void;
  setRemote: (remote: RemotePeer[]) => void;
  setLevel: (key: string, level: number) => void;
  setLevels: (levels: Record<string, number>) => void;
  setLocalScreen: (stream: MediaStream | null) => void;
  setLocalCamera: (stream: MediaStream | null) => void;
  setStage: (stage: StageState | null) => void;
  setLastSound: (sound: { userId: string; name: string; emoji: string | null; at: number } | null) => void;
  setError: (error: string | null) => void;
  setPushToTalk: (state: { enabled: boolean; talking: boolean }) => void;
};

export const useVoiceStore = create<VoiceStore>()((set) => ({
  session: null,
  flags: { muted: false, deafened: false, screenSharing: false, camera: false, noiseSuppression: true, voiceActivity: true },
  connection: "disconnected",
  remote: [],
  levels: {},
  localScreen: null,
  localCamera: null,
  stage: null,
  lastSound: null,
  error: null,
  pushToTalk: { enabled: false, talking: false },
  peerVolumes: loadPeerVolumes(),
  setPeerVolume: (userId, volume) =>
    set((state) => {
      const clamped = Math.max(0, Math.min(1, volume));
      const peerVolumes = { ...state.peerVolumes, [userId]: clamped };
      if (clamped === 1) delete peerVolumes[userId];
      try {
        window.localStorage.setItem(PEER_VOLUME_KEY, JSON.stringify(peerVolumes));
      } catch {
        // Storage blocked: the volume still applies for this session.
      }
      return { peerVolumes };
    }),
  join: (session) => set({ session, connection: "connecting", remote: [], levels: {}, localScreen: null, localCamera: null, stage: null, error: null, flags: { muted: false, deafened: false, screenSharing: false, camera: false, noiseSuppression: true, voiceActivity: true } }),
  leave: () => set((state) => ({ session: null, connection: "disconnected", remote: [], levels: {}, localScreen: null, localCamera: null, stage: null, error: null, flags: { ...state.flags, screenSharing: false, camera: false } })),
  toggle: (flag) => set((state) => ({ flags: { ...state.flags, [flag]: !state.flags[flag] } })),
  setConnection: (connection) => set({ connection }),
  setRemote: (remote) => set({ remote }),
  setLevel: (key, level) => set((state) => (state.levels[key] === level ? state : { levels: { ...state.levels, [key]: level } })),
  setLevels: (levels) => set({ levels }),
  setLocalScreen: (localScreen) => set({ localScreen }),
  setLocalCamera: (localCamera) => set({ localCamera }),
  setStage: (stage) => set({ stage }),
  setLastSound: (lastSound) => set({ lastSound }),
  setError: (error) => set({ error }),
  setPushToTalk: (pushToTalk) => set((state) => (state.pushToTalk.enabled === pushToTalk.enabled && state.pushToTalk.talking === pushToTalk.talking ? state : { pushToTalk })),
}));
