import { create } from "zustand";

/** What the server said when something needs a higher plan (a 402 UPGRADE_REQUIRED). */
export type UpgradePrompt = { message: string; feature: string; requiredTier: string; requiredTierLabel: string };

type PaywallState = {
  prompt: UpgradePrompt | null;
  show: (prompt: UpgradePrompt) => void;
  close: () => void;
};

export const usePaywallStore = create<PaywallState>((set) => ({
  prompt: null,
  show: (prompt) => set({ prompt }),
  close: () => set({ prompt: null }),
}));

export function isUpgradePrompt(value: unknown): value is UpgradePrompt & { code: string; error: string } {
  return Boolean(value && typeof value === "object" && (value as { code?: string }).code === "UPGRADE_REQUIRED");
}
