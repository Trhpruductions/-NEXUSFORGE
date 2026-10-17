import os from "node:os";
import fs from "node:fs";
import { prisma } from "./prisma.js";
import { env } from "../config/env.js";

/**
 * Honest service status for the Owner Console.
 *
 * Statuses:
 *  - Online: the check ran and the service answered its required function.
 *  - Degraded: the check ran but the service answered with a problem.
 *  - Offline: the check ran and failed.
 *  - Unknown: no probe exists from this process, or no evidence has been recorded yet.
 *  - Not Configured: required settings are missing.
 *
 * A process existing is never reported as Online on its own.
 */

export type ServiceStatus = "Online" | "Degraded" | "Offline" | "Unknown" | "Not Configured";

export type ServiceCheck = {
  id: string;
  name: string;
  status: ServiceStatus;
  latencyMs: number | null;
  detail: string;
  checkedAt: string;
};

const PROBE_TIMEOUT_MS = 5000;

function configuredPresence(names: Array<string | undefined>) {
  return names.every((value) => Boolean(value && value.trim()));
}

async function checkDatabase(): Promise<ServiceCheck> {
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - started;
    return {
      id: "database",
      name: "Database (PostgreSQL)",
      status: latencyMs > 1000 ? "Degraded" : "Online",
      latencyMs,
      detail: latencyMs > 1000 ? "Responding slowly" : "Answering queries",
      checkedAt,
    };
  } catch (error) {
    return {
      id: "database",
      name: "Database (PostgreSQL)",
      status: "Offline",
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? `Query failed: ${error.message.slice(0, 160)}` : "Query failed",
      checkedAt,
    };
  }
}

function checkApi(): ServiceCheck {
  return {
    id: "api",
    name: "Backend API",
    status: "Online",
    latencyMs: 0,
    detail: "This process is serving the request that produced this report",
    checkedAt: new Date().toISOString(),
  };
}

async function checkWebsite(): Promise<ServiceCheck> {
  const url = env.OWNER_SITE_URL;
  const checkedAt = new Date().toISOString();
  if (!url) {
    return { id: "website", name: "Main website", status: "Not Configured", latencyMs: null, detail: "OWNER_SITE_URL is not set", checkedAt };
  }
  const started = Date.now();
  try {
    const response = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    const latencyMs = Date.now() - started;
    if (response.status >= 500) {
      return { id: "website", name: "Main website", status: "Degraded", latencyMs, detail: `HTTP ${response.status} from ${url}`, checkedAt };
    }
    return { id: "website", name: "Main website", status: "Online", latencyMs, detail: `HTTP ${response.status} from ${url}`, checkedAt };
  } catch (error) {
    return {
      id: "website",
      name: "Main website",
      status: "Offline",
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? `No response from ${url}: ${error.message.slice(0, 120)}` : `No response from ${url}`,
      checkedAt,
    };
  }
}

async function checkPayments(): Promise<ServiceCheck> {
  const checkedAt = new Date().toISOString();
  if (!env.STRIPE_SECRET_KEY) {
    return { id: "payments", name: "Payments (Stripe)", status: "Not Configured", latencyMs: null, detail: "STRIPE_SECRET_KEY is not set", checkedAt };
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return { id: "payments", name: "Payments (Stripe)", status: "Degraded", latencyMs: null, detail: "Webhook secret missing, so payment events cannot be verified", checkedAt };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [lastProcessed, failed24h] = await Promise.all([
    prisma.webhookEvent.findFirst({ where: { status: "PROCESSED" }, orderBy: { processedAt: "desc" }, select: { processedAt: true, livemode: true } }),
    prisma.webhookEvent.count({ where: { status: "FAILED", receivedAt: { gte: since } } }),
  ]);

  if (failed24h > 0) {
    return { id: "payments", name: "Payments (Stripe)", status: "Degraded", latencyMs: null, detail: `${failed24h} webhook failure(s) in the last 24 hours`, checkedAt };
  }
  if (!lastProcessed) {
    return { id: "payments", name: "Payments (Stripe)", status: "Unknown", latencyMs: null, detail: "Configured, but no webhook delivery has been recorded yet", checkedAt };
  }
  return {
    id: "payments",
    name: "Payments (Stripe)",
    status: "Online",
    latencyMs: null,
    detail: `Last webhook processed ${lastProcessed.processedAt?.toISOString() ?? "unknown"} (${lastProcessed.livemode ? "live" : "test"} mode)`,
    checkedAt,
  };
}

async function checkWebhookBacklog(): Promise<ServiceCheck> {
  const checkedAt = new Date().toISOString();
  const failed = await prisma.webhookEvent.count({ where: { status: "FAILED" } });
  return {
    id: "webhook-ledger",
    name: "Payment webhook ledger",
    status: failed > 0 ? "Degraded" : "Online",
    latencyMs: null,
    detail: failed > 0 ? `${failed} unresolved failed event(s); Stripe retries them until they succeed` : "No unresolved failed events",
    checkedAt,
  };
}

function configuredOnly(id: string, name: string, configured: boolean, requiredNames: string): ServiceCheck {
  return {
    id,
    name,
    status: configured ? "Unknown" : "Not Configured",
    latencyMs: null,
    detail: configured ? "Configured, but this console does not probe it" : `Set ${requiredNames} to enable`,
    checkedAt: new Date().toISOString(),
  };
}

function checkNotMonitored(id: string, name: string, detail: string): ServiceCheck {
  return { id, name, status: "Unknown", latencyMs: null, detail, checkedAt: new Date().toISOString() };
}

export function getHostMetrics() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const load = os.loadavg();
  let disk: { totalBytes: number; freeBytes: number; usedPercent: number } | null = null;
  try {
    const stats = fs.statfsSync(process.cwd());
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    disk = { totalBytes, freeBytes, usedPercent: totalBytes > 0 ? Math.round(((totalBytes - freeBytes) / totalBytes) * 1000) / 10 : 0 };
  } catch {
    disk = null;
  }
  return {
    hostUptimeSeconds: Math.round(os.uptime()),
    processUptimeSeconds: Math.round(process.uptime()),
    cpuCount: os.cpus().length,
    loadAverage: load.map((value) => Math.round(value * 100) / 100),
    memory: { totalBytes: totalMemory, freeBytes: freeMemory, usedPercent: Math.round(((totalMemory - freeMemory) / totalMemory) * 1000) / 10 },
    disk,
    processMemoryBytes: process.memoryUsage().rss,
  };
}

export async function getServiceChecks(): Promise<ServiceCheck[]> {
  const [database, website, payments, webhooks] = await Promise.all([checkDatabase(), checkWebsite(), checkPayments(), checkWebhookBacklog()]);
  return [
    checkApi(),
    database,
    website,
    payments,
    webhooks,
    checkNotMonitored("sessions", "Authentication and sessions", "Served by the API; no separate probe"),
    checkNotMonitored("realtime", "Chat, presence and voice (WebSocket)", "Runs inside the API process; no separate probe yet"),
    checkNotMonitored("jobs", "Background jobs and schedulers", "Run inside the API process; no heartbeat recorded yet"),
    configuredOnly("email", "Email delivery", configuredPresence([env.SMTP_HOST, env.MAIL_FROM]), "SMTP_HOST and MAIL_FROM"),
    configuredOnly("sms", "SMS delivery", configuredPresence([env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_FROM_NUMBER]), "TWILIO_* settings"),
    configuredOnly("storage", "Uploads and object storage", configuredPresence([env.S3_BUCKET_NAME, env.S3_ACCESS_KEY_ID, env.S3_SECRET_ACCESS_KEY]), "S3_* settings"),
    configuredOnly("voice-media", "Media server voice (LiveKit)", configuredPresence([env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, env.LIVEKIT_WS_URL]), "LIVEKIT_* settings"),
    configuredOnly("discord", "Discord bot", Boolean(env.DISCORD_BOT_ENABLED && env.DISCORD_BOT_TOKEN), "DISCORD_BOT_ENABLED and DISCORD_BOT_TOKEN"),
    checkNotMonitored("gateway", "VEXORA gateway, tunnel and watchdog", "No gateway probe is configured in this app"),
    configuredOnly("apple-google", "Apple and Google store billing", false, "a store billing integration (none exists in this codebase)"),
  ];
}
