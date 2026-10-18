import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import { once } from "node:events";
import { createDecipheriv, hkdfSync, randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { env } from "../src/config/env.js";
import { signAccessToken } from "../src/lib/jwt.js";
import { prisma } from "../src/lib/prisma.js";
import {
  decryptDocument,
  detectDocumentType,
  DocumentRejectedError,
  encryptDocument,
  encryptPlainDocuments,
  isEncryptedDocument,
  readDocument,
  setAgeDocumentDirForTests,
  storeDocument,
} from "../src/lib/age-verification.js";
import { ageVerificationRouter } from "../src/routes/age-verification.routes.js";
import { adminAgeRouter } from "../src/routes/admin-age.routes.js";
import { assertNotLiveDatabase } from "./helpers/live-database-guard.js";

// ID documents for age verification: real type from the bytes, encrypted at rest, decrypted only for
// reviewers, older plain files still readable, and a migration that encrypts them in place. Every
// file here is a generated fixture in a temporary folder; no real document is ever opened. Writes
// test users and submissions (removed afterwards), so it must never run against the live database.
assertNotLiveDatabase();

const RUN = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const CSRF = randomBytes(16).toString("hex");
const savedKey = process.env.AGE_DOCUMENT_ENCRYPTION_KEY;
let dir = "";
const createdUsers: string[] = [];

// Fixtures: the right leading bytes followed by random filler.
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`fixture-jpeg-${RUN}`), randomBytes(200)]);
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(200)]);
const webp = () => Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x10, 0, 0, 0]), Buffer.from("WEBP"), randomBytes(200)]);
const pdf = () => Buffer.concat([Buffer.from("%PDF-1.7\n"), randomBytes(200)]);
const html = () => Buffer.from("<html><body><script>alert(document.cookie)</script></body></html>");
const gif = () => Buffer.concat([Buffer.from("GIF89a"), randomBytes(50)]);
const dataUrl = (mime: string, bytes: Buffer) => `data:${mime};base64,${bytes.toString("base64")}`;

const app = express();
app.use(express.json({ limit: "12mb" }));
app.use(cookieParser());
app.use("/api/age-verification", ageVerificationRouter);
app.use("/api/admin/age-verification", adminAgeRouter);
const server = app.listen(0, "127.0.0.1");

before(async () => {
  if (!server.listening) await once(server, "listening");
  delete process.env.AGE_DOCUMENT_ENCRYPTION_KEY;
  dir = await mkdtemp(path.join(tmpdir(), "nf-age-docs-test-"));
  setAgeDocumentDirForTests(dir);
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
  await prisma.$disconnect();
  setAgeDocumentDirForTests(null);
  if (savedKey === undefined) delete process.env.AGE_DOCUMENT_ENCRYPTION_KEY;
  else process.env.AGE_DOCUMENT_ENCRYPTION_KEY = savedKey;
  if (dir) await rm(dir, { recursive: true, force: true });
});

async function makeUser(role: "USER" | "ADMIN" = "USER") {
  const id = randomUUID();
  const tag = `ad_${id.slice(0, 8)}_${RUN}`.slice(0, 32);
  await prisma.user.create({
    data: { id, username: tag, email: `${tag}@example.com`, password: "not-a-login-in-this-test", birthdate: new Date("1990-01-01"), ageVerified: true, ageVerificationLevel: "ATTESTED", appRole: role },
  });
  createdUsers.push(id);
  return { id, token: signAccessToken({ sub: id, username: tag, email: `${tag}@example.com`, jti: randomUUID() }) };
}

async function request(method: string, urlPath: string, token: string, body?: unknown) {
  const { port } = server.address() as AddressInfo;
  return fetch(`http://127.0.0.1:${port}${urlPath}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, Cookie: `nf_csrf=${CSRF}`, "x-csrf-token": CSRF },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test("the file type comes from the bytes", () => {
  assert.equal(detectDocumentType(jpeg())?.mime, "image/jpeg");
  assert.equal(detectDocumentType(png())?.mime, "image/png");
  assert.equal(detectDocumentType(webp())?.mime, "image/webp");
  assert.equal(detectDocumentType(pdf())?.mime, "application/pdf");
  assert.equal(detectDocumentType(html()), null);
  assert.equal(detectDocumentType(gif()), null);
});

test("a stored document is encrypted on disk and reads back exactly", async () => {
  const original = jpeg();
  const stored = await storeDocument(dataUrl("image/jpeg", original), "document");
  assert.equal(stored.mime, "image/jpeg");
  assert.match(stored.relativePath, /^document-\d+-[0-9a-f]{16}\.jpg$/);

  const onDisk = await readFile(path.join(dir, stored.relativePath));
  assert.ok(isEncryptedDocument(onDisk));
  assert.equal(onDisk.subarray(0, 8).toString("latin1"), "NFAGEDOC");
  assert.equal(onDisk.indexOf(Buffer.from(`fixture-jpeg-${RUN}`)), -1, "the plain bytes must not be on disk");

  const back = await readDocument(stored.relativePath);
  assert.ok(back.bytes.equals(original));
  assert.equal(back.mime, "image/jpeg");

  // Raw base64 without a data URL prefix works too, typed from the bytes.
  const raw = await storeDocument(pdf().toString("base64"), "document");
  assert.equal(raw.mime, "application/pdf");
});

test("every file gets its own IV, and a changed byte is caught", async () => {
  const original = png();
  const a = encryptDocument(original);
  const b = encryptDocument(original);
  assert.ok(!a.equals(b));
  assert.ok(decryptDocument(a).equals(original));

  const tampered = Buffer.from(a);
  tampered[tampered.length - 1] ^= 0x01;
  assert.throws(() => decryptDocument(tampered));

  const stored = await storeDocument(dataUrl("image/png", original), "selfie");
  const file = path.join(dir, stored.relativePath);
  const bytes = await readFile(file);
  bytes[bytes.length - 5] ^= 0xff;
  await writeFile(file, bytes);
  await assert.rejects(readDocument(stored.relativePath));
});

test("the key is derived with its own label, never the JWT secret itself", () => {
  const sealed = encryptDocument(webp());
  const iv = sealed.subarray(9, 21);
  const tag = sealed.subarray(21, 37);
  const open = (key: Buffer) => {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(sealed.subarray(0, 9));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(sealed.subarray(37)), decipher.final()]);
  };
  const derived = Buffer.from(hkdfSync("sha256", env.JWT_REFRESH_SECRET, Buffer.alloc(0), "nexusforge/age-documents/aes-256-gcm/v1", 32));
  assert.doesNotThrow(() => open(derived));
  const rawSecret = Buffer.alloc(32);
  Buffer.from(env.JWT_REFRESH_SECRET).copy(rawSecret);
  assert.throws(() => open(rawSecret));

  // A dedicated key, when set, is used instead (and documents sealed with it need it to open).
  process.env.AGE_DOCUMENT_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  const withDedicated = encryptDocument(webp());
  delete process.env.AGE_DOCUMENT_ENCRYPTION_KEY;
  assert.throws(() => decryptDocument(withDedicated));
});

test("uploads are refused when the bytes aren't an allowed type or don't match the claim", async () => {
  const cases: Array<[string, Promise<unknown>]> = [
    ["html labelled as a jpeg", storeDocument(dataUrl("image/jpeg", html()), "document")],
    ["gif", storeDocument(dataUrl("image/gif", gif()), "document")],
    ["jpeg labelled as png", storeDocument(dataUrl("image/png", jpeg()), "document")],
    ["pdf as a selfie", storeDocument(dataUrl("application/pdf", pdf()), "selfie")],
    ["empty", storeDocument("data:image/jpeg;base64,", "document")],
    ["not base64", storeDocument("data:image/jpeg;base64,@@@@####", "document")],
    ["over 8 MB", storeDocument(dataUrl("image/jpeg", Buffer.concat([jpeg(), Buffer.alloc(8 * 1024 * 1024)])), "document")],
  ];
  for (const [label, attempt] of cases) {
    await assert.rejects(attempt, (error: unknown) => error instanceof DocumentRejectedError, label);
  }
});

test("older plain files still open, typed from their bytes rather than their name", async () => {
  const legacyJpeg = jpeg();
  await writeFile(path.join(dir, "document-1-legacy.jpg"), legacyJpeg);
  const back = await readDocument("document-1-legacy.jpg");
  assert.ok(back.bytes.equals(legacyJpeg));
  assert.equal(back.mime, "image/jpeg");

  // An old upload that was never checked: whatever its name says, it is not served as an image.
  await writeFile(path.join(dir, "document-2-legacy.jpg"), html());
  assert.equal((await readDocument("document-2-legacy.jpg")).mime, "application/octet-stream");
});

test("the migration counts in dry-run mode and encrypts in place with --apply", async () => {
  const folder = await mkdtemp(path.join(tmpdir(), "nf-age-migrate-test-"));
  try {
    const plainA = jpeg();
    const plainB = pdf();
    await writeFile(path.join(folder, "document-a.jpg"), plainA);
    await writeFile(path.join(folder, "document-b.pdf"), plainB);
    await writeFile(path.join(folder, "document-c.png"), encryptDocument(png()));
    await mkdir(path.join(folder, "subfolder"));

    const dry = await encryptPlainDocuments(folder, { apply: false });
    assert.deepEqual(dry, { scanned: 3, encrypted: 2, alreadyEncrypted: 1, skipped: 1, failed: [] });
    assert.ok((await readFile(path.join(folder, "document-a.jpg"))).equals(plainA), "a dry run writes nothing");

    const applied = await encryptPlainDocuments(folder, { apply: true });
    assert.deepEqual(applied, { scanned: 3, encrypted: 2, alreadyEncrypted: 1, skipped: 1, failed: [] });
    for (const [name, plain] of [["document-a.jpg", plainA], ["document-b.pdf", plainB]] as const) {
      const sealed = await readFile(path.join(folder, name));
      assert.ok(isEncryptedDocument(sealed), name);
      assert.ok(decryptDocument(sealed).equals(plain), name);
    }
    assert.deepEqual((await readdir(folder)).filter((name) => name.includes(".tmp-")), [], "no temporary files left behind");

    const again = await encryptPlainDocuments(folder, { apply: true });
    assert.equal(again.encrypted, 0);
    assert.equal(again.alreadyEncrypted, 3);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test("submitting an ID stores it encrypted; a disguised file is refused with a plain message", async () => {
  const user = await makeUser();
  const original = png();
  const accepted = await request("POST", "/api/age-verification/submit", user.token, { documentType: "PASSPORT", document: dataUrl("image/png", original) });
  assert.equal(accepted.status, 201);
  const record = await prisma.ageVerification.findFirstOrThrow({ where: { userId: user.id } });
  const sealed = await readFile(path.join(dir, record.documentPath));
  assert.ok(isEncryptedDocument(sealed));
  assert.ok(decryptDocument(sealed).equals(original));

  const other = await makeUser();
  const refused = await request("POST", "/api/age-verification/submit", other.token, { documentType: "PASSPORT", document: dataUrl("image/jpeg", html()) });
  assert.equal(refused.status, 400);
  assert.equal(((await refused.json()) as { error: string }).error, "Upload a JPG, PNG, WEBP or PDF");
  assert.equal(await prisma.ageVerification.count({ where: { userId: other.id } }), 0);
});

test("reviewers get the decrypted file, never cached; others and decided submissions get nothing", async () => {
  const subject = await makeUser();
  const reviewer = await makeUser("ADMIN");
  const original = jpeg();
  const selfie = webp();
  const document = await storeDocument(dataUrl("image/jpeg", original), "document");
  const selfieFile = await storeDocument(dataUrl("image/webp", selfie), "selfie");
  const submission = await prisma.ageVerification.create({
    data: { userId: subject.id, documentType: "DRIVERS_LICENSE", documentPath: document.relativePath, selfiePath: selfieFile.relativePath, declaredBirthdate: new Date("1990-01-01") },
  });

  const opened = await request("GET", `/api/admin/age-verification/${submission.id}/file/document`, reviewer.token);
  assert.equal(opened.status, 200);
  assert.equal(opened.headers.get("content-type"), "image/jpeg");
  assert.match(opened.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(opened.headers.get("x-content-type-options"), "nosniff");
  assert.ok(Buffer.from(await opened.arrayBuffer()).equals(original));

  const openedSelfie = await request("GET", `/api/admin/age-verification/${submission.id}/file/selfie`, reviewer.token);
  assert.equal(openedSelfie.status, 200);
  assert.equal(openedSelfie.headers.get("content-type"), "image/webp");
  assert.ok(Buffer.from(await openedSelfie.arrayBuffer()).equals(selfie));

  // Not a reviewer.
  assert.equal((await request("GET", `/api/admin/age-verification/${submission.id}/file/document`, subject.token)).status, 403);
  // Not a file kind.
  assert.equal((await request("GET", `/api/admin/age-verification/${submission.id}/file/other`, reviewer.token)).status, 404);
  // Decided: the file stays closed even if it is still on disk.
  await prisma.ageVerification.update({ where: { id: submission.id }, data: { status: "APPROVED" } });
  assert.equal((await request("GET", `/api/admin/age-verification/${submission.id}/file/document`, reviewer.token)).status, 404);
});
