/**
 * Encryption for backup copies that leave this PC. AES-256-GCM, streamed, so a large dump never sits in memory.
 *
 * File layout: "NFGBK1" (6 bytes) | IV (12 bytes) | ciphertext | auth tag (16 bytes).
 * The tag at the end means a copy that was cut short or changed in transit fails to decrypt instead of
 * restoring garbage.
 *
 * The key is 32 random bytes, given as base64 in BACKUP_ENCRYPTION_KEY. Make one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 * Keep a copy of the key somewhere other than this PC (a password manager): without it the off-site copies
 * can't be restored, and if this PC is lost the copy on this PC is lost with it.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";

const MAGIC = Buffer.from("NFGBK1");
const IV_BYTES = 12;
const TAG_BYTES = 16;

export function backupKey(raw = process.env.BACKUP_ENCRYPTION_KEY) {
  if (!raw) throw new Error("BACKUP_ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return key;
}

export async function encryptFile(source, target, key) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const partial = `${target}.partial`;
  const out = fs.createWriteStream(partial);
  out.write(Buffer.concat([MAGIC, iv]));
  await pipeline(fs.createReadStream(source), cipher, out, { end: false }).catch(async (error) => {
    out.destroy();
    await fs.promises.rm(partial, { force: true });
    throw error;
  });
  await new Promise((resolve, reject) => out.end(cipher.getAuthTag(), (error) => (error ? reject(error) : resolve())));
  // Only a complete file gets the real name, so an interrupted copy is never mistaken for a good one.
  await fs.promises.rename(partial, target);
}

export async function decryptFile(source, target, key) {
  const { size } = await fs.promises.stat(source);
  if (size < MAGIC.length + IV_BYTES + TAG_BYTES) throw new Error("not a backup file (too short)");
  const handle = await fs.promises.open(source, "r");
  const header = Buffer.alloc(MAGIC.length + IV_BYTES);
  const tag = Buffer.alloc(TAG_BYTES);
  try {
    await handle.read(header, 0, header.length, 0);
    await handle.read(tag, 0, TAG_BYTES, size - TAG_BYTES);
  } finally {
    await handle.close();
  }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("not an encrypted Nexus Forge backup");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, header.subarray(MAGIC.length));
  decipher.setAuthTag(tag);
  const partial = `${target}.partial`;
  try {
    // The tag is checked when the stream finishes; on a mismatch the partial output is deleted below.
    await pipeline(fs.createReadStream(source, { start: header.length, end: size - TAG_BYTES - 1 }), decipher, fs.createWriteStream(partial));
  } catch (error) {
    await fs.promises.rm(partial, { force: true });
    throw new Error(`decryption failed (wrong key, or the file is damaged): ${error.message}`);
  }
  await fs.promises.rename(partial, target);
}
