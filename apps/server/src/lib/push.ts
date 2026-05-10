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
    url: "/notifications",
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
          await prisma.pushSubscription.deleteMany({ where: { endpoint: subscription.endpoint } });
        }
      }
    }),
  );
}