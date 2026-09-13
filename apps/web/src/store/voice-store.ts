"use client";

import { create } from "zustand";
import type { VoiceTokenResponse } from "@/lib/api";

/**
 * Global voice call state. The engine (components/chat/voice-engine.tsx) lives in
 * the app shell, so a call keeps running while the user browses other pages.
 */

export type VoiceFlags = { muted: boolean; deafened: boolean; screenSharing: boolean; noiseSuppression: boolean; voiceActivity: boolean };
export type VoiceSession = VoiceTokenResponse & { channelId: string; channelName: string; forgeId: string | null };
export type VoiceConnection = "connecting" | "connected" | "reconnecting" | "disconnected";
export type RemotePeer = { userId: string; name?: string; connected: boolean; video?: MediaStream | null };

type VoiceStore = {
  session: VoiceSession | null;
  flags: VoiceFlags;
  connection: VoiceConnection;
  remote: RemotePeer[];
  levels: Record<string, number>;
  localScreen: MediaStream | null;
  error: string | null;
  join: (session: VoiceSession) => void;
  leave: () => void;
  toggle: (flag: keyof VoiceFlags) => void;
  setConnection: (connection: VoiceConnection) => void;
  setRemote: (remote: RemotePeer[]) => void;
  setLevel: (key: string, level: number) => void;
  setLevels: (levels: Record<string, number>) => void;
  setLocalScreen: (stream: MediaStream | null) => void;
  setError: (error: string | null) => void;
};

export const useVoiceStore = create<VoiceStore>()((set) => ({
  session: null,
  flags: { muted: false, deafened: false, screenSharing: false, noiseSuppression: true, voiceActivity: true },
  connection: "disconnected",
  remote: [],
  levels: {},
  localScreen: null,
  error: null,
  join: (session) => set({ session, connection: "connecting", remote: [], levels: {}, localScreen: null, error: null, flags: { muted: false, deafened: false, screenSharing: false, noiseSuppression: true, voiceActivity: true } }),
  leave: () => set({ session: null, connection: "disconnected", remote: [], levels: {}, localScreen: null, error: null }),
  toggle: (flag) => set((state) => ({ flags: { ...state.flags, [flag]: !state.flags[flag] } })),
  setConnection: (connection) => set({ connection }),
  setRemote: (remote) => set({ remote }),
  setLevel: (key, level) => set((state) => (state.levels[key] === level ? state : { levels: { ...state.levels, [key]: level } })),
  setLevels: (levels) => set({ levels }),
  setLocalScreen: (localScreen) => set({ localScreen }),
  setError: (error) => set({ error }),
}));
