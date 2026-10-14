import type { PlanInfo } from "@/lib/api";

/** One step down the ladder, for "Everything in …" and to show only what a tier adds. */
export const PREVIOUS_TIER: Record<string, string> = { CORE: "NONE", PLUS: "CORE", ELITE: "PLUS", INFINITE: "ELITE" };

/** "50 MB", or "1 GB" from 1024 MB up. Used for upload sizes everywhere they're shown. */
export const megabytes = (bytes: number) => {
  const mb = Math.round(bytes / (1024 * 1024));
  return mb >= 1024 ? `${Math.round(mb / 1024)} GB` : `${mb} MB`;
};

/** Perk lines for a tier, straight from the plan catalog the server enforces. */
export function perksFor(plan: PlanInfo | undefined, previous: PlanInfo | undefined) {
  if (!plan) return [];
  const lines = [
    `Uploads up to ${megabytes(plan.uploadBytes)}`,
    `${plan.messageLength.toLocaleString()}-character messages`,
    `Be in up to ${plan.maxServers} servers`,
  ];
  if (plan.ultraVideo && !previous?.ultraVideo) lines.push("Ultra video: 1440p60 screen share, 1080p camera");
  if (previous && previous.tier !== "NONE") lines.unshift(`Everything in ${previous.label}`);
  return lines;
}
