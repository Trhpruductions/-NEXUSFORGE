import { config as loadDotEnv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

function decodeClientIdFromBotToken(token?: string) {
  const value = String(token || "").trim();
  if (!value) {
    return "";
  }

  const firstSegment = value.split(".")[0] || "";
  if (!firstSegment) {
    return "";
  }

  const normalized = firstSegment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  try {
    const decoded = Buffer.from(padded, "base64").toString("utf8").trim();
    return /^\d{15,21}$/.test(decoded) ? decoded : "";
  } catch {
    return "";
  }
}

function resolveClientId(
  explicitClientId?: string,
  applicationId?: string,
  installUrl?: string,
  botToken?: string,
) {
  const direct = String(explicitClientId || "").trim();
  if (direct) {
    return direct;
  }

  const appId = String(applicationId || "").trim();
  if (appId) {
    return appId;
  }

  const url = String(installUrl || "").trim();
  if (url) {
    try {
      const parsed = new URL(url);
      const fromQuery = String(parsed.searchParams.get("client_id") || "").trim();
      if (fromQuery) {
        return fromQuery;
      }
    } catch {
      // Ignore malformed install URL and continue fallback chain.
    }
  }

  return decodeClientIdFromBotToken(botToken);
}

const localEnvPath = fileURLToPath(new URL("../../.env", import.meta.url));
const envPaths = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "apps/server/.env"),
  localEnvPath,
];

for (const path of envPaths) {
  loadDotEnv({ path, override: false });
}

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CLIENT_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().default(30),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  LIVEKIT_WS_URL: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET_NAME: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  WEB_PUSH_SUBJECT: z.string().default("mailto:admin@nexusforge.local"),
  WEB_PUSH_VAPID_PUBLIC_KEY: z.string().optional(),
  WEB_PUSH_VAPID_PRIVATE_KEY: z.string().optional(),
  UPLOAD_MAX_BYTES: z.coerce.number().default(25 * 1024 * 1024),
  PREMIUM_UPLOAD_MAX_BYTES: z.coerce.number().default(150 * 1024 * 1024),
  APP_WEB_URL: z.string().default("http://localhost:3000"),
  DISCORD_BOT_ENABLED: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() === "true"),
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_APPLICATION_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_PUBLIC_KEY: z.string().optional(),
  DISCORD_REGISTER_COMMANDS_ON_START: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() !== "false"),
  DISCORD_ENFORCE_CLIENT_ID_MATCH: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() !== "false"),
  DISCORD_GUILD_ID: z.string().optional(),
  DISCORD_INSTALL_URL: z.string().optional(),
  DISCORD_REPORT_ENABLED: z
    .string()
    .default("true")
    .transform((value) => value.toLowerCase() !== "false"),
  DISCORD_REPORT_GUILD_ID: z.string().optional(),
  DISCORD_REPORT_CATEGORY_ID: z.string().optional(),
  DISCORD_REPORT_CHANNEL_STATUS: z.string().default("bot-status"),
  DISCORD_REPORT_CHANNEL_ERRORS: z.string().default("bot-errors"),
  DISCORD_REPORT_CHANNEL_ALERTS: z.string().default("bot-alerts"),
  DISCORD_REPORT_CHANNEL_SOCIAL: z.string().default("bot-social"),
  DISCORD_REPORT_CHANNEL_APP_HEALTH: z.string().default("app-health"),
  DISCORD_REPORT_CHANNEL_APP_RUNTIME: z.string().default("app-runtime"),
  DISCORD_REPORT_CHANNEL_APP_RELEASE_OPS: z.string().default("app-release-ops"),
  DISCORD_REPORT_CHANNEL_APP_SECURITY: z.string().default("app-security"),
  DISCORD_REPORT_CHANNEL_APP_PERFORMANCE: z.string().default("app-performance"),
  DISCORD_REPORT_CHANNEL_APP_USER_FEEDBACK: z.string().default("app-user-feedback"),
  DISCORD_REPORT_HEARTBEAT_MINUTES: z.coerce.number().default(0),
  DISCORD_SOCIAL_CHANNEL_ID: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_CORE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_CORE_YEARLY: z.string().optional(),
  STRIPE_PRICE_PLUS_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PLUS_YEARLY: z.string().optional(),
  STRIPE_PRICE_ELITE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ELITE_YEARLY: z.string().optional(),
  STRIPE_PRICE_INFINITE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_INFINITE_YEARLY: z.string().optional(),
  STRIPE_PRICE_FORGE_BOOST_PACK: z.string().optional(),
  STRIPE_PRICE_CREATOR_CAMPAIGN_SLOT: z.string().optional(),
  STRIPE_PRICE_EVENT_TICKET_PASS: z.string().optional(),
  STRIPE_PRICE_TEAM_BRANDING_KIT: z.string().optional(),
  STRIPE_PRICE_ADVANCED_MODERATION_AI: z.string().optional(),
});

const parsedEnv = envSchema.parse(process.env);
const resolvedDiscordClientId = resolveClientId(
  parsedEnv.DISCORD_CLIENT_ID,
  parsedEnv.DISCORD_APPLICATION_ID,
  parsedEnv.DISCORD_INSTALL_URL,
  parsedEnv.DISCORD_BOT_TOKEN,
);

export const env = {
  ...parsedEnv,
  DISCORD_CLIENT_ID: resolvedDiscordClientId || parsedEnv.DISCORD_CLIENT_ID,
};
