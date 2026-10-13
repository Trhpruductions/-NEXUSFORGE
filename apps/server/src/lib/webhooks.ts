import { prisma } from "./prisma.js";
import { safePostJson } from "./link-preview.js";

const WEBHOOK_TIMEOUT_MS = 10_000;

export type WebhookEventPayload = Record<string, unknown>;

export async function dispatchDeveloperWebhookEvent(
  userId: string,
  eventName: string,
  payload: WebhookEventPayload,
) {
  const subscriptions = await prisma.webhookSubscription.findMany({
    where: {
      userId,
      enabled: true,
      OR: [{ events: { equals: [] } }, { events: { has: eventName } }],
    },
    select: {
      id: true,
      url: true,
    },
  });

  const body = JSON.stringify({
    event: eventName,
    timestamp: new Date().toISOString(),
    payload,
  });

  // Sent through safePostJson: a developer picks the URL, so it must never reach this
  // machine or the local network (no private addresses, no redirects).
  const sendPromises = subscriptions.map(async (subscription) => {
    const response = await safePostJson(
      subscription.url,
      body,
      {
        "X-Vexora-Webhook-Event": eventName,
        "X-Vexora-Webhook-Subscription-Id": subscription.id,
        "X-Vexora-Webhook-Delivered-At": new Date().toISOString(),
      },
      WEBHOOK_TIMEOUT_MS,
    );
    if (!response) {
      console.error(`[webhooks] Delivery ${eventName} to subscription ${subscription.id} failed: unreachable or not allowed`);
    } else if (response.status < 200 || response.status >= 300) {
      console.error(`[webhooks] Delivery ${eventName} to subscription ${subscription.id} failed: HTTP ${response.status}`);
    }
  });

  await Promise.allSettled(sendPromises);
}
