import { Router } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { getLinkPreview, MAX_IMAGE_BYTES, safeFetch } from "../lib/link-preview.js";

/**
 * Link previews for chat. Pages are fetched by the server (never by the viewer's
 * browser), and preview images are served through a signed proxy so the linked site
 * never sees who is reading the chat.
 */
export const linkPreviewRouter = Router();

const signingKey = () => createHmac("sha256", env.JWT_ACCESS_SECRET).update("link-preview-images").digest();
function sign(url: string) {
  return createHmac("sha256", signingKey()).update(url).digest("base64url");
}

const recent = new Map<string, number[]>();
const PER_MINUTE = 60;
function allow(userId: string) {
  const now = Date.now();
  const hits = (recent.get(userId) ?? []).filter((at) => now - at < 60_000);
  if (hits.length >= PER_MINUTE) return false;
  hits.push(now);
  recent.set(userId, hits);
  return true;
}

linkPreviewRouter.get("/", requireAuth, async (req, res) => {
  const url = typeof req.query.url === "string" ? req.query.url.slice(0, 2048) : "";
  if (!/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: "A http(s) link is required" });
    return;
  }
  if (!allow(req.user!.id)) {
    res.status(429).json({ error: "Too many previews, slow down" });
    return;
  }
  const preview = await getLinkPreview(url);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.json({
    preview: preview
      ? { ...preview, image: preview.image ? `/api/link-preview/image?u=${encodeURIComponent(preview.image)}&s=${sign(preview.image)}` : null }
      : null,
  });
});

const imageTypes = /^image\/(png|jpe?g|gif|webp|avif)$/i;

linkPreviewRouter.get("/image", async (req, res) => {
  const url = typeof req.query.u === "string" ? req.query.u : "";
  const signature = typeof req.query.s === "string" ? req.query.s : "";
  const expected = sign(url);
  if (!url || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    res.status(403).end();
    return;
  }
  const result = await safeFetch(url, "image/png,image/jpeg,image/gif,image/webp,image/avif", MAX_IMAGE_BYTES);
  const type = result?.contentType.split(";")[0].trim() ?? "";
  if (!result || !imageTypes.test(type)) {
    res.status(404).end();
    return;
  }
  res.setHeader("Content-Type", type);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.end(result.body);
});
