import { config as loadDotEnv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

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

export const env = envSchema.parse(process.env);
