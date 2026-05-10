import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { createUploadUrl, storageConfigured } from "../lib/storage.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";

const presignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(3).max(120),
  size: z.number().int().positive(),
});

export const uploadsRouter = Router();

uploadsRouter.use(requireAuth);
uploadsRouter.use(requireCsrf);

uploadsRouter.post("/presign", async (req, res) => {
  if (!storageConfigured()) {
    res.status(503).json({ error: "Storage is not configured" });
    return;
  }

  const parsed = presignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { premium: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const maxBytes = user.premium ? env.PREMIUM_UPLOAD_MAX_BYTES : env.UPLOAD_MAX_BYTES;
  if (parsed.data.size > maxBytes) {
    res.status(413).json({
      error: `File exceeds upload limit (${maxBytes} bytes)` ,
    });
    return;
  }

  const result = await createUploadUrl({
    userId: req.user!.id,
    filename: parsed.data.filename,
    contentType: parsed.data.contentType,
    maxBytes,
  });

  res.status(201).json(result);
});
