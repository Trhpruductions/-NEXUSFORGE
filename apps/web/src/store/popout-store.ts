"use client";

import { create } from "zustand";

/**
 * Which panels are open in their own window. The panels themselves still belong to this page (see PopoutHost), so a
 * popped-out voice room is the same call, not a second one, and closing the popout puts the panel back.
 */
export type PopoutState = {
  voice: { channelId: string } | null;
  /** The screen share being watched in its own window: "self" or the sharer's user id. */
  share: { key: string; name: string } | null;
  members: { forgeId: string } | null;
};

type PopoutStore = PopoutState & {
  open: <K extends keyof PopoutState>(kind: K, target: NonNullable<PopoutState[K]>) => void;
  close: (kind: keyof PopoutState) => void;
  /** Bumped to bring an already open popout to the front. */
  focusRequest: { kind: keyof PopoutState; at: number } | null;
  focus: (kind: keyof PopoutState) => void;
};

export const usePopoutStore = create<PopoutStore>()((set) => ({
  voice: null,
  share: null,
  members: null,
  focusRequest: null,
  open: (kind, target) => set({ [kind]: target } as Partial<PopoutState>),
  close: (kind) => set({ [kind]: null } as Partial<PopoutState>),
  focus: (kind) => set({ focusRequest: { kind, at: Date.now() } }),
}));
