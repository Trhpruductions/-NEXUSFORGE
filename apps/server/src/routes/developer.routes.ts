import { randomBytes, createHash } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { safePostJson } from "../lib/link-preview.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

const createWebhookSchema = z.object({
  url: z.string().url(),
  description: z.string().max(300).optional(),
  events: z.array(z.string().min(1).max(80)).max(20).optional(),
  enabled: z.boolean().optional().default(true),
});

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  description: z.string().max(300).optional(),
  events: z.array(z.string().min(1).max(80)).max(20).optional(),
  enabled: z.boolean().optional(),
});

const createOAuthClientSchema = z.object({
  name: z.string().min(2).max(80),
  redirectUris: z.array(z.string().url()).max(10).optional(),
});

const updateOAuthClientSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  redirectUris: z.array(z.string().url()).max(10).optional(),
  enabled: z.boolean().optional(),
});

export const developerRouter = Router();

developerRouter.use(requireAuth);

developerRouter.get("/oauth-clients", async (req, res) => {
  const clients = await prisma.oAuthClient.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      clientId: true,
      redirectUris: true,
      enabled: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({ clients });
});

developerRouter.post("/oauth-clients", requireCsrf, async (req, res) => {
  const parsed = createOAuthClientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const clientId = `nf-client-${randomBytes(10).toString("hex")}`;
  const secret = randomBytes(24).toString("hex");
  const clientSecretHash = createHash("sha256").update(secret).digest("hex");

  const client = await prisma.oAuthClient.create({
    data: {
      userId: req.user!.id,
      name: parsed.data.name,
      clientId,
      clientSecretHash,
      redirectUris: parsed.data.redirectUris ?? [],
      enabled: true,
    },
    select: {
      id: true,
      name: true,
      clientId: true,
      redirectUris: true,
      enabled: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.status(201).json({ client, secret });
});

developerRouter.patch("/oauth-clients/:clientId", requireCsrf, async (req, res) => {
  const parsed = updateOAuthClientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: req.params.clientId },
    select: { id: true, userId: true },
  });

  if (!client) {
    res.status(404).json({ error: "OAuth client not found" });
    return;
  }

  if (client.userId !== req.user!.id) {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

  const updated = await prisma.oAuthClient.update({
    where: { id: client.id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.redirectUris ? { redirectUris: parsed.data.redirectUris } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
    },
    select: {
      id: true,
      name: true,
      clientId: true,
      redirectUris: true,
      enabled: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({ client: updated });
});

developerRouter.post("/oauth-clients/:clientId/rotate-secret", requireCsrf, async (req, res) => {
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: req.params.clientId },
    select: { id: true, userId: true },
  });

  if (!client) {
    res.status(404).json({ error: "OAuth client not found" });
    return;
  }

  if (client.userId !== req.user!.id) {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

  const newSecret = randomBytes(24).toString("hex");
  const clientSecretHash = createHash("sha256").update(newSecret).digest("hex");

  const updated = await prisma.oAuthClient.update({
    where: { id: client.id },
    data: { clientSecretHash },
    select: {
      id: true,
      name: true,
      clientId: true,
      redirectUris: true,
      enabled: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.status(200).json({ client: updated, secret: newSecret });
});

developerRouter.delete("/oauth-clients/:clientId", requireCsrf, async (req, res) => {
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: req.params.clientId },
    select: { id: true, userId: true },
  });

  if (!client) {
    res.status(404).json({ error: "OAuth client not found" });
    return;
  }

  if (client.userId !== req.user!.id) {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

  await prisma.oAuthClient.delete({ where: { id: client.id } });
  res.status(204).send();
});

developerRouter.get("/webhooks", async (req, res) => {
  const webhooks = await prisma.webhookSubscription.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    // Never the secret: it is shown once, at creation.
    select: {
      id: true,
      url: true,
      description: true,
      events: true,
      enabled: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({ webhooks });
});

developerRouter.post("/webhooks", requireCsrf, async (req, res) => {
  const parsed = createWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const secret = randomBytes(24).toString("hex");
  const secretHash = createHash("sha256").update(secret).digest("hex");

  const webhook = await prisma.webhookSubscription.create({
    data: {
      userId: req.user!.id,
      url: parsed.data.url,
      description: parsed.data.description,
      events: parsed.data.events ?? [],
      enabled: parsed.data.enabled,
      secretHash,
    },
    select: {
      id: true,
      url: true,
      description: true,
      events: true,
      enabled: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.status(201).json({ webhook, secret });
});

developerRouter.patch("/webhooks/:webhookId", requireCsrf, async (req, res) => {
  const parsed = updateWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const webhook = await prisma.webhookSubscription.findUnique({
    where: { id: req.params.webhookId },
    select: { id: true, userId: true },
  });

  if (!webhook) {
    res.status(404).json({ error: "Webhook not found" });
    return;
  }

  if (webhook.userId !== req.user!.id) {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

  const updated = await prisma.webhookSubscription.update({
    where: { id: webhook.id },
    data: {
      ...(parsed.data.url ? { url: parsed.data.url } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.events ? { events: parsed.data.events } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
    },
    select: {
      id: true,
      url: true,
      description: true,
      events: true,
      enabled: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({ webhook: updated });
});

developerRouter.post("/webhooks/:webhookId/test", requireCsrf, async (req, res) => {
  const webhook = await prisma.webhookSubscription.findUnique({
    where: { id: req.params.webhookId },
    select: { id: true, userId: true, url: true, enabled: true },
  });

  if (!webhook) {
    res.status(404).json({ error: "Webhook not found" });
    return;
  }

  if (webhook.userId !== req.user!.id) {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

  if (!webhook.enabled) {
    res.status(400).json({ error: "Webhook is disabled" });
    return;
  }

  const payload = {
    event: "webhook.test",
    timestamp: new Date().toISOString(),
    subscriptionId: webhook.id,
    message: "This is a test payload from Vexora Gaming webhook delivery.",
  };

  try {
    // Guarded like real deliveries: public http(s) addresses only, no redirects.
    const response = await safePostJson(webhook.url, JSON.stringify(payload), {
      "X-Vexora-Webhook-Event": "webhook.test",
      "X-Vexora-Webhook-Subscription-Id": webhook.id,
    }, 10000);

    if (!response) {
      res.status(502).json({ error: "Webhook delivery failed", details: "The URL couldn't be reached, or points to a private or local address (only public http/https on ports 80 and 443 are allowed)." });
      return;
    }
    if (response.status < 200 || response.status >= 300) {
      res.status(502).json({ error: "Webhook delivery failed", status: response.status, response: response.text.slice(0, 1000) });
      return;
    }

    res.json({ ok: true, status: response.status, response: response.text.slice(0, 1000) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Webhook test delivery failed:", message);
    res.status(502).json({ error: "Webhook test delivery failed", details: message });
  }
});

developerRouter.delete("/webhooks/:webhookId", requireCsrf, async (req, res) => {
  const webhook = await prisma.webhookSubscription.findUnique({
    where: { id: req.params.webhookId },
    select: { id: true, userId: true },
  });

  if (!webhook) {
    res.status(404).json({ error: "Webhook not found" });
    return;
  }

  if (webhook.userId !== req.user!.id) {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

  await prisma.webhookSubscription.delete({ where: { id: webhook.id } });
  res.status(204).send();
});
