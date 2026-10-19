import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { backupKey, decryptFile, encryptFile } from "./backup-crypto.mjs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nfg-backup-crypto-"));
const key = crypto.randomBytes(32);
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

test("a file survives encrypt then decrypt unchanged, and the encrypted copy is not readable", async () => {
  const original = path.join(dir, "db.dump");
  const data = crypto.randomBytes(3 * 1024 * 1024 + 17); // bigger than one stream chunk
  fs.writeFileSync(original, data);
  await encryptFile(original, path.join(dir, "db.dump.enc"), key);
  const encrypted = fs.readFileSync(path.join(dir, "db.dump.enc"));
  assert.equal(encrypted.subarray(0, 6).toString(), "NFGBK1");
  assert.equal(encrypted.length, data.length + 6 + 12 + 16);
  assert.equal(encrypted.indexOf(data.subarray(0, 64)), -1);
  await decryptFile(path.join(dir, "db.dump.enc"), path.join(dir, "db.restored"), key);
  assert.ok(fs.readFileSync(path.join(dir, "db.restored")).equals(data));
  assert.ok(!fs.existsSync(path.join(dir, "db.dump.enc.partial")));
});

test("the wrong key, a changed byte or a cut-short file fails and leaves no output", async () => {
  const original = path.join(dir, "small.dump");
  fs.writeFileSync(original, "hello backup");
  await encryptFile(original, path.join(dir, "small.enc"), key);
  await assert.rejects(decryptFile(path.join(dir, "small.enc"), path.join(dir, "out1"), crypto.randomBytes(32)), /decryption failed/);
  assert.ok(!fs.existsSync(path.join(dir, "out1")) && !fs.existsSync(path.join(dir, "out1.partial")));

  const tampered = Buffer.from(fs.readFileSync(path.join(dir, "small.enc")));
  tampered[20] ^= 0xff;
  fs.writeFileSync(path.join(dir, "tampered.enc"), tampered);
  await assert.rejects(decryptFile(path.join(dir, "tampered.enc"), path.join(dir, "out2"), key), /decryption failed/);
  assert.ok(!fs.existsSync(path.join(dir, "out2")));

  const whole = fs.readFileSync(path.join(dir, "small.enc"));
  fs.writeFileSync(path.join(dir, "short.enc"), whole.subarray(0, whole.length - 5));
  await assert.rejects(decryptFile(path.join(dir, "short.enc"), path.join(dir, "out3"), key));
  assert.ok(!fs.existsSync(path.join(dir, "out3")));
});

test("the key must be 32 bytes of base64", () => {
  assert.throws(() => backupKey(""), /not set/);
  assert.throws(() => backupKey(Buffer.alloc(16).toString("base64")), /32 bytes/);
  assert.equal(backupKey(crypto.randomBytes(32).toString("base64")).length, 32);
});
