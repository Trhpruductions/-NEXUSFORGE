/**
 * Staff-only email tools, mounted at /api/admin/email. Every route checks the admin role first.
 * The status and message list show configuration booleans and redacted records only: no secret
 * values, no full recipient addresses, no bodies, tokens, codes or links.
 */
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { emailMode, sendTemplateEmail } from "../lib/delivery.js";
import { senderAddress } from "../lib/email-template.js";
import { DUPLICATE_WINDOW_MS, EMAIL_KINDS, TEMPLATE_CATEGORY, isEmailKind } from "../lib/email-policy.js";
import { EMAIL_STATUSES, MAX_SEND_RETRIES, normaliseRecipient, redactErrorText } from "../lib/email-status.js";
import { secretUsable } from "../lib/email-tokens.js";
import { emailContextFromEnv, renderSample, templateCatalog } from "../lib/email-templates.js";
import { confirmCurrentPassword, PASSWORD_REQUIRED } from "../lib/reauth.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { requireCsrf } from "../middleware/csrf.js";
import { accountOrIpKey } from "../middleware/rate-limit.js";

export const adminEmailRouter = Router();

adminEmailRouter.use(requireAuth);
adminEmailRouter.use(requireAdmin);

/** EMAIL_TEST_ALLOWLIST as a clean list of lowercase addresses. */
function parseAllowlist(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => normaliseRecipient(entry))
    .filter((entry) => entry.includes("@"));
}

adminEmailRouter.get("/status", (_req, res) => {
  const mode = emailMode();
  const context = emailContextFromEnv();
  const sender = senderAddress();
  const webhookEnabled = secretUsable(env.EMAIL_WEBHOOK_SECRET);
  const unsubscribeDedicated = secretUsable(env.EMAIL_UNSUBSCRIBE_SECRET);
  const warnings: string[] = [];

  if (mode === "test") {
    warnings.push(
      env.NODE_ENV === "production"
        ? "Test mode is on in production: mail is recorded but never reaches an inbox."
        : "Test mode: mail is recorded and printed to the server console. Nothing leaves the process.",
    );
  }
  if (mode === "unconfigured") {
    warnings.push("No SMTP host is set, so every send fails. Set SMTP_HOST, or EMAIL_TEST_MODE for a dry run.");
  }
  if (!webhookEnabled) {
    warnings.push("The provider webhook is disabled (EMAIL_WEBHOOK_SECRET is missing or shorter than 32 characters). Bounces and complaints are not recorded.");
  }
  if (env.NODE_ENV === "production" && !unsubscribeDedicated) {
    warnings.push("EMAIL_UNSUBSCRIBE_SECRET is not set: unsubscribe links use a key derived from JWT_ACCESS_SECRET.");
  }

  res.json({
    mode,
    testMode: env.EMAIL_TEST_MODE,
    smtp: {
      hostConfigured: Boolean(env.SMTP_HOST),
      userConfigured: Boolean(env.SMTP_USER),
      passwordConfigured: Boolean(env.SMTP_PASS),
      secure: env.SMTP_SECURE,
    },
    sender: { name: sender.name, address: sender.address },
    replyToConfigured: Boolean(env.MAIL_REPLY_TO),
    contacts: {
      support: env.SUPPORT_EMAIL ?? null,
      security: env.SECURITY_EMAIL ?? null,
      updates: env.UPDATES_EMAIL ?? null,
    },
    webhook: { enabled: webhookEnabled, path: "/api/email/webhooks" },
    unsubscribe: { keySource: unsubscribeDedicated ? "dedicated" : "derived-from-jwt-secret" },
    testAllowlistCount: parseAllowlist(env.EMAIL_TEST_ALLOWLIST).length,
    appWebUrl: context.appUrl,
    dedupeWindowSeconds: DUPLICATE_WINDOW_MS / 1000,
    maxRetries: MAX_SEND_RETRIES,
    nodeEnv: env.NODE_ENV,
    warnings,
  });
});

const messagesQuery = z.object({
  status: z.enum(EMAIL_STATUSES).optional(),
  kind: z.string().trim().max(64).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

adminEmailRouter.get("/messages", async (req, res) => {
  const parsed = messagesQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid filter" });
    return;
  }
  const { status, kind, cursor, limit } = parsed.data;
  const rows = await prisma.emailMessage.findMany({
    where: { ...(status ? { status } : {}), ...(kind ? { kind } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      kind: true,
      category: true,
      transport: true,
      status: true,
      recipientMasked: true,
      subject: true,
      attempts: true,
      lastError: true,
      providerMessageId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  res.json({
    messages: page.map((row) => ({ ...row, lastError: redactErrorText(row.lastError) })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
});

adminEmailRouter.get("/stats", async (_req, res) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [byStatus, byKind] = await Promise.all([
    prisma.emailMessage.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.emailMessage.groupBy({
      by: ["kind"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { kind: "desc" } },
      take: 20,
    }),
  ]);
  const counts: Record<string, number> = Object.fromEntries(EMAIL_STATUSES.map((status) => [status, 0]));
  for (const row of byStatus) counts[row.status] = row._count._all;
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  res.json({
    windowDays: 7,
    since: since.toISOString(),
    total,
    byStatus: counts,
    byKind: byKind.map((row) => ({ kind: row.kind, count: row._count._all })),
  });
});

adminEmailRouter.get("/templates", (_req, res) => {
  res.json({ templates: templateCatalog() });
});

adminEmailRouter.get("/templates/:kind", (req, res) => {
  const kind = req.params.kind;
  if (!isEmailKind(kind)) {
    res.status(404).json({ error: "Unknown template" });
    return;
  }
  // Placeholder data only. The preview never shows a real account, code or token.
  const rendered = renderSample(kind, emailContextFromEnv());
  res.json({ kind, category: TEMPLATE_CATEGORY[kind], subject: rendered.subject, text: rendered.text, html: rendered.html, kinds: EMAIL_KINDS.length });
});

const testSendLimit = rateLimit({
  windowMs: 10 * 60_000,
  limit: 5,
  keyGenerator: accountOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many test emails. Wait a few minutes." },
});

const testSendSchema = z.object({
  to: z.string().trim().toLowerCase().min(3).max(254).email(),
  password: z.string().min(1).max(200),
});

adminEmailRouter.post("/test", requireCsrf, testSendLimit, async (req, res) => {
  const parsed = testSendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter the address to test and your password" });
    return;
  }
  if (!(await confirmCurrentPassword(req.user!.id, req.body?.password))) {
    res.status(403).json(PASSWORD_REQUIRED);
    return;
  }

  const admin = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { email: true, emailVerified: true } });
  const to = parsed.data.to;
  const ownVerifiedAddress = Boolean(admin?.emailVerified && admin.email && normaliseRecipient(admin.email) === to);
  const allowlisted = parseAllowlist(env.EMAIL_TEST_ALLOWLIST).includes(to);
  if (!ownVerifiedAddress && !allowlisted) {
    res.status(403).json({ error: "Test emails only go to your own verified address or to an address on the test allowlist." });
    return;
  }

  const result = await sendTemplateEmail(
    "service-notice",
    to,
    {
      title: "Nexus Forge Gaming test email",
      body: "This is a test of the email setup. If you received it, the sending path works. It does not prove the email reached an inbox.",
    },
    { userId: ownVerifiedAddress ? req.user!.id : null },
  );
  res.json({
    accepted: result.delivered,
    transport: result.transport,
    mode: emailMode(),
    suppressed: Boolean(result.suppressed),
    error: result.error ?? null,
  });
});
