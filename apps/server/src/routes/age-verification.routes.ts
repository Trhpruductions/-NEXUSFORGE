import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { createNotification } from "../lib/notifications.js";
import { ageFromBirthdate, deleteDocument, isAdult, MIN_AGE, parseBirthdate, storeDocument } from "../lib/age-verification.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { authRateLimit } from "../middleware/rate-limit.js";

/**
 * Age verification for the signed-in user.
 *
 *   NONE      no usable date of birth on file
 *   ATTESTED  the user declared a date of birth that makes them 18+
 *   VERIFIED  an admin approved a government ID that matches the declared date of birth
 */
export const ageVerificationRouter = Router();

ageVerificationRouter.use(requireAuth);
ageVerificationRouter.use(requireCsrf);

const attestSchema = z.object({
  birthdate: z.string().min(8).max(32),
  confirm: z.literal(true),
});

const submitSchema = z.object({
  documentType: z.enum(["DRIVERS_LICENSE", "PASSPORT", "NATIONAL_ID", "OTHER"]),
  document: z.string().min(32),
  selfie: z.string().min(32).optional(),
  birthdate: z.string().min(8).max(32).optional(),
});

const userSelect = {
  id: true,
  birthdate: true,
  ageVerified: true,
  ageVerificationLevel: true,
  ageVerifiedAt: true,
} as const;

export async function ageSummary(userId: string) {
  const [user, latest] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: userSelect }),
    prisma.ageVerification.findFirst({
      where: { userId },
      orderBy: { submittedAt: "desc" },
      select: { id: true, status: true, documentType: true, submittedAt: true, reviewedAt: true, rejectionReason: true },
    }),
  ]);
  if (!user) return null;
  return {
    level: user.ageVerificationLevel,
    birthdate: user.birthdate ? user.birthdate.toISOString().slice(0, 10) : null,
    age: user.birthdate ? ageFromBirthdate(user.birthdate) : null,
    isAdult: isAdult(user.birthdate),
    verifiedAt: user.ageVerifiedAt,
    review: latest,
    minimumAge: MIN_AGE,
  };
}

ageVerificationRouter.get("/", async (req, res) => {
  const summary = await ageSummary(req.user!.id);
  if (!summary) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(summary);
});

/** Step 1: declare a date of birth. Under-18 dates are refused and the account is flagged. */
ageVerificationRouter.post("/attest", authRateLimit, async (req, res) => {
  const parsed = attestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter your date of birth and confirm it is accurate" });
    return;
  }
  const birthdate = parseBirthdate(parsed.data.birthdate);
  if (!birthdate) {
    res.status(400).json({ error: "Enter a valid date of birth" });
    return;
  }

  const current = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { ageVerificationLevel: true } });
  if (current?.ageVerificationLevel === "VERIFIED") {
    res.status(400).json({ error: "Your age is already verified with ID and cannot be changed here" });
    return;
  }

  if (!isAdult(birthdate)) {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { birthdate, ageVerified: false, ageVerificationLevel: "NONE", ageVerifiedAt: null, status: "OFFLINE" },
    });
    // Sign the account out everywhere: minors may not use the platform.
    await prisma.refreshToken.updateMany({ where: { userId: req.user!.id, revokedAt: null }, data: { revokedAt: new Date() } });
    res.status(403).json({ error: `You must be at least ${MIN_AGE} to use Vexora Gaming.`, underage: true });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { birthdate, ageVerified: true, ageVerificationLevel: "ATTESTED", ageVerifiedAt: new Date() },
    select: userSelect,
  });
  res.json({ ok: true, summary: await ageSummary(user.id) });
});

/** Step 2: submit a government ID (and optional selfie) for admin review. */
ageVerificationRouter.post("/submit", authRateLimit, async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a document type and attach the document image" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: userSelect });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.ageVerificationLevel === "VERIFIED") {
    res.status(400).json({ error: "Your age is already verified" });
    return;
  }

  const declared = parsed.data.birthdate ? parseBirthdate(parsed.data.birthdate) : user.birthdate;
  if (!declared) {
    res.status(400).json({ error: "Enter your date of birth first" });
    return;
  }
  if (!isAdult(declared)) {
    res.status(403).json({ error: `You must be at least ${MIN_AGE} to use Vexora Gaming.`, underage: true });
    return;
  }

  const pending = await prisma.ageVerification.findFirst({ where: { userId: user.id, status: "PENDING" }, select: { id: true } });
  if (pending) {
    res.status(409).json({ error: "You already have a submission waiting for review" });
    return;
  }

  let document;
  let selfie;
  try {
    document = await storeDocument(parsed.data.document, "document");
    selfie = parsed.data.selfie ? await storeDocument(parsed.data.selfie, "selfie") : null;
  } catch (error) {
    if (document) await deleteDocument(document.relativePath);
    res.status(400).json({ error: error instanceof Error ? error.message : "Upload failed" });
    return;
  }

  const record = await prisma.$transaction(async (tx) => {
    if (user.birthdate?.getTime() !== declared.getTime()) {
      await tx.user.update({ where: { id: user.id }, data: { birthdate: declared, ageVerified: true, ageVerificationLevel: user.ageVerificationLevel === "NONE" ? "ATTESTED" : user.ageVerificationLevel } });
    }
    return tx.ageVerification.create({
      data: {
        userId: user.id,
        documentType: parsed.data.documentType,
        documentPath: document.relativePath,
        selfiePath: selfie?.relativePath,
        declaredBirthdate: declared,
      },
      select: { id: true, status: true, documentType: true, submittedAt: true },
    });
  });

  res.status(201).json({ ok: true, submission: record, summary: await ageSummary(user.id) });
});

/** Withdraw a pending submission (removes the stored files). */
ageVerificationRouter.delete("/submit", async (req, res) => {
  const pending = await prisma.ageVerification.findFirst({ where: { userId: req.user!.id, status: "PENDING" } });
  if (!pending) {
    res.status(404).json({ error: "No pending submission" });
    return;
  }
  await prisma.ageVerification.delete({ where: { id: pending.id } });
  await deleteDocument(pending.documentPath);
  if (pending.selfiePath) await deleteDocument(pending.selfiePath);
  res.json({ ok: true, summary: await ageSummary(req.user!.id) });
});

export { createNotification };
