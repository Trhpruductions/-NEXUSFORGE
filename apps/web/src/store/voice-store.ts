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
export type RemotePeer = { userId: string; name?: string; connected: boolean; video?: MediaStream | null; camera?: MediaStream | null; muted?: boolean; deafened?: boolean };

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
