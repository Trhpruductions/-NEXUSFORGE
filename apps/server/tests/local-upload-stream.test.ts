import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

// The env schema is read when config/env.ts loads: throwaway secrets, no real database, a temporary upload folder.
const uploadDir = await mkdtemp(join(tmpdir(), "nf-upload-test-"));
process.env.JWT_ACCESS_SECRET ??= randomBytes(32).toString("hex");
process.env.JWT_REFRESH_SECRET ??= randomBytes(32).toString("hex");
process.env.DATABASE_URL ??= "postgresql://localhost/unused";
process.env.UPLOAD_DIR = uploadDir;

const { writeLocalUploadStream, UploadTooLargeError, EmptyUploadError, localUploadPath } = await import("../src/lib/storage.js");

const exists = (key: string) => stat(localUploadPath(key)!).then(() => true, () => false);
/** A body that arrives in chunks, like a network upload. */
const chunks = (count: number, size: number) => Readable.from(Array.from({ length: count }, () => Buffer.alloc(size, 7)));

test.after(() => rm(uploadDir, { recursive: true, force: true }));

test("an upload within the limit is streamed to disk byte for byte", async () => {
  const written = await writeLocalUploadStream("user-a/ok.bin", chunks(4, 1000), 5000);
  assert.equal(written, 4000);
  assert.equal((await readFile(localUploadPath("user-a/ok.bin")!)).length, 4000);
});

test("an upload over the limit stops part-way and leaves no file behind", async () => {
  await assert.rejects(writeLocalUploadStream("user-a/big.bin", chunks(50, 1000), 5000), UploadTooLargeError);
  assert.equal(await exists("user-a/big.bin"), false);
});

test("an empty upload is refused and leaves no file", async () => {
  await assert.rejects(writeLocalUploadStream("user-a/empty.bin", Readable.from([]), 5000), EmptyUploadError);
  assert.equal(await exists("user-a/empty.bin"), false);
});

test("a replayed upload link can't overwrite or delete the file it already wrote", async () => {
  await writeLocalUploadStream("user-a/once.bin", chunks(1, 10), 100);
  await assert.rejects(writeLocalUploadStream("user-a/once.bin", chunks(1, 20), 100), (error: NodeJS.ErrnoException) => error.code === "EEXIST");
  assert.equal((await readFile(localUploadPath("user-a/once.bin")!)).length, 10);
});

test("a sender that gives up part-way leaves no partial file", async () => {
  const source = new Readable({ read() {} });
  const pending = writeLocalUploadStream("user-a/aborted.bin", source, 10_000);
  source.push(Buffer.alloc(500));
  setTimeout(() => source.destroy(new Error("client went away")), 20);
  await assert.rejects(pending);
  assert.equal(await exists("user-a/aborted.bin"), false);
});

test("keys that would escape the upload folder are refused", async () => {
  await assert.rejects(writeLocalUploadStream("../escape.bin", chunks(1, 10), 100), /Invalid upload key/);
});
