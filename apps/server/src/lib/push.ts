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

export function pushConfigured() {
  return configureVapid();
}

export async function dispatchPushNotification(input: PushPayload): Promise<void> {
  if (!configureVapid()) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: input.userId },
    select: { endpoint: true, p256dh: true, auth: true },
  });

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