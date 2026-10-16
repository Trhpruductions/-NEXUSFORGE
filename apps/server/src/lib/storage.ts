import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { S3Client, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";

const canUseStorage =
  Boolean(env.S3_BUCKET_NAME) && Boolean(env.S3_ACCESS_KEY_ID) && Boolean(env.S3_SECRET_ACCESS_KEY);

const s3Client = canUseStorage
  ? new S3Client({
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: Boolean(env.S3_ENDPOINT),
      // S3-compatible stores such as Cloudflare R2 reject the SDK's newer default checksum
      // headers on presigned PUTs; only add checksums when an operation requires them.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    })
  : null;

export function storageConfigured(): boolean {
  return Boolean(s3Client && env.S3_BUCKET_NAME);
}

// ---------------------------------------------------------------------------
// Local-disk fallback, used when S3 isn't configured (a self-hosted install).
//
// The browser flow stays the same as S3: presign -> PUT the bytes to uploadUrl -> use
// fileUrl. uploadUrl points back at this API with a short-lived HMAC token bound to the
// key, content type and size limit, so only the presigned upload can be written.
//
// Files are served from the API's own origin, which also holds the auth cookies. An
// uploaded HTML/SVG page would run script there, so only inert media types are accepted
// and everything is served with a sandboxing CSP (see routes/uploads.routes.ts).
// ---------------------------------------------------------------------------

export const LOCAL_UPLOAD_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "application/pdf",
  "text/plain",
]);

const LOCAL_TOKEN_TTL_MS = 5 * 60 * 1000;

function localSigningKey() {
  // Derived, so it never equals the JWT secret itself.
  return createHmac("sha256", env.JWT_ACCESS_SECRET).update("vexora-local-uploads").digest();
}

function apiBaseUrl() {
  return (env.API_PUBLIC_URL ?? `http://127.0.0.1:${env.PORT}`).replace(/\/$/, "");
}

type LocalUploadClaims = { key: string; contentType: string; maxBytes: number; exp: number };

function signLocal(claims: LocalUploadClaims) {
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = createHmac("sha256", localSigningKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyLocalUploadToken(token: string): LocalUploadClaims | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", localSigningKey()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LocalUploadClaims;
    return claims.exp > Date.now() ? claims : null;
  } catch {
    return null;
  }
}

/** Absolute path for a stored key, or null if the key would escape UPLOAD_DIR. */
export function localUploadPath(key: string) {
  const root = resolve(env.UPLOAD_DIR);
  const full = resolve(root, key);
  return full.startsWith(root + sep) ? full : null;
}

export function createLocalUploadUrl(input: { userId: string; filename: string; contentType: string; maxBytes: number }) {
  const safeFileName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  const key = `${input.userId}/${Date.now()}-${randomUUID()}-${safeFileName}`;
  const token = signLocal({ key, contentType: input.contentType, maxBytes: input.maxBytes, exp: Date.now() + LOCAL_TOKEN_TTL_MS });
  return {
    key,
    uploadUrl: `${apiBaseUrl()}/api/uploads/local?token=${encodeURIComponent(token)}`,
    fileUrl: `${apiBaseUrl()}/uploads/${key.split("/").map(encodeURIComponent).join("/")}`,
  };
}

export async function writeLocalUpload(key: string, bytes: Buffer) {
  const full = localUploadPath(key);
  if (!full) throw new Error("Invalid upload key");
  await mkdir(dirname(full), { recursive: true });
  // "wx": a presigned key is written once; a replayed token can't overwrite the file.
  await writeFile(full, bytes, { flag: "wx" });
}

export async function createUploadUrl(input: {
  userId: string;
  filename: string;
  contentType: string;
  maxBytes: number;
}): Promise<{ key: string; uploadUrl: string; fileUrl: string }> {
  if (!s3Client || !env.S3_BUCKET_NAME) {
    throw new Error("Storage is not configured");
  }

  const safeFileName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `uploads/${input.userId}/${Date.now()}-${randomUUID()}-${safeFileName}`;

  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
    ContentType: input.contentType,
    Metadata: {
      uploader: input.userId,
      maxBytes: String(input.maxBytes),
    },
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 * 5 });

  const fileUrl = env.S3_PUBLIC_BASE_URL
    ? `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`
    : env.S3_ENDPOINT
      ? `${env.S3_ENDPOINT.replace(/\/$/, "")}/${env.S3_BUCKET_NAME}/${key}`
      : `https://${env.S3_BUCKET_NAME}.s3.${env.S3_REGION}.amazonaws.com/${key}`;

  return { key, uploadUrl, fileUrl };
}

/**
 * True for a file that came from our own upload storage (local /uploads or the
 * configured S3 bucket). Used where the app shows an image inline to other people, so a
 * link can't be used as a tracking pixel.
 */
export function isOwnUploadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const local = new URL(apiBaseUrl());
    if (parsed.origin === local.origin && parsed.pathname.startsWith("/uploads/")) return true;
    if (env.S3_PUBLIC_BASE_URL && url.startsWith(`${env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/`)) return true;
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Profile pictures (avatar and banner)
//
// The server receives the bytes (after lib/image-validation.ts has checked and cleaned them)
// and writes them with the same storage as other uploads: S3 when configured, otherwise the
// local disk. Every file is under profiles/<userId>/, which is the only place this module will
// delete from, so a replacement can never remove another user's files or chat attachments.
// ---------------------------------------------------------------------------

export type StoredFile = { key: string; url: string };

export function profileImagePrefix(userId: string) {
  return `profiles/${userId}/`;
}

function localUrlForKey(key: string) {
  return `${apiBaseUrl()}/uploads/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function publicUrlForKey(key: string) {
  if (env.S3_PUBLIC_BASE_URL) return `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  if (env.S3_ENDPOINT) return `${env.S3_ENDPOINT.replace(/\/$/, "")}/${env.S3_BUCKET_NAME}/${key}`;
  return `https://${env.S3_BUCKET_NAME}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
}

/** Writes already-validated picture bytes under a fresh, unguessable key. */
export async function storeProfileImage(input: { userId: string; kind: "avatar" | "banner"; bytes: Buffer; ext: string; mime: string }): Promise<StoredFile> {
  const key = `${profileImagePrefix(input.userId)}${input.kind}-${Date.now()}-${randomUUID()}.${input.ext}`;
  if (s3Client && env.S3_BUCKET_NAME) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: key,
        Body: input.bytes,
        ContentType: input.mime,
        ContentLength: input.bytes.length,
        CacheControl: "public, max-age=604800, immutable",
        Metadata: { uploader: input.userId },
      }),
    );
    return { key, url: publicUrlForKey(key) };
  }
  await writeLocalUpload(key, input.bytes);
  return { key, url: localUrlForKey(key) };
}

/**
 * The storage key behind a picture URL, but only when the URL is ours and the key is under this
 * user's profile prefix. Anything else (other users' files, outside links, legacy uploads) gives null.
 */
export function ownedProfileImageKey(url: string, userId: string): string | null {
  let key: string | null = null;
  try {
    const parsed = new URL(url);
    const local = new URL(apiBaseUrl());
    if (parsed.origin === local.origin && parsed.pathname.startsWith("/uploads/")) {
      key = decodeURIComponent(parsed.pathname.slice("/uploads/".length));
    }
  } catch {
    return null;
  }
  if (key === null && env.S3_PUBLIC_BASE_URL) {
    const base = `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/`;
    if (url.startsWith(base)) key = url.slice(base.length);
  }
  if (!key || !key.startsWith(profileImagePrefix(userId))) return null;
  if (key.split("/").some((part) => part === "" || part === "." || part === "..") || /[\\\0]/.test(key)) return null;
  return key;
}

/** Deletes a stored file. A file that is already gone counts as deleted. */
export async function deleteStoredFile(key: string): Promise<void> {
  if (s3Client && env.S3_BUCKET_NAME) {
    await s3Client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET_NAME, Key: key }));
    return;
  }
  const full = localUploadPath(key);
  if (!full) throw new Error("Invalid upload key");
  await unlink(full).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

export type SwapStoredImageOptions = {
  /** Writes the new file. Leave out to clear the picture. */
  write?: () => Promise<StoredFile>;
  /**
   * Points the database row at the new URL (or null) in one write and returns the URL it held
   * before. Throwing here means the row did not change.
   */
  commit: (url: string | null) => Promise<string | null>;
  /** Maps the previous URL to a deletable key, or null if the file must be left alone. */
  keyForOwnedUrl: (url: string) => string | null;
  remove?: (key: string) => Promise<void>;
  onCleanupError?: (error: unknown, key: string) => void;
};

/**
 * Replaces (or clears) a profile picture in this order, so a failure never loses the current one:
 *   1. write the new file (if this fails, nothing has changed);
 *   2. commit the new URL to the database (if this fails, delete the new file and keep the old);
 *   3. delete the previous file (if this fails, the old file is only orphaned, so just report it).
 */
export async function swapStoredImage(options: SwapStoredImageOptions): Promise<{ url: string | null; removedKey: string | null }> {
  const remove = options.remove ?? deleteStoredFile;
  const report = options.onCleanupError ?? (() => undefined);

  const created = options.write ? await options.write() : null;

  let previousUrl: string | null;
  try {
    previousUrl = await options.commit(created ? created.url : null);
  } catch (error) {
    if (created) await remove(created.key).catch((cleanupError: unknown) => report(cleanupError, created.key));
    throw error;
  }

  const previousKey = previousUrl ? options.keyForOwnedUrl(previousUrl) : null;
  const removedKey = previousKey && previousKey !== created?.key ? previousKey : null;
  if (removedKey) {
    await remove(removedKey).catch((cleanupError: unknown) => report(cleanupError, removedKey));
  }
  return { url: created ? created.url : null, removedKey };
}

/* Server (forge) pictures: the icon and banner shown for a community server. They are checked by
   lib/image-validation.ts before they get here, and stored under their own prefix. */

export function forgeImagePrefix(forgeId: string) {
  return `forges/${forgeId}/`;
}

/** Writes already-validated server picture bytes under a fresh, unguessable key. */
export async function storeForgeImage(input: { forgeId: string; kind: "icon" | "banner"; bytes: Buffer; ext: string; mime: string }): Promise<StoredFile> {
  const key = `${forgeImagePrefix(input.forgeId)}${input.kind}-${Date.now()}-${randomUUID()}.${input.ext}`;
  if (s3Client && env.S3_BUCKET_NAME) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: key,
        Body: input.bytes,
        ContentType: input.mime,
        ContentLength: input.bytes.length,
        CacheControl: "public, max-age=604800, immutable",
        Metadata: { forge: input.forgeId },
      }),
    );
    return { key, url: publicUrlForKey(key) };
  }
  await writeLocalUpload(key, input.bytes);
  return { key, url: localUrlForKey(key) };
}

/**
 * The storage key behind a server picture URL, but only when the URL is one of our uploads and the
 * key is under this server's prefix. Anything else (outside links, other servers' files) gives null.
 */
export function ownedForgeImageKey(url: string, forgeId: string): string | null {
  let key: string | null = null;
  try {
    const parsed = new URL(url);
    const local = new URL(apiBaseUrl());
    if (parsed.origin === local.origin && parsed.pathname.startsWith("/uploads/")) {
      key = decodeURIComponent(parsed.pathname.slice("/uploads/".length));
    }
  } catch {
    return null;
  }
  if (key === null && env.S3_PUBLIC_BASE_URL) {
    const base = `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/`;
    if (url.startsWith(base)) key = url.slice(base.length);
  }
  if (!key || !key.startsWith(forgeImagePrefix(forgeId))) return null;
  if (key.split("/").some((part) => part === "" || part === "." || part === "..") || /[\\\0]/.test(key)) return null;
  return key;
}
