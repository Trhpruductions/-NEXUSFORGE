import { prisma } from "./prisma.js";
import { safePostJson } from "./link-preview.js";

/** Delivery headers. Header names must be plain tokens (no spaces), or the request is never sent. */
export function webhookHeaders(event: string, subscriptionId: string, deliveredAt = new Date().toISOString()): Record<string, string> {
  return {
    "X-NexusForge-Webhook-Event": event,
    "X-NexusForge-Webhook-Subscription-Id": subscriptionId,
    "X-NexusForge-Webhook-Delivered-At": deliveredAt,
  };
}

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
      webhookHeaders(eventName, subscription.id),
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
