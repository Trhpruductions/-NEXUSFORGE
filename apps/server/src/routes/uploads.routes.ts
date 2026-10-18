import express, { Router, type RequestHandler } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { cheapestTierWith, limitsFor, PLANS, upgradeRequired } from "../lib/plans.js";
import {
  createLocalUploadUrl,
  createUploadUrl,
  EmptyUploadError,
  LOCAL_UPLOAD_TYPES,
  storageConfigured,
  UploadTooLargeError,
  verifyLocalUploadToken,
  writeLocalUploadStream,
} from "../lib/storage.js";
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
  const parsed = presignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { premium: true, premiumTier: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const limits = limitsFor(user);
  const maxBytes = limits.uploadBytes;
  // Local storage behind https is capped by the proxy (see the proxy branch below). A plan that is only
  // allowed above that cap cannot be delivered, so the upgrade offer and the message use the deliverable size.
  const deliverableCap = !storageConfigured() && /^https:/i.test(env.API_PUBLIC_URL ?? "") ? env.LOCAL_UPLOAD_PROXY_MAX_BYTES : Number.POSITIVE_INFINITY;
  const deliverable = (bytes: number) => Math.min(bytes, deliverableCap);
  if (parsed.data.size > maxBytes) {
    const mb = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;
    const biggest = PLANS.INFINITE.uploadBytes;
    // A bigger plan would allow it: offer the upgrade. Otherwise it's just too big.
    if (limits.enforced && parsed.data.size <= biggest) {
      res.status(402).json(upgradeRequired(`Files can be up to ${mb(deliverable(maxBytes))} on your plan.`, "UPLOAD_SIZE", cheapestTierWith((plan) => deliverable(plan.uploadBytes) >= parsed.data.size)));
      return;
    }
    res.status(413).json({ error: `Files can be up to ${mb(deliverable(maxBytes))}.` });
    return;
  }

  if (!storageConfigured()) {
    // Self-hosted fallback: store on this machine (see lib/storage.ts).
    if (!LOCAL_UPLOAD_TYPES.has(parsed.data.contentType)) {
      res.status(415).json({ error: "That file type can't be uploaded. Use an image, video, audio, PDF or text file." });
      return;
    }
    // Behind the public tunnel every upload passes through Cloudflare, which drops bodies over
    // 100 MB before they reach us. Say so here, in plain words, instead of letting the browser
    // hit an HTML error page mid-upload. Direct-to-bucket uploads (S3/R2) don't have this cap.
    const throughProxy = /^https:/i.test(env.API_PUBLIC_URL ?? "");
    const proxyCap = Math.min(maxBytes, env.LOCAL_UPLOAD_PROXY_MAX_BYTES);
    if (throughProxy && parsed.data.size > proxyCap) {
      res.status(413).json({
        error: `Files over ${Math.round(proxyCap / (1024 * 1024))} MB can't be uploaded yet. Our hosting caps single uploads at ${Math.round(env.LOCAL_UPLOAD_PROXY_MAX_BYTES / (1024 * 1024))} MB during the beta; bigger uploads come with the storage upgrade.`,
        code: "UPLOAD_PROXY_LIMIT",
      });
      return;
    }
    res.status(201).json(createLocalUploadUrl({ userId: req.user!.id, filename: parsed.data.filename, contentType: parsed.data.contentType, maxBytes: throughProxy ? proxyCap : maxBytes }));
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

/**
 * Receives the bytes for a local presigned upload. Mounted in index.ts ahead of the JSON
 * parser and the auth/CSRF middleware: like an S3 presigned PUT, the token is the
 * credential, and the browser sends the raw file body.
 *
 * The link is checked before a single byte is read, and the body is streamed to disk with a hard cap, so a
 * request without a valid link costs nothing and no upload is ever held in memory. (It used to read the whole
 * body, up to the largest plan's limit, into memory before checking the link: an easy way to exhaust memory.)
 */
export const localUploadPutHandler: RequestHandler[] = [
  async (req, res) => {
    const claims = typeof req.query.token === "string" ? verifyLocalUploadToken(req.query.token) : null;
    if (!claims) {
      res.status(403).json({ error: "Upload link is invalid or has expired." });
      return;
    }
    const contentType = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
    if (contentType !== claims.contentType) {
      res.status(400).json({ error: "Content type doesn't match the upload link." });
      return;
    }
    const declared = Number(req.headers["content-length"]);
    if (Number.isFinite(declared) && (declared > claims.maxBytes || declared === 0)) {
      res.status(413).json({ error: "File is empty or larger than allowed." });
      return;
    }
    try {
      await writeLocalUploadStream(claims.key, req, claims.maxBytes);
    } catch (error) {
      if (error instanceof UploadTooLargeError || error instanceof EmptyUploadError) {
        if (!res.headersSent) res.status(413).json({ error: "File is empty or larger than allowed." });
        return;
      }
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        res.status(409).json({ error: "This upload link was already used." });
        return;
      }
      // The sender gave up part-way: the partial file is already gone and there is nobody to answer.
      if (req.destroyed || (error as NodeJS.ErrnoException).code === "ERR_STREAM_PREMATURE_CLOSE") return;
      throw error;
    }
    res.status(200).end();
  },
];

/** Serves locally stored uploads, sandboxed so nothing uploaded can run as this origin. */
export const localUploadsStatic: RequestHandler[] = [
  (_req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(env.UPLOAD_DIR, {
    fallthrough: false,
    index: false,
    dotfiles: "deny",
    maxAge: "7d",
    immutable: true,
    setHeaders: (res, filePath) => {
      // Only inert media types are accepted at upload; still, never let a browser render
      // anything else inline.
      if (!/\.(png|jpe?g|gif|webp|avif|mp4|webm|mov|mp3|ogg|wav|pdf|txt)$/i.test(filePath)) {
        res.setHeader("Content-Disposition", "attachment");
      }
    },
  }),
];
