import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isAppToken, verifyAccessToken } from "../lib/jwt.js";
import { reportDiscordAlert } from "../lib/discord-bot.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { requireCsrf } from "../middleware/csrf.js";
import { accountOrIpKey } from "../middleware/rate-limit.js";
import { anonymousPerIpLimit } from "../middleware/anonymous-limit.js";

export const problemReportsRouter = Router();

const KINDS = ["BUG", "SIGN_IN", "BILLING", "SAFETY", "OTHER"] as const;
const KIND_LABEL: Record<(typeof KINDS)[number], string> = {
  BUG: "Something's broken",
  SIGN_IN: "Can't sign in",
  BILLING: "Payments",
  SAFETY: "Safety or abuse",
  OTHER: "Something else",
};

// Anyone can report (signed out too), but only a few times an hour.
const reportLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 6,
  keyGenerator: accountOrIpKey,
  standardHeaders: false,
  legacyHeaders: false,
  message: { error: "You've sent a few reports already. Please wait a bit before sending another." },
});

// Signed out: fewer reports per internet address (each one is stored and alerts staff on Discord), so a
// script can't flood the queue. Signed-in reports only use the per-account limit above.
export const ANONYMOUS_PROBLEM_REPORTS_PER_HOUR = 3;
const anonymousReportLimit = anonymousPerIpLimit({
  windowMs: 60 * 60 * 1000,
  limit: ANONYMOUS_PROBLEM_REPORTS_PER_HOUR,
  message: "You've sent a few reports already. Please wait a bit before sending another, or sign in to send more.",
});

const reportSchema = z.object({
  kind: z.enum(KINDS),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(2000),
  contactEmail: z.string().trim().email("That email doesn't look right.").max(254).optional().or(z.literal("")),
  pageUrl: z.string().max(300).optional(),
  /** Hidden field people never see; bots fill it in. */
  website: z.string().max(200).optional(),
});

/** Who's reporting, if they're signed in (the token is checked, not just read). */
function signedInUserId(header: string | undefined) {
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const payload = verifyAccessToken(header.slice(7));
    // A third-party app can't file reports in someone's name: its token counts as anonymous here.
    return isAppToken(payload) ? null : payload.sub ?? null;
  } catch {
    return null;
  }
}

/** "Report a problem" from the website. */
problemReportsRouter.post("/", reportLimit, anonymousReportLimit, async (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Please check the form." });
    return;
  }
  // Bots that fill the hidden field get a normal-looking answer and nothing is stored.
  if (parsed.data.website) {
    res.status(201).json({ ok: true });
    return;
  }
  const userId = signedInUserId(req.headers.authorization);
  let pageUrl: string | null = null;
  if (parsed.data.pageUrl) {
    try {
      const url = new URL(parsed.data.pageUrl, "https://x");
      pageUrl = url.pathname.slice(0, 300); // the page only, never the query string
    } catch {
      pageUrl = null;
    }
  }
  const report = await prisma.problemReport.create({
    data: {
      kind: parsed.data.kind,
      message: parsed.data.message,
      contactEmail: parsed.data.contactEmail ? parsed.data.contactEmail.toLowerCase() : null,
      pageUrl,
      userAgent: String(req.headers["user-agent"] ?? "").slice(0, 300) || null,
      userId,
    },
    select: { id: true },
  });
  reportDiscordAlert(`New problem report (${KIND_LABEL[parsed.data.kind]}): ${parsed.data.message.slice(0, 200)}`).catch(() => undefined);
  res.status(201).json({ ok: true, reference: report.id.slice(0, 8).toUpperCase() });
});

// Staff only from here.
problemReportsRouter.get("/", requireAuth, requireAdmin, async (req, res) => {
  const status = req.query.status === "RESOLVED" ? "RESOLVED" : req.query.status === "ALL" ? undefined : "OPEN";
  const [reports, open] = await Promise.all([
    prisma.problemReport.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { id: true, username: true, email: true } } },
    }),
    prisma.problemReport.count({ where: { status: "OPEN" } }),
  ]);
  res.json({ reports, open });
});

problemReportsRouter.patch("/:id", requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  const status = req.body?.status === "OPEN" ? "OPEN" : "RESOLVED";
  const updated = await prisma.problemReport.updateMany({
    where: { id: String(req.params.id) },
    data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null },
  });
  if (!updated.count) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json({ ok: true, status });
});
