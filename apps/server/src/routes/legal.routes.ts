import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { canApply, canManageLegal, canPublishLegal, defaultConsentText, findPlaceholders, nextStatus } from "../lib/legal-rules.js";
import { currentRequiredPolicies, logLegal, pendingConsentsFor, recordAcceptances } from "../lib/legal-policies.js";

/**
 * Legal Center. Public routes only ever return PUBLISHED (current) and ARCHIVED
 * (historical) text; drafts stay internal. Admin routes check roles on the server.
 */
export const legalRouter = Router();

const publicVersionSelect = { id: true, version: true, status: true, content: true, changeSummary: true, effectiveAt: true, publishedAt: true, requiresConsent: true, consentText: true } as const;

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

legalRouter.get("/policies", async (_req, res) => {
  const policies = await prisma.legalPolicy.findMany({
    orderBy: { sortOrder: "asc" },
    include: { versions: { where: { status: "PUBLISHED" }, orderBy: { version: "desc" }, take: 1, select: { version: true, effectiveAt: true, publishedAt: true } } },
  });
  res.json({
    policies: policies.map((policy) => ({
      slug: policy.slug,
      title: policy.title,
      summary: policy.summary,
      requiredAtSignup: policy.requiredAtSignup,
      published: policy.versions[0] ?? null,
    })),
  });
});

legalRouter.get("/policies/:slug", async (req, res) => {
  const policy = await prisma.legalPolicy.findUnique({ where: { slug: req.params.slug } });
  if (!policy) {
    res.status(404).json({ error: "Policy not found" });
    return;
  }
  const requested = typeof req.query.version === "string" && /^\d+$/.test(req.query.version) ? Number(req.query.version) : null;
  const version = await prisma.legalPolicyVersion.findFirst({
    where: { policyId: policy.id, ...(requested ? { version: requested, status: { in: ["PUBLISHED", "ARCHIVED"] }, publishedAt: { not: null } } : { status: "PUBLISHED" }) },
    orderBy: { version: "desc" },
    select: publicVersionSelect,
  });
  const history = await prisma.legalPolicyVersion.findMany({
    where: { policyId: policy.id, publishedAt: { not: null } },
    orderBy: { version: "desc" },
    select: { version: true, status: true, effectiveAt: true, publishedAt: true, changeSummary: true },
  });
  res.json({
    policy: { slug: policy.slug, title: policy.title, summary: policy.summary, requiredAtSignup: policy.requiredAtSignup },
    // null = not published yet; the page says so plainly instead of showing a draft.
    version,
    history,
  });
});

/** What sign-up must ask for (current published versions + the exact wording). */
legalRouter.get("/required", async (_req, res) => {
  res.json({ policies: await currentRequiredPolicies() });
});

// ---------------------------------------------------------------------------
// Signed-in user: consent status and renewal
// ---------------------------------------------------------------------------

legalRouter.get("/me/pending", requireAuth, async (req, res) => {
  res.json({ pending: await pendingConsentsFor(req.user!.id) });
});

legalRouter.get("/me/acceptances", requireAuth, async (req, res) => {
  const acceptances = await prisma.policyAcceptance.findMany({
    where: { userId: req.user!.id },
    orderBy: { acceptedAt: "desc" },
    select: { policySlug: true, version: true, consentText: true, source: true, acceptedAt: true },
  });
  res.json({ acceptances });
});

const acceptSchema = z.object({ versionIds: z.array(z.string().uuid()).min(1).max(20) });

legalRouter.post("/me/accept", requireAuth, requireCsrf, async (req, res) => {
  const parsed = acceptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Nothing to accept" });
    return;
  }
  // Only versions that are actually current and published can be accepted.
  const current = await currentRequiredPolicies();
  const currentIds = new Set(current.map((policy) => policy.versionId));
  const valid = parsed.data.versionIds.filter((id) => currentIds.has(id));
  if (!valid.length) {
    res.status(400).json({ error: "Those policy versions aren't current. Reload and try again." });
    return;
  }
  await recordAcceptances(req.user!.id, valid, "RENEWAL");
  res.json({ ok: true, pending: await pendingConsentsFor(req.user!.id) });
});

// ---------------------------------------------------------------------------
// Legal administration
// ---------------------------------------------------------------------------

async function legalAdmin(req: Request, res: Response, need: "manage" | "publish" = "manage") {
  const me = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { isAdmin: true, appRole: true } });
  const ok = me && (need === "publish" ? canPublishLegal(me) : canManageLegal(me));
  if (!ok) {
    res.status(403).json({ error: need === "publish" ? "Only owners and executives can publish legal documents" : "Legal administrators only" });
    return null;
  }
  return me;
}

const admin = Router();
admin.use(requireAuth, requireCsrf);

admin.get("/policies", async (req, res) => {
  const me = await legalAdmin(req, res);
  if (!me) return;
  const policies = await prisma.legalPolicy.findMany({
    orderBy: { sortOrder: "asc" },
    include: { versions: { orderBy: { version: "desc" }, select: { id: true, version: true, status: true, changeSummary: true, effectiveAt: true, publishedAt: true, requiresConsent: true, createdById: true, createdAt: true, updatedAt: true, restoredFromId: true } } },
  });
  res.json({ policies, canPublish: canPublishLegal(me) });
});

admin.get("/versions/:id", async (req, res) => {
  if (!(await legalAdmin(req, res))) return;
  const version = await prisma.legalPolicyVersion.findUnique({ where: { id: req.params.id }, include: { policy: { select: { slug: true, title: true } } } });
  if (!version) {
    res.status(404).json({ error: "Version not found" });
    return;
  }
  res.json({ version, placeholders: findPlaceholders(version.content), acceptanceCount: await prisma.policyAcceptance.count({ where: { policyVersionId: version.id } }) });
});

const draftSchema = z.object({
  content: z.string().min(20).max(200_000).optional(),
  changeSummary: z.string().trim().max(2000).optional(),
});

/** New draft: blank-from-latest by default (copies the newest version's text). */
admin.post("/policies/:slug/versions", async (req, res) => {
  const parsed = draftSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  if (!(await legalAdmin(req, res))) return;
  const policy = await prisma.legalPolicy.findUnique({ where: { slug: req.params.slug } });
  if (!policy) {
    res.status(404).json({ error: "Policy not found" });
    return;
  }
  const openDraft = await prisma.legalPolicyVersion.findFirst({ where: { policyId: policy.id, status: { in: ["DRAFT", "IN_REVIEW"] } }, select: { version: true } });
  if (openDraft) {
    res.status(409).json({ error: `Version ${openDraft.version} is still a draft or in review. Finish or archive it first.` });
    return;
  }
  const latest = await prisma.legalPolicyVersion.findFirst({ where: { policyId: policy.id }, orderBy: { version: "desc" } });
  const number = (latest?.version ?? 0) + 1;
  const version = await prisma.legalPolicyVersion.create({
    data: {
      policyId: policy.id,
      version: number,
      status: "DRAFT",
      content: parsed.data.content ?? latest?.content ?? `# ${policy.title}\n\n`,
      changeSummary: parsed.data.changeSummary ?? null,
      consentText: defaultConsentText(policy.title, number),
      createdById: req.user!.id,
    },
  });
  await logLegal(req.user!.id, "version.create", policy.slug, version.id, number);
  res.status(201).json({ version });
});

const editSchema = z
  .object({
    content: z.string().min(20).max(200_000).optional(),
    changeSummary: z.string().trim().max(2000).nullable().optional(),
    requiresConsent: z.boolean().optional(),
    consentText: z.string().trim().min(10).max(500).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No changes supplied." });

admin.patch("/versions/:id", async (req, res) => {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  if (!(await legalAdmin(req, res))) return;
  const existing = await prisma.legalPolicyVersion.findUnique({ where: { id: req.params.id }, include: { policy: { select: { slug: true } } } });
  if (!existing) {
    res.status(404).json({ error: "Version not found" });
    return;
  }
  if (!canApply("edit", existing.status)) {
    res.status(409).json({ error: existing.status === "IN_REVIEW" ? "Send it back to draft before editing." : "Published and archived versions can't be edited. Create a new version instead." });
    return;
  }
  const version = await prisma.legalPolicyVersion.update({ where: { id: existing.id }, data: parsed.data });
  await logLegal(req.user!.id, "version.edit", existing.policy.slug, existing.id, existing.version, { fields: Object.keys(parsed.data) });
  res.json({ version, placeholders: findPlaceholders(version.content) });
});

const transitionSchema = z.object({
  action: z.enum(["submit", "return", "publish", "archive", "restore"]),
  /** Publishing: must be true, sent from the confirmation step. */
  confirm: z.boolean().optional(),
  effectiveAt: z.string().datetime().optional(),
  requiresConsent: z.boolean().optional(),
});

admin.post("/versions/:id/transition", async (req, res) => {
  const parsed = transitionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }
  const { action } = parsed.data;
  if (!(await legalAdmin(req, res, action === "publish" || action === "archive" ? "publish" : "manage"))) return;
  const existing = await prisma.legalPolicyVersion.findUnique({ where: { id: req.params.id }, include: { policy: true } });
  if (!existing) {
    res.status(404).json({ error: "Version not found" });
    return;
  }
  // Archiving a draft is just discarding it; withdrawing a published policy is the
  // publish-level action checked above.
  if (!canApply(action, existing.status)) {
    res.status(409).json({ error: `Can't ${action} a version that is ${existing.status.toLowerCase().replace("_", " ")}.` });
    return;
  }

  if (action === "restore") {
    const openDraft = await prisma.legalPolicyVersion.findFirst({ where: { policyId: existing.policyId, status: { in: ["DRAFT", "IN_REVIEW"] } }, select: { version: true } });
    if (openDraft) {
      res.status(409).json({ error: `Version ${openDraft.version} is still a draft or in review. Finish or archive it first.` });
      return;
    }
    const latest = await prisma.legalPolicyVersion.findFirst({ where: { policyId: existing.policyId }, orderBy: { version: "desc" }, select: { version: true } });
    const number = (latest?.version ?? 0) + 1;
    const version = await prisma.legalPolicyVersion.create({
      data: {
        policyId: existing.policyId,
        version: number,
        status: "DRAFT",
        content: existing.content,
        changeSummary: `Restored from version ${existing.version}.`,
        consentText: defaultConsentText(existing.policy.title, number),
        createdById: req.user!.id,
        restoredFromId: existing.id,
      },
    });
    await logLegal(req.user!.id, "version.restore", existing.policy.slug, version.id, number, { from: existing.version });
    res.status(201).json({ version });
    return;
  }

  if (action === "publish") {
    if (parsed.data.confirm !== true) {
      res.status(400).json({ error: "Confirm before publishing", needsConfirm: true });
      return;
    }
    const placeholders = findPlaceholders(existing.content);
    if (placeholders.length) {
      res.status(400).json({ error: `Fill in every placeholder first: ${placeholders.slice(0, 6).join(", ")}${placeholders.length > 6 ? "…" : ""}`, placeholders });
      return;
    }
    const previous = await prisma.legalPolicyVersion.findFirst({ where: { policyId: existing.policyId, status: "PUBLISHED" }, select: { id: true, version: true } });
    // The first version of a sign-up policy always needs consent; later ones only for material changes.
    const requiresConsent = existing.policy.requiredAtSignup && (!previous || (parsed.data.requiresConsent ?? existing.requiresConsent));
    const now = new Date();
    const [, version] = await prisma.$transaction([
      prisma.legalPolicyVersion.updateMany({ where: { policyId: existing.policyId, status: "PUBLISHED" }, data: { status: "ARCHIVED", archivedAt: now } }),
      prisma.legalPolicyVersion.update({
        where: { id: existing.id },
        data: {
          status: "PUBLISHED",
          publishedAt: now,
          publishedById: req.user!.id,
          effectiveAt: parsed.data.effectiveAt ? new Date(parsed.data.effectiveAt) : now,
          requiresConsent,
          consentText: existing.consentText ?? defaultConsentText(existing.policy.title, existing.version),
        },
      }),
    ]);
    await logLegal(req.user!.id, "version.publish", existing.policy.slug, existing.id, existing.version, { replaced: previous?.version ?? null, requiresConsent });
    res.json({ version, replaced: previous?.version ?? null });
    return;
  }

  const status = nextStatus(action)!;
  const version = await prisma.legalPolicyVersion.update({
    where: { id: existing.id },
    data: { status, ...(status === "ARCHIVED" ? { archivedAt: new Date() } : {}) },
  });
  await logLegal(req.user!.id, `version.${action}`, existing.policy.slug, existing.id, existing.version, { from: existing.status });
  res.json({ version });
});

admin.get("/audit", async (req, res) => {
  if (!(await legalAdmin(req, res))) return;
  const slug = typeof req.query.slug === "string" ? req.query.slug : undefined;
  const entries = await prisma.legalAuditEntry.findMany({ where: slug ? { policySlug: slug } : {}, orderBy: { createdAt: "desc" }, take: 200 });
  const actorIds = [...new Set(entries.map((entry) => entry.actorId).filter((id) => id !== "system"))];
  const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, username: true } });
  const nameOf = new Map(actors.map((actor) => [actor.id, actor.username] as const));
  res.json({ entries: entries.map((entry) => ({ ...entry, actorName: entry.actorId === "system" ? "System" : nameOf.get(entry.actorId) ?? "Deleted user" })) });
});

legalRouter.use("/admin", admin);
