import webPush from "web-push";
import { env } from "../config/env.js";
import { prisma } from "./prisma.js";

type PushPayload = {
  userId: string;
  title: string;
  body: string;
  data?: unknown;
  notificationId: string;
};

let vapidConfigured = false;

function configureVapid(): boolean {
  if (vapidConfigured) return true;

  const publicKey = env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) {
    return false;
  }

  webPush.setVapidDetails(env.WEB_PUSH_SUBJECT, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

/** Where tapping the notification should take you: the conversation, or your inbox. */
export function pushUrlFor(data: unknown): string {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const str = (key: string) => (typeof d[key] === "string" ? encodeURIComponent(d[key] as string) : null);
  if (str("forgeId") && str("channelId")) return `/app/chat?forge=${str("forgeId")}&channel=${str("channelId")}`;
  // A thread id without a channel is a direct-message conversation.
  if (str("threadId") && !str("channelId")) return `/app/chat?dm=${str("threadId")}`;
  if (str("ticketId")) return `/app/support?ticket=${str("ticketId")}`;
  return "/app/notifications";
}

/**
 * The web push services browsers actually hand out subscriptions for: Chrome and the other Chromium browsers
 * (Brave, Opera, Samsung Internet...) use Firebase Cloud Messaging, Edge on Windows uses the Windows
 * notification service, Firefox uses Mozilla's autopush and Safari uses Apple's web push service.
 * A subscription pointing anywhere else is refused: the server sends a request to that address for every
 * notification (and for every "send a test"), so an arbitrary URL let anyone signed in aim the server at any
 * address, internal ones included.
 */
const PUSH_SERVICE_HOSTS = new Set(["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);
const PUSH_SERVICE_HOST_SUFFIXES = [".push.services.mozilla.com", ".notify.windows.com", ".push.apple.com"];

/** Most push devices kept per account. Registering another one drops the one refreshed longest ago. */
export const MAX_PUSH_SUBSCRIPTIONS_PER_USER = 10;

/** True for an https address on one of the known browser push services (default port, no user info). */
export function isAllowedPushEndpoint(endpoint: unknown): boolean {
  if (typeof endpoint !== "string" || endpoint.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_SERVICE_HOSTS.has(host) || PUSH_SERVICE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}

/**
 * Makes room for one more push device on this account: anything beyond the newest (max - 1) other
 * subscriptions is removed, oldest first. The endpoint being registered is never counted or removed.
 * Returns how many were removed.
 */
export async function makeRoomForPushSubscription(userId: string, endpoint: string, max = MAX_PUSH_SUBSCRIPTIONS_PER_USER): Promise<number> {
  const surplus = await prisma.pushSubscription.findMany({
    where: { userId, NOT: { endpoint } },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    skip: Math.max(0, max - 1),
    select: { id: true },
  });
  if (!surplus.length) return 0;
  const removed = await prisma.pushSubscription.deleteMany({ where: { userId, id: { in: surplus.map((row) => row.id) } } });
  return removed.count;
}

export function pushConfigured() {
  return configureVapid();
}

export async function dispatchPushNotification(input: PushPayload): Promise<void> {
  if (!configureVapid()) return;

  // Newest devices first, and never more than the per-account cap. Subscriptions saved before endpoints were
  // checked are skipped if they don't point at a known push service.
  const stored = await prisma.pushSubscription.findMany({
    where: { userId: input.userId },
    orderBy: { updatedAt: "desc" },
    take: MAX_PUSH_SUBSCRIPTIONS_PER_USER,
    select: { endpoint: true, p256dh: true, auth: true },
  });
  const subscriptions = stored.filter((subscription) => isAllowedPushEndpoint(subscription.endpoint));
  if (subscriptions.length < stored.length) {
    console.warn(`[push] skipped ${stored.length - subscriptions.length} subscription(s) for user ${input.userId}: not a known push service`);
  }

  if (!subscriptions.length) return;

  const payload = JSON.stringify({
    notificationId: input.notificationId,
    title: input.title,
    body: input.body,
    data: input.data ?? null,
    url: pushUrlFor(input.data),
  });

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
        );
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: unknown }).statusCode) : undefined;
        if (statusCode === 404 || statusCode === 410) {
          // The browser unsubscribed or the subscription expired.
          await prisma.pushSubscription.deleteMany({ where: { endpoint: subscription.endpoint } });
        } else {
          console.warn(`[push] delivery failed (${statusCode ?? "network"}) for user ${input.userId}`);
        }
      }
    }),
  );
}