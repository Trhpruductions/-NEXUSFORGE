import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
});

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);
notificationsRouter.use(requireCsrf);

notificationsRouter.get("/", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: req.user!.id, read: false },
  });

  res.json({ notifications, unreadCount });
});

notificationsRouter.post("/read", async (req, res) => {
  const parsed = markReadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  await prisma.notification.updateMany({
    where: {
      userId: req.user!.id,
      ...(parsed.data.ids?.length ? { id: { in: parsed.data.ids } } : { read: false }),
    },
    data: { read: true },
  });

  res.status(200).json({ ok: true });
});

notificationsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.user!.id) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  await prisma.notification.delete({ where: { id: existing.id } });
  res.status(204).send();
});
