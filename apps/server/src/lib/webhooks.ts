import { prisma } from "./prisma.js";

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

  const sendPromises = subscriptions.map(async (subscription) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    try {
      const response = await fetch(subscription.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-NexusForge-Webhook-Event": eventName,
          "X-NexusForge-Webhook-Subscription-Id": subscription.id,
          "X-NexusForge-Webhook-Delivered-At": new Date().toISOString(),
        },
        body,
        redirect: "follow",
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(
          `[webhooks] Delivery ${eventName} to ${subscription.url} failed: ${response.status} ${response.statusText} - ${text.slice(0, 500)}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[webhooks] Delivery ${eventName} to ${subscription.url} failed: ${message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  });

  await Promise.allSettled(sendPromises);
}
