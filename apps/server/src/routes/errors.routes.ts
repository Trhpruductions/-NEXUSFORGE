import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { recordError } from "../lib/error-log.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { requireCsrf } from "../middleware/csrf.js";
import { accountOrIpKey } from "../middleware/rate-limit.js";
import { anonymousPerIpLimit } from "../middleware/anonymous-limit.js";

export const errorsRouter = Router();

// Anyone's browser can report a crash (signed out too), but only a few an hour.
const reportLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: accountOrIpKey,
  standardHeaders: false,
  legacyHeaders: false,
  message: { error: "Too many error reports." },
});

// Signed-out browsers get a smaller budget per internet address, so made-up reports from scripts can't fill
// the error log (a real page sends at most ten per page load). Signed-in reports only use the limit above.
export const ANONYMOUS_ERROR_REPORTS_PER_15_MIN = 10;
const anonymousReportLimit = anonymousPerIpLimit({
  windowMs: 15 * 60 * 1000,
  limit: ANONYMOUS_ERROR_REPORTS_PER_15_MIN,
  message: "Too many error reports.",
});

const reportSchema = z.object({
  message: z.string().min(1).max(1000),
  stack: z.string().max(8000).optional().nullable(),
  path: z.string().max(500).optional().nullable(),
});

/** A crash in someone's browser. Answers 204 either way; nothing to show the person. */
errorsRouter.post("/client", reportLimit, anonymousReportLimit, async (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (parsed.success) {
    await recordError({ source: "web", message: parsed.data.message, stack: parsed.data.stack, path: parsed.data.path });
  }
  res.status(204).end();
});

// Staff only from here.
errorsRouter.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const [errors, total] = await Promise.all([
    prisma.errorEvent.findMany({ orderBy: { lastSeenAt: "desc" }, take: 200 }),
    prisma.errorEvent.count(),
  ]);
  res.json({ errors, total });
});

/** Mark a problem fixed (it comes back as new if it happens again). */
errorsRouter.delete("/:id", requireAuth, requireAdmin, requireCsrf, async (req, res) => {
  await prisma.errorEvent.deleteMany({ where: { id: String(req.params.id) } });
  res.status(204).end();
});

errorsRouter.delete("/", requireAuth, requireAdmin, requireCsrf, async (_req, res) => {
  const { count } = await prisma.errorEvent.deleteMany({});
  res.json({ cleared: count });
});
