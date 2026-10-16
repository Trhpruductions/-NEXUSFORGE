"use strict";

// Read-only readiness checklist. Reports presence and length of each setting. Values are never returned.

const { loadEnvFiles } = require("./envfiles");

const REQUIRED = [
  "DATABASE_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "APP_WEB_URL",
  "API_PUBLIC_URL",
  "SMTP_HOST",
  "MAIL_FROM",
  "EMAIL_UNSUBSCRIBE_SECRET",
];
// Optional: when it is missing, the email webhook (delivery reports) is simply disabled.
const OPTIONAL_WEBHOOK = ["EMAIL_WEBHOOK_SECRET"];
const OPTIONAL_SHOWN = ["STRIPE_SECRET_KEY", "TWILIO_ACCOUNT_SID", "S3_BUCKET_NAME", "LIVEKIT_API_KEY", "DISCORD_BOT_TOKEN"];

function buildReadiness() {
  const env = loadEnvFiles();
  const row = (key, group) => ({ key, group, ...env.describe(key) });
  const checks = [
    ...REQUIRED.map((key) => row(key, "required")),
    ...OPTIONAL_WEBHOOK.map((key) => row(key, "optional")),
    ...OPTIONAL_SHOWN.map((key) => row(key, "shown")),
  ];

  const nodeEnv = env.describe("NODE_ENV");
  const nodeEnvValue = nodeEnv.present ? env.valueOf("NODE_ENV") : "";
  const nodeEnvProduction = nodeEnvValue === "production";
  const testModeValue = env.valueOf("EMAIL_TEST_MODE").toLowerCase();
  const testMode = testModeValue === "true" ? "on" : testModeValue === "" ? "unset" : "off";
  const appUrl = env.valueOf("APP_WEB_URL");
  const productionSettings = nodeEnvProduction || /nfgcord\.com/i.test(appUrl);

  const warnings = [];
  if (testMode === "on") {
    warnings.push(
      productionSettings
        ? "EMAIL_TEST_MODE is on while the app is set up for production. Check that real members are not being held back, and that no test routing is hiding mail."
        : "EMAIL_TEST_MODE is on. Fine for development; turn it off before production.",
    );
  }
  if (!nodeEnvProduction) warnings.push("NODE_ENV is not set to production.");
  const missing = checks.filter((c) => c.group === "required" && !c.present).map((c) => c.key);
  if (missing.length > 0) warnings.push(`Required settings missing: ${missing.join(", ")}.`);

  return {
    checkedAt: new Date().toISOString(),
    files: env.files,
    checks,
    warnings,
    requiredMissing: missing,
    ready: missing.length === 0,
    nodeEnvProduction,
    emailWebhookEnabled: env.describe("EMAIL_WEBHOOK_SECRET").present,
    emailTestMode: testMode,
  };
}

module.exports = { buildReadiness, REQUIRED };
