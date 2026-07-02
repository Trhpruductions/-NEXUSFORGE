import { randomBytes, createHash } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

const createApiKeySchema = z.object({
  name: z.string().min(2).max(80),
});

const updateApiKeySchema = z.object({
  name: z.string().min(2).max(80).optional(),
  enabled: z.boolean().optional(),
});

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

developerRouter.get("/keys", async (req, res) => {
  const keys = await prisma.apiKey.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      enabled: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  res.json({ keys });
});

developerRouter.post("/keys", requireCsrf, async (req, res) => {
  const parsed = createApiKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const secret = randomBytes(32).toString("hex");
  const secretHash = createHash("sha256").update(secret).digest("hex");

  const apiKey = await prisma.apiKey.create({
    data: {
      userId: req.user!.id,
      name: parsed.data.name,
      secretHash,
      enabled: true,
    },
    select: {
      id: true,
      name: true,
      enabled: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  res.status(201).json({ apiKey, secret });
});

developerRouter.patch("/keys/:keyId", requireCsrf, async (req, res) => {
  const parsed = updateApiKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { id: req.params.keyId },
    select: { id: true, userId: true },
  });

  if (!apiKey) {
    res.status(404).json({ error: "API key not found" });
    return;
  }

  if (apiKey.userId !== req.user!.id) {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

  const updated = await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
    },
    select: {
      id: true,
      name: true,
      enabled: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  res.json({ apiKey: updated });
});

developerRouter.delete("/keys/:keyId", requireCsrf, async (req, res) => {
  const apiKey = await prisma.apiKey.findUnique({
    where: { id: req.params.keyId },
    select: { id: true, userId: true },
  });

  if (!apiKey) {
    res.status(404).json({ error: "API key not found" });
    return;
  }

  if (apiKey.userId !== req.user!.id) {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

  await prisma.apiKey.delete({ where: { id: apiKey.id } });
  res.status(204).send();
});

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
    message: "This is a test payload from NexusForge webhook delivery.",
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-NexusForge-Webhook-Event": "webhook.test",
        "X-NexusForge-Webhook-Subscription-Id": webhook.id,
      },
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: controller.signal,
    });

    const responseText = await response.text();

    if (!response.ok) {
      res.status(502).json({
        error: "Webhook delivery failed",
        status: response.status,
        statusText: response.statusText,
        response: responseText.slice(0, 1000),
      });
      return;
    }

    res.json({ ok: true, status: response.status, response: responseText.slice(0, 1000) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Webhook test delivery failed:", message);
    res.status(502).json({ error: "Webhook test delivery failed", details: message });
  } finally {
    clearTimeout(timeoutId);
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
