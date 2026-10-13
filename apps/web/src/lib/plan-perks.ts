import type { PlanInfo } from "@/lib/api";

/** One step down the ladder, for "Everything in …" and to show only what a tier adds. */
export const PREVIOUS_TIER: Record<string, string> = { CORE: "NONE", PLUS: "CORE", ELITE: "PLUS", INFINITE: "ELITE" };

export const megabytes = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

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
