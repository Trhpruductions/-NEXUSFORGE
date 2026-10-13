/**
 * "What's new": release notes from Vexora staff. Everyone sees a published update once,
 * as a popup (people online when it's published get it straight away).
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getIo } from "../lib/realtime.js";
import { hasAdminAccess } from "../lib/app-roles.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

export const updatesRouter = Router();
updatesRouter.use(requireAuth);
updatesRouter.use(requireCsrf);

const updateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(1).max(5000),
  version: z.string().trim().max(24).optional().nullable(),
});
const publicSelect = { id: true, title: true, body: true, version: true, publishedAt: true } as const;

async function staffOnly(req: Request, res: Response) {
  const me = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { appRole: true, isAdmin: true } });
  if (!me || !hasAdminAccess(me.appRole, me.isAdmin)) {
    res.status(403).json({ error: "Staff only" });
    return false;
  }
  return true;
}

/** When this person last caught up: their last seen update, or when they joined. */
async function seenSince(userId: string) {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { lastSeenUpdateAt: true, createdAt: true } });
  return me?.lastSeenUpdateAt ?? me?.createdAt ?? new Date();
}

/** Published updates, newest first, and which are new to me. */
updatesRouter.get("/", async (req, res) => {
  const since = await seenSince(req.user!.id);
  const updates = await prisma.appUpdate.findMany({ where: { publishedAt: { not: null } }, orderBy: { publishedAt: "desc" }, take: 50, select: publicSelect });
  res.json({ updates: updates.map((update) => ({ ...update, unseen: Boolean(update.publishedAt && update.publishedAt > since) })) });
});

/** Updates published since I last looked (for the popup). */
updatesRouter.get("/unseen", async (req, res) => {
  const since = await seenSince(req.user!.id);
  const updates = await prisma.appUpdate.findMany({ where: { publishedAt: { gt: since } }, orderBy: { publishedAt: "desc" }, take: 5, select: publicSelect });
  res.json({ updates });
});

/** "Got it": everything published so far counts as seen. */
updatesRouter.post("/seen", async (req, res) => {
  await prisma.user.update({ where: { id: req.user!.id }, data: { lastSeenUpdateAt: new Date() } });
  res.json({ ok: true });
});

// ---------------------------------------------------------------- staff
updatesRouter.get("/admin", async (req, res) => {
  if (!(await staffOnly(req, res))) return;
  const updates = await prisma.appUpdate.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  res.json({ updates });
});

updatesRouter.post("/admin", async (req, res) => {
  if (!(await staffOnly(req, res))) return;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid update" });
    return;
  }
  const update = await prisma.appUpdate.create({ data: { ...parsed.data, version: parsed.data.version || null, createdById: req.user!.id } });
  res.status(201).json({ update });
});

updatesRouter.patch("/admin/:id", async (req, res) => {
  if (!(await staffOnly(req, res))) return;
  const parsed = updateSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid update" });
    return;
  }
  const existing = await prisma.appUpdate.findUnique({ where: { id: String(req.params.id) }, select: { id: true } });
  if (!existing) {
    res.status(404).json({ error: "Update not found" });
    return;
  }
  const update = await prisma.appUpdate.update({ where: { id: existing.id }, data: { ...parsed.data, ...(parsed.data.version !== undefined ? { version: parsed.data.version || null } : {}) } });
  res.json({ update });
});

/** Publish: it pops up for everyone, right away for anyone online. */
updatesRouter.post("/admin/:id/publish", async (req, res) => {
  if (!(await staffOnly(req, res))) return;
  const existing = await prisma.appUpdate.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) {
    res.status(404).json({ error: "Update not found" });
    return;
  }
  if (existing.publishedAt) {
    res.status(400).json({ error: "Already published" });
    return;
  }
  const update = await prisma.appUpdate.update({ where: { id: existing.id }, data: { publishedAt: new Date() }, select: publicSelect });
  try {
    getIo().emit("updates:new", { id: update.id, title: update.title });
  } catch {
    /* realtime not running */
  }
  res.json({ update });
});

updatesRouter.delete("/admin/:id", async (req, res) => {
  if (!(await staffOnly(req, res))) return;
  await prisma.appUpdate.deleteMany({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});
