"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { DEFAULT_MEDIA_PREFS, readMediaPrefs, sanitizeMediaPrefs, seedFromServer, writeMediaPrefs, type MediaPrefs, type ServerVoiceSeed } from "./media-prefs";

/**
 * This PC's voice and video choices, one saved entry per account (nf-media-prefs:<userId>).
 * The call engine and the settings page both read it, so a change applies everywhere at once.
 */

function localStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Access to storage can throw when the browser blocks site data.
    return null;
  }
}

export type MediaNotice = { tone: "info" | "warn" | "error"; text: string } | null;

export type ScreenShareStatus = {
  state: "idle" | "requesting" | "sharing" | "stopped" | "denied" | "error";
  message: string | null;
};

type MediaStore = {
  /** Undefined until the first load; then the signed-in user id, or null when signed out. */
  userId: string | null | undefined;
  prefs: MediaPrefs;
  /** This account has choices saved on this PC. The server copy only seeds the first load. */
  persisted: boolean;
  load: (userId: string | null) => void;
  seed: (userId: string | null, server: ServerVoiceSeed | undefined) => void;
  update: (patch: Partial<MediaPrefs>) => void;
  /** Runtime status, not saved. */
  micNotice: MediaNotice;
  setMicNotice: (notice: MediaNotice) => void;
  screenShare: ScreenShareStatus;
  setScreenShare: (status: ScreenShareStatus) => void;
};

export const useMediaStore = create<MediaStore>()((set, get) => ({
  userId: undefined,
  prefs: DEFAULT_MEDIA_PREFS,
  persisted: false,
  load: (userId) => {
    if (get().userId === userId) return;
    const stored = readMediaPrefs(localStore(), userId);
    set({ userId, prefs: stored ?? DEFAULT_MEDIA_PREFS, persisted: stored !== null });
  },
  seed: (userId, server) => {
    const state = get();
    // Only the first time an account is seen on this PC; after that, local choices win.
    if (!server || !userId || state.userId !== userId || state.persisted) return;
    const prefs = seedFromServer(server);
    set({ prefs, persisted: true });
    writeMediaPrefs(localStore(), userId, prefs);
  },
  update: (patch) => {
    const { userId, prefs } = get();
    const next = sanitizeMediaPrefs({ ...prefs, ...patch }, prefs);
    set({ prefs: next, persisted: true });
    if (userId) writeMediaPrefs(localStore(), userId, next);
  },
  micNotice: null,
  setMicNotice: (micNotice) => set({ micNotice }),
  screenShare: { state: "idle", message: null },
  setScreenShare: (screenShare) => set({ screenShare }),
}));

/** Loads the signed-in account's saved choices and seeds them from server settings the first time. */
export function useMediaPrefsSync(userId: string | null | undefined, server: ServerVoiceSeed | undefined) {
  useEffect(() => {
    useMediaStore.getState().load(userId ?? null);
  }, [userId]);
  useEffect(() => {
    useMediaStore.getState().seed(userId ?? null, server);
  }, [userId, server]);
}
