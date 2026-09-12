"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type ChannelCounts = { unread: number; mentions: number };

type WorkspaceState = {
  selectedForgeId: string | null;
  activeChannelId: string | null;
  /** Unread counts keyed by channel id, for the forge currently loaded in the sidebar. */
  channelCounts: Record<string, ChannelCounts>;
  /** Unread totals keyed by forge id, for the server rail. */
  forgeCounts: Record<string, ChannelCounts>;
  setSelectedForgeId: (forgeId: string | null) => void;
  setActiveChannelId: (channelId: string | null) => void;
  setChannelCounts: (counts: Record<string, ChannelCounts>) => void;
  setForgeCounts: (counts: Record<string, ChannelCounts>) => void;
  bumpChannel: (forgeId: string, channelId: string, mentioned: boolean) => void;
  clearChannel: (forgeId: string, channelId: string) => void;
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      selectedForgeId: null,
      activeChannelId: null,
      channelCounts: {},
      forgeCounts: {},
      setSelectedForgeId: (forgeId) => set({ selectedForgeId: forgeId }),
      setActiveChannelId: (channelId) => set({ activeChannelId: channelId }),
      setChannelCounts: (counts) => set({ channelCounts: counts }),
      setForgeCounts: (counts) => set({ forgeCounts: counts }),
      bumpChannel: (forgeId, channelId, mentioned) => {
        const { channelCounts, forgeCounts, activeChannelId } = get();
        if (activeChannelId === channelId) return;
        const channel = channelCounts[channelId] ?? { unread: 0, mentions: 0 };
        const forge = forgeCounts[forgeId] ?? { unread: 0, mentions: 0 };
        set({
          channelCounts: { ...channelCounts, [channelId]: { unread: channel.unread + 1, mentions: channel.mentions + (mentioned ? 1 : 0) } },
          forgeCounts: { ...forgeCounts, [forgeId]: { unread: forge.unread + 1, mentions: forge.mentions + (mentioned ? 1 : 0) } },
        });
      },
      clearChannel: (forgeId, channelId) => {
        const { channelCounts, forgeCounts } = get();
        const channel = channelCounts[channelId];
        if (!channel) return;
        const forge = forgeCounts[forgeId] ?? { unread: 0, mentions: 0 };
        set({
          channelCounts: { ...channelCounts, [channelId]: { unread: 0, mentions: 0 } },
          forgeCounts: {
            ...forgeCounts,
            [forgeId]: { unread: Math.max(0, forge.unread - channel.unread), mentions: Math.max(0, forge.mentions - channel.mentions) },
          },
        });
      },
    }),
    {
      name: "vexora-workspace",
      storage: createJSONStorage(() => (typeof window === "undefined" ? { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } : window.localStorage)),
      partialize: (state) => ({ selectedForgeId: state.selectedForgeId }),
    },
  ),
);
