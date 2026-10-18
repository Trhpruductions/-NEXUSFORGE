import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
import { detectImageFormat } from "./image-validation.js";

/** Age verification helpers: age math, document storage on disk, and level resolution. */

export const MIN_AGE = 18;
export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;

const allowedMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Documents live outside the web root and are only streamed to admins. */
export const ageDocumentDir = fileURLToPath(new URL("../../../../var/age-documents/", import.meta.url));

/** Tests point storage at a temporary folder, so they never touch real documents. */
let documentDirOverride: string | null = null;
export function setAgeDocumentDirForTests(dir: string | null) {
  documentDirOverride = dir;
}
function documentDir() {
  return documentDirOverride ?? ageDocumentDir;
}

export function ageFromBirthdate(birthdate: Date, at: Date = new Date()): number {
  let age = at.getFullYear() - birthdate.getFullYear();
  const monthDiff = at.getMonth() - birthdate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < birthdate.getDate())) age -= 1;
  return age;
}

export function isAdult(birthdate: Date | null | undefined): boolean {
  return Boolean(birthdate) && ageFromBirthdate(birthdate as Date) >= MIN_AGE;
}

/** A plausible date of birth: a real date, at least 13 years ago, at most 120 years ago. */
export function parseBirthdate(raw: string): Date | null {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const age = ageFromBirthdate(parsed);
  if (age < 0 || age > 120) return null;
  return parsed;
}

// ---------------------------------------------------------------------------
// File type, from the file's own first bytes
// ---------------------------------------------------------------------------

/**
 * The real type of an uploaded document, read from its leading bytes: JPEG, PNG, WebP or PDF.
 * The type the browser claims (the data URL prefix) used to decide this, so any file could be
 * stored under an image name by labelling it image/jpeg.
 */
export function detectDocumentType(bytes: Buffer): { mime: string; ext: string } | null {
  const image = detectImageFormat(bytes);
  if (image === "jpeg") return { mime: "image/jpeg", ext: "jpg" };
  if (image === "png") return { mime: "image/png", ext: "png" };
  if (image === "webp") return { mime: "image/webp", ext: "webp" };
  if (bytes.length >= 5 && bytes.toString("latin1", 0, 5) === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  return null;
}

// ---------------------------------------------------------------------------
// Encryption at rest
//
// Every new document is written encrypted with AES-256-GCM: a random 12-byte IV per file and the
// 16-byte authentication tag stored with it, so a changed or damaged file fails to open instead of
// showing altered content. Stored layout:
//
//   "NFAGEDOC" (8 bytes)  version 0x01 (1 byte)  IV (12)  tag (16)  ciphertext
//
// The 9-byte header is also authenticated (as associated data). Files written before this have no
// header and are still read as they are (see readDocument); scripts/encrypt-age-documents.ts
// encrypts them in place.
//
// The key: AGE_DOCUMENT_ENCRYPTION_KEY when set (any string of 32+ characters), otherwise derived
// from JWT_REFRESH_SECRET. Either way it goes through HKDF with a label used for nothing else, so
// the JWT secret itself is never the encryption key. Rotating whichever secret is in use makes
// documents stored before the rotation unreadable, so set a dedicated key before rotating JWT keys.
// ---------------------------------------------------------------------------

const ENCRYPTED_MAGIC = Buffer.from("NFAGEDOC", "latin1");
const ENCRYPTED_VERSION = 0x01;
const HEADER_BYTES = ENCRYPTED_MAGIC.length + 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_LABEL = "nexusforge/age-documents/aes-256-gcm/v1";

function documentKey(): Buffer {
  const dedicated = process.env.AGE_DOCUMENT_ENCRYPTION_KEY?.trim();
  const material = dedicated && dedicated.length >= 32 ? dedicated : env.JWT_REFRESH_SECRET;
  return Buffer.from(crypto.hkdfSync("sha256", material, Buffer.alloc(0), KEY_LABEL, 32));
}

/** True when the bytes are in the encrypted format above (rather than an older, plain file). */
export function isEncryptedDocument(stored: Buffer): boolean {
  return stored.length >= HEADER_BYTES + IV_BYTES + TAG_BYTES && stored.subarray(0, ENCRYPTED_MAGIC.length).equals(ENCRYPTED_MAGIC);
}

export function encryptDocument(plain: Buffer): Buffer {
  const header = Buffer.concat([ENCRYPTED_MAGIC, Buffer.from([ENCRYPTED_VERSION])]);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", documentKey(), iv);
  cipher.setAAD(header);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([header, iv, cipher.getAuthTag(), body]);
}

/** Opens an encrypted document. Throws if it was altered, damaged or encrypted with another key. */
export function decryptDocument(stored: Buffer): Buffer {
  if (!isEncryptedDocument(stored)) throw new Error("Not an encrypted age document");
  const version = stored[ENCRYPTED_MAGIC.length];
  if (version !== ENCRYPTED_VERSION) throw new Error(`Unknown age document format version ${version}`);
  const header = stored.subarray(0, HEADER_BYTES);
  const iv = stored.subarray(HEADER_BYTES, HEADER_BYTES + IV_BYTES);
  const tag = stored.subarray(HEADER_BYTES + IV_BYTES, HEADER_BYTES + IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv("aes-256-gcm", documentKey(), iv);
  decipher.setAAD(header);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(stored.subarray(HEADER_BYTES + IV_BYTES + TAG_BYTES)), decipher.final()]);
}

// ---------------------------------------------------------------------------
// Storing, reading and deleting
// ---------------------------------------------------------------------------

/** An upload the person can fix (wrong type, too big, empty). Its message is safe to show them. */
export class DocumentRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentRejectedError";
  }
}

export type StoredDocument = { relativePath: string; mime: string; bytes: number };

/**
 * Decode a data URL or raw base64 payload, check its real type and size, and write it encrypted
 * under var/age-documents. A selfie must be a photo; the ID itself may also be a PDF.
 */
export async function storeDocument(payload: string, purpose: "document" | "selfie"): Promise<StoredDocument> {
  const trimmed = payload.trim();
  const match = /^data:([a-z0-9.+/-]+);base64,(.*)$/is.exec(trimmed);
  const base64 = (match ? match[2] : trimmed).replace(/\s+/g, "");
  if (!base64) throw new DocumentRejectedError("The file is empty");
  // Size is checked before decoding, so an oversized upload is never held twice in memory.
  if (Math.floor((base64.length * 3) / 4) > MAX_DOCUMENT_BYTES + 3) throw new DocumentRejectedError("The file is larger than 8 MB");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new DocumentRejectedError("Upload a JPG, PNG, WEBP or PDF");
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) throw new DocumentRejectedError("The file is empty");
  if (buffer.length > MAX_DOCUMENT_BYTES) throw new DocumentRejectedError("The file is larger than 8 MB");

  const type = detectDocumentType(buffer);
  if (!type) throw new DocumentRejectedError("Upload a JPG, PNG, WEBP or PDF");
  if (purpose === "selfie" && type.mime === "application/pdf") throw new DocumentRejectedError("The selfie must be a JPG, PNG or WEBP photo");
  // A claimed type may be missing or generic (browsers say octet-stream for unknown extensions),
  // but a specific one must agree with the bytes.
  const declared = match ? match[1].toLowerCase() : null;
  const declaredFits = !declared || declared === "application/octet-stream" || declared === type.mime || (declared === "image/jpg" && type.mime === "image/jpeg");
  if (!declaredFits) {
    throw new DocumentRejectedError("The file's contents don't match its type. Upload a JPG, PNG, WEBP or PDF");
  }

  const dir = documentDir();
  await fs.mkdir(dir, { recursive: true });
  const name = `${purpose}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${type.ext}`;
  // "wx": never overwrite an existing file.
  await fs.writeFile(path.join(dir, name), encryptDocument(buffer), { flag: "wx" });
  return { relativePath: name, mime: type.mime, bytes: buffer.length };
}

export function mimeForStoredPath(relativePath: string): string {
  const ext = relativePath.split(".").pop()?.toLowerCase();
  return Object.entries(allowedMime).find(([, value]) => value === ext)?.[0] ?? "application/octet-stream";
}

/**
 * Reads a stored document for a reviewer, decrypting it when it is in the encrypted format and
 * returning older plain files as they are. The type comes from the content itself; an older file
 * whose bytes aren't a known type is sent as a download (octet-stream), never as what its name says.
 */
export async function readDocument(relativePath: string): Promise<{ bytes: Buffer; mime: string }> {
  const safe = path.basename(relativePath);
  const stored = await fs.readFile(path.join(documentDir(), safe));
  const bytes = isEncryptedDocument(stored) ? decryptDocument(stored) : stored;
  return { bytes, mime: detectDocumentType(bytes)?.mime ?? "application/octet-stream" };
}

export async function deleteDocument(relativePath: string): Promise<void> {
  const safe = path.basename(relativePath);
  await fs.unlink(path.join(documentDir(), safe)).catch(() => undefined);
}

export type DocumentMigrationReport = { scanned: number; encrypted: number; alreadyEncrypted: number; skipped: number; failed: string[] };

/**
 * Encrypts, in place, every document in `dir` that is still stored in the clear (one-off clean-up
 * for files uploaded before encryption). With apply=false nothing is written: it only counts. Each
 * file is encrypted to a temporary file next to it, checked by decrypting it back, and then moved
 * over the original, so a crash part-way never leaves a half-written document. File contents are
 * never logged or returned; failures are reported by file name only.
 */
export async function encryptPlainDocuments(dir: string, options: { apply: boolean }): Promise<DocumentMigrationReport> {
  const report: DocumentMigrationReport = { scanned: 0, encrypted: 0, alreadyEncrypted: 0, skipped: 0, failed: [] };
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.includes(".tmp-")) {
      report.skipped += 1;
      continue;
    }
    report.scanned += 1;
    const full = path.join(dir, entry.name);
    try {
      const stored = await fs.readFile(full);
      if (isEncryptedDocument(stored)) {
        report.alreadyEncrypted += 1;
        continue;
      }
      if (!options.apply) {
        report.encrypted += 1;
        continue;
      }
      const sealed = encryptDocument(stored);
      if (!decryptDocument(sealed).equals(stored)) throw new Error("round-trip check failed");
      const temp = `${full}.tmp-${crypto.randomBytes(6).toString("hex")}`;
      await fs.writeFile(temp, sealed, { flag: "wx" });
      try {
        await fs.rename(temp, full);
      } catch (error) {
        await fs.unlink(temp).catch(() => undefined);
        throw error;
      }
      report.encrypted += 1;
    } catch {
      report.failed.push(entry.name);
    }
  }
  return report;
}
