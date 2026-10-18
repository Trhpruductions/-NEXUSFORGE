/**
 * What each Core+ tier unlocks. This is the single source of truth: the server enforces
 * these limits and the pricing page shows them (GET /api/billing/plans).
 *
 * The Free plan deliberately includes what Discord charges Nitro for: 4,000-character
 * messages, a profile banner, an animated avatar, HD (1080p) screen share and 200 servers.
 * Paid tiers add bigger uploads, more servers and ultra (1440p60) video.
 *
 * Limits are only enforced once billing is connected (STRIPE_SECRET_KEY set). Until then
 * there is no way to pay, so everyone gets OPEN_LIMITS, which match what the app allowed
 * before plans existed: nobody loses anything they could already do.
 */
import { env } from "../config/env.js";

export type PlanTier = "NONE" | "CORE" | "PLUS" | "ELITE" | "INFINITE";

export type PlanLimits = {
  label: string;
  /** Largest single upload. */
  uploadBytes: number;
  /** Longest message (channels and DMs). */
  messageLength: number;
  /** Servers you can be in (joined or created). */
  maxServers: number;
  /** A profile banner image. */
  profileBanner: boolean;
  /** An animated (GIF) avatar. */
  animatedAvatar: boolean;
  /** Ultra video: 1440p60 screen share and 1080p camera (otherwise HD: 1080p30 / 720p). */
  ultraVideo: boolean;
};

const MB = 1024 * 1024;

export const PLANS: Record<PlanTier, PlanLimits> = {
  NONE: { label: "Free", uploadBytes: 50 * MB, messageLength: 4000, maxServers: 200, profileBanner: true, animatedAvatar: true, ultraVideo: false },
  CORE: { label: "Core", uploadBytes: 100 * MB, messageLength: 4000, maxServers: 300, profileBanner: true, animatedAvatar: true, ultraVideo: false },
  PLUS: { label: "Plus", uploadBytes: 250 * MB, messageLength: 4000, maxServers: 400, profileBanner: true, animatedAvatar: true, ultraVideo: true },
  ELITE: { label: "Elite", uploadBytes: 500 * MB, messageLength: 4000, maxServers: 500, profileBanner: true, animatedAvatar: true, ultraVideo: true },
  INFINITE: { label: "Infinite", uploadBytes: 1024 * MB, messageLength: 4000, maxServers: 1000, profileBanner: true, animatedAvatar: true, ultraVideo: true },
};

export const TIER_ORDER: PlanTier[] = ["NONE", "CORE", "PLUS", "ELITE", "INFINITE"];

export function billingEnabled() {
  return Boolean(env.STRIPE_SECRET_KEY);
}

/** The limits that apply to this user right now. */
export function limitsFor(user: { premium: boolean; premiumTier: string | null }): PlanLimits & { tier: PlanTier; enforced: boolean } {
  const tier = (user.premium && user.premiumTier && user.premiumTier in PLANS ? user.premiumTier : "NONE") as PlanTier;
  if (!billingEnabled()) {
    // Before billing: at least the Free plan, and everything the app already allowed.
    return {
      label: "Open beta",
      uploadBytes: user.premium ? Math.max(env.PREMIUM_UPLOAD_MAX_BYTES, PLANS.CORE.uploadBytes) : Math.max(env.UPLOAD_MAX_BYTES, PLANS.NONE.uploadBytes),
      messageLength: 4000,
      maxServers: 1000,
      profileBanner: true,
      animatedAvatar: true,
      // HD for everyone; 1440p60 to up to 9 people in a peer-to-peer call is heavy.
      ultraVideo: false,
      tier,
      enforced: false,
    };
  }
  return { ...PLANS[tier], tier, enforced: true };
}

/** The cheapest tier that satisfies `test`, for "Upgrade to X" messages. */
export function cheapestTierWith(test: (limits: PlanLimits) => boolean): PlanTier {
  return TIER_ORDER.find((tier) => tier !== "NONE" && test(PLANS[tier])) ?? "CORE";
}

/** The standard 402 body the web app turns into an upgrade prompt. */
export function upgradeRequired(message: string, feature: string, requiredTier: PlanTier) {
  return { error: message, code: "UPGRADE_REQUIRED", feature, requiredTier, requiredTierLabel: PLANS[requiredTier].label };
}
