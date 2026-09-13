import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { createNotification } from "../lib/notifications.js";
import { deleteDocument, isAdult, mimeForStoredPath, readDocument } from "../lib/age-verification.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { requireAdmin } from "../middleware/admin.js";

/** Admin review queue for ID-based age verification. Mounted at /api/admin/age-verification. */
export const adminAgeRouter = Router();

adminAgeRouter.use(requireAuth);
adminAgeRouter.use(requireAdmin);

const decisionSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

const listSelect = {
  id: true,
  status: true,
  documentType: true,
  declaredBirthdate: true,
  submittedAt: true,
  reviewedAt: true,
  rejectionReason: true,
  selfiePath: true,
  user: { select: { id: true, username: true, email: true, avatar: true, birthdate: true, ageVerificationLevel: true, createdAt: true } },
  reviewer: { select: { id: true, username: true } },
} as const;

adminAgeRouter.get("/", async (req, res) => {
  const status = req.query.status === "APPROVED" || req.query.status === "REJECTED" ? req.query.status : "PENDING";
  const [items, counts] = await Promise.all([
    prisma.ageVerification.findMany({ where: { status }, orderBy: { submittedAt: status === "PENDING" ? "asc" : "desc" }, take: 100, select: listSelect }),
    prisma.ageVerification.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  res.json({
    items: items.map((item) => ({ ...item, hasSelfie: Boolean(item.selfiePath), selfiePath: undefined })),
    counts: Object.fromEntries(counts.map((entry) => [entry.status, entry._count._all])),
  });
});

/** Streams the stored document or selfie to the reviewing admin. Never linked publicly. */
adminAgeRouter.get("/:id/file/:kind", async (req, res) => {
  const record = await prisma.ageVerification.findUnique({ where: { id: req.params.id }, select: { documentPath: true, selfiePath: true } });
  const relative = req.params.kind === "selfie" ? record?.selfiePath : record?.documentPath;
  if (!record || !relative) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  try {
    const buffer = await readDocument(relative);
    res.setHeader("Content-Type", mimeForStoredPath(relative));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", "inline");
    res.send(buffer);
  } catch {
    res.status(404).json({ error: "File missing on disk" });
  }
});

adminAgeRouter.post("/:id/approve", requireCsrf, async (req, res) => {
  const record = await prisma.ageVerification.findUnique({ where: { id: req.params.id }, include: { user: { select: { id: true, username: true } } } });
  if (!record) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }
  if (record.status !== "PENDING") {
    res.status(400).json({ error: "This submission was already reviewed" });
    return;
  }
  if (!isAdult(record.declaredBirthdate)) {
    res.status(400).json({ error: "The declared date of birth is under 18; reject instead" });
    return;
  }

  await prisma.$transaction([
    prisma.ageVerification.update({ where: { id: record.id }, data: { status: "APPROVED", reviewedAt: new Date(), reviewerId: req.user!.id } }),
    prisma.user.update({
      where: { id: record.userId },
      data: { birthdate: record.declaredBirthdate, ageVerified: true, ageVerificationLevel: "VERIFIED", ageVerifiedAt: new Date() },
    }),
  ]);
  // The document has done its job; do not keep identity files longer than needed.
  await deleteDocument(record.documentPath);
  if (record.selfiePath) await deleteDocument(record.selfiePath);

  void createNotification({
    userId: record.userId,
    type: "SYSTEM",
    title: "Age verified",
    body: "Your ID was approved. Your account now carries the Verified 18+ badge.",
    data: { ageVerification: "approved" },
  }).catch(() => undefined);

  res.json({ ok: true });
});

adminAgeRouter.post("/:id/reject", requireCsrf, async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }
  const record = await prisma.ageVerification.findUnique({ where: { id: req.params.id } });
  if (!record) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }
  if (record.status !== "PENDING") {
    res.status(400).json({ error: "This submission was already reviewed" });
    return;
  }
  const reason = parsed.data.reason || "The document could not be verified. Submit a clearer photo of a valid government ID.";
  await prisma.ageVerification.update({ where: { id: record.id }, data: { status: "REJECTED", reviewedAt: new Date(), reviewerId: req.user!.id, rejectionReason: reason } });
  await deleteDocument(record.documentPath);
  if (record.selfiePath) await deleteDocument(record.selfiePath);

  void createNotification({
    userId: record.userId,
    type: "SYSTEM",
    title: "Age verification needs another try",
    body: reason,
    data: { ageVerification: "rejected" },
  }).catch(() => undefined);

  res.json({ ok: true });
});
