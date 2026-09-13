import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

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

export type StoredDocument = { relativePath: string; mime: string; bytes: number };

/** Decode a data URL or raw base64 payload, validate type and size, and write it under var/age-documents. */
export async function storeDocument(payload: string, purpose: "document" | "selfie"): Promise<StoredDocument> {
  const match = /^data:([a-z0-9.+/-]+);base64,(.+)$/i.exec(payload.trim());
  const mime = match ? match[1].toLowerCase() : "image/jpeg";
  const base64 = match ? match[2] : payload.trim();
  const ext = allowedMime[mime];
  if (!ext) {
    throw new Error("Upload a JPG, PNG, WEBP or PDF");
  }
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) throw new Error("The file is empty");
  if (buffer.length > MAX_DOCUMENT_BYTES) throw new Error("The file is larger than 8 MB");
  await fs.mkdir(ageDocumentDir, { recursive: true });
  const name = `${purpose}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(ageDocumentDir, name), buffer);
  return { relativePath: name, mime, bytes: buffer.length };
}

export function mimeForStoredPath(relativePath: string): string {
  const ext = relativePath.split(".").pop()?.toLowerCase();
  return Object.entries(allowedMime).find(([, value]) => value === ext)?.[0] ?? "application/octet-stream";
}

export async function readDocument(relativePath: string): Promise<Buffer> {
  const safe = path.basename(relativePath);
  return fs.readFile(path.join(ageDocumentDir, safe));
}

export async function deleteDocument(relativePath: string): Promise<void> {
  const safe = path.basename(relativePath);
  await fs.unlink(path.join(ageDocumentDir, safe)).catch(() => undefined);
}
