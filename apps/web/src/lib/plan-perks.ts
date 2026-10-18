import type { PlanInfo } from "@/lib/api";

/** One step down the ladder, for "Everything in …" and to show only what a tier adds. */
export const PREVIOUS_TIER: Record<string, string> = { CORE: "NONE", PLUS: "CORE", ELITE: "PLUS", INFINITE: "ELITE" };

/** "50 MB", or "1 GB" from 1024 MB up. Used for upload sizes everywhere they're shown. */
export const megabytes = (bytes: number) => {
  const mb = Math.round(bytes / (1024 * 1024));
  return mb >= 1024 ? `${Math.round(mb / 1024)} GB` : `${mb} MB`;
};

/**
 * The upload size a plan can use in production today. Files go through the server's 95 MB proxy cap
 * (apps/server uploads.routes.ts, local storage), so paid plans are shown at that cap. The plan entitlement
 * itself is unchanged. Update this when real storage (S3) is configured and per-plan limits apply.
 */
export const SHOWN_UPLOAD_CAP_BYTES = 95 * 1024 * 1024;
export const shownUploadBytes = (plan: { uploadBytes: number }) => Math.min(plan.uploadBytes, SHOWN_UPLOAD_CAP_BYTES);

/** Perk lines for a tier, straight from the plan catalog the server enforces. */
export function perksFor(plan: PlanInfo | undefined, previous: PlanInfo | undefined) {
  if (!plan) return [];
  const lines = [
    `Uploads up to ${megabytes(shownUploadBytes(plan))}`,
    `${plan.messageLength.toLocaleString()}-character messages`,
    `Be in up to ${plan.maxServers} servers`,
  ];
  if (plan.ultraVideo && !previous?.ultraVideo) lines.push("Ultra video: 1440p60 screen share, 1080p camera");
  if (previous && previous.tier !== "NONE") lines.unshift(`Everything in ${previous.label}`);
  return lines;
}
