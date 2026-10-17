"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const integrity = require("../lib/integrity");

const GOOD = "a".repeat(64);
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "nf-integrity-"));
const sha = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
const missingPath = () => path.join(tempDir(), "does-not-exist.exe");

test("a hash must be exactly 64 hexadecimal characters after trimming", () => {
  assert.equal(integrity.normalizeSha256(GOOD), GOOD);
  assert.equal(integrity.normalizeSha256(`  ${GOOD}\n`), GOOD, "surrounding whitespace is trimmed");
  assert.equal(integrity.normalizeSha256(GOOD.toUpperCase()), GOOD, "upper case is accepted and lowered");
  assert.equal(integrity.normalizeSha256("ABCDEF0123456789".repeat(4)), "abcdef0123456789".repeat(4));
});

test("missing, empty, and non-string hashes are rejected", () => {
  for (const value of [undefined, null, "", "   ", 42, {}, []]) {
    assert.equal(integrity.normalizeSha256(value), null, `rejected ${JSON.stringify(value)}`);
  }
});

test("hashes of the wrong length are rejected", () => {
  assert.equal(integrity.normalizeSha256("a".repeat(63)), null, "63 characters");
  assert.equal(integrity.normalizeSha256("a".repeat(65)), null, "65 characters");
  assert.equal(integrity.normalizeSha256("a".repeat(40)), null, "SHA-1 length");
});

test("non-hexadecimal characters are rejected", () => {
  assert.equal(integrity.normalizeSha256("g".repeat(64)), null);
  assert.equal(integrity.normalizeSha256(`${"a".repeat(63)}-`), null);
  assert.equal(integrity.normalizeSha256(`${"a".repeat(32)} ${"b".repeat(31)}`), null, "an inner space");
});

test("an invalid manifest hash refuses the update without reading the file", async () => {
  const check = await integrity.verifyInstallerIntegrity(missingPath(), "not-a-hash");
  assert.equal(check.ok, false);
  assert.equal(check.code, "no-valid-hash", "the refusal comes before any file read");
});

test("a missing hash refuses the update, for each kind of missing value", async () => {
  for (const value of [undefined, null, ""]) {
    const check = await integrity.verifyInstallerIntegrity(missingPath(), value);
    assert.equal(check.ok, false);
    assert.equal(check.code, "no-valid-hash");
  }
});

test("a file whose hash matches the manifest verifies, in either case", async () => {
  const file = path.join(tempDir(), "installer.exe");
  const content = Buffer.from("installer bytes");
  fs.writeFileSync(file, content);
  const hash = sha(content);
  assert.equal((await integrity.verifyInstallerIntegrity(file, hash)).ok, true);
  assert.equal((await integrity.verifyInstallerIntegrity(file, hash.toUpperCase())).ok, true);
  assert.equal((await integrity.verifyInstallerIntegrity(file, `  ${hash}  `)).ok, true);
});

test("a file whose hash differs from the manifest is refused", async () => {
  const file = path.join(tempDir(), "installer.exe");
  fs.writeFileSync(file, "changed bytes");
  const check = await integrity.verifyInstallerIntegrity(file, sha(Buffer.from("original bytes")));
  assert.equal(check.ok, false);
  assert.equal(check.code, "mismatch");
});

test("a file that is missing is refused", async () => {
  const check = await integrity.verifyInstallerIntegrity(missingPath(), GOOD);
  assert.equal(check.ok, false);
  assert.equal(check.code, "missing-file");
});

test("a failed check discards the owned installer, and leaves any other file alone", () => {
  const dir = tempDir();
  const owned = path.join(dir, "owned.exe");
  const other = path.join(dir, "other.exe");
  fs.writeFileSync(owned, "x");
  fs.writeFileSync(other, "y");
  assert.equal(integrity.discardOwnedInstaller(other, owned), false, "a different file is never deleted");
  assert.equal(fs.existsSync(other), true);
  assert.equal(integrity.discardOwnedInstaller(owned, owned), true);
  assert.equal(fs.existsSync(owned), false);
});

test("the installer is launched only when it verifies right before launch", async () => {
  const file = path.join(tempDir(), "installer.exe");
  const content = Buffer.from("good installer");
  fs.writeFileSync(file, content);
  let launches = 0;
  const result = await integrity.runIfVerified(file, sha(content), () => (launches += 1));
  assert.equal(result.launched, true);
  assert.equal(launches, 1);
});

test("a file changed after the download check is not launched", async () => {
  const file = path.join(tempDir(), "installer.exe");
  const content = Buffer.from("good installer");
  fs.writeFileSync(file, content);
  const manifestHash = sha(content);
  // The file passes once, then is replaced before the launch check (the second verification in the updater).
  assert.equal((await integrity.verifyInstallerIntegrity(file, manifestHash)).ok, true);
  fs.writeFileSync(file, "tampered after download");
  let launches = 0;
  const result = await integrity.runIfVerified(file, manifestHash, () => (launches += 1));
  assert.equal(result.launched, false);
  assert.equal(result.code, "mismatch");
  assert.equal(launches, 0, "the installer is blocked");
});

test("a missing hash blocks launch even when the file is intact", async () => {
  const file = path.join(tempDir(), "installer.exe");
  fs.writeFileSync(file, "intact");
  let launches = 0;
  const result = await integrity.runIfVerified(file, null, () => (launches += 1));
  assert.equal(result.launched, false);
  assert.equal(result.code, "no-valid-hash");
  assert.equal(launches, 0);
});

// ---- Local test manifest over real HTTP. Nothing here touches the production manifest or download host. ----

function serveLocal(routes) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const route = routes[req.url];
      if (!route) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": route.type, "content-length": route.body.length });
      res.end(route.body);
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

test("a local test manifest drives the download and the hash check end to end", async () => {
  const installer = Buffer.from("local test installer v9.9.9");
  const { server, base } = await serveLocal({
    "/desktop-update.json": { type: "application/json", body: Buffer.from(JSON.stringify({ version: "9.9.9", downloadUrl: "/installer.exe", sha256: sha(installer) })) },
    "/installer.exe": { type: "application/octet-stream", body: installer },
  });
  try {
    const manifest = await (await fetch(`${base}/desktop-update.json`)).json();
    assert.equal(integrity.normalizeSha256(manifest.sha256), sha(installer));
    const dir = tempDir();
    const dest = path.join(dir, "NexusForge Setup 9.9.9.exe");
    fs.writeFileSync(dest, Buffer.from(await (await fetch(new URL(manifest.downloadUrl, base))).arrayBuffer()));
    const check = await integrity.verifyInstallerIntegrity(dest, manifest.sha256);
    assert.equal(check.ok, true, "the downloaded installer matches the local manifest");
    let launches = 0;
    assert.equal((await integrity.runIfVerified(dest, manifest.sha256, () => (launches += 1))).launched, true);
    assert.equal(launches, 1);
  } finally {
    server.close();
  }
});

test("a local manifest whose installer was tampered with is refused and the download is discarded", async () => {
  const published = Buffer.from("published installer");
  const served = Buffer.from("tampered installer");
  const { server, base } = await serveLocal({
    "/desktop-update.json": { type: "application/json", body: Buffer.from(JSON.stringify({ version: "9.9.9", downloadUrl: "/installer.exe", sha256: sha(published) })) },
    "/installer.exe": { type: "application/octet-stream", body: served },
  });
  try {
    const manifest = await (await fetch(`${base}/desktop-update.json`)).json();
    const dest = path.join(tempDir(), "NexusForge Setup 9.9.9.exe");
    fs.writeFileSync(dest, Buffer.from(await (await fetch(new URL(manifest.downloadUrl, base))).arrayBuffer()));
    const check = await integrity.verifyInstallerIntegrity(dest, manifest.sha256);
    assert.equal(check.ok, false);
    assert.equal(check.code, "mismatch");
    integrity.discardOwnedInstaller(dest, dest);
    assert.equal(fs.existsSync(dest), false, "the tampered download is removed");
  } finally {
    server.close();
  }
});

test("a local manifest with no hash is refused before any installer is downloaded", async () => {
  const { server, base } = await serveLocal({
    "/desktop-update.json": { type: "application/json", body: Buffer.from(JSON.stringify({ version: "9.9.9", downloadUrl: "/installer.exe" })) },
  });
  try {
    const manifest = await (await fetch(`${base}/desktop-update.json`)).json();
    assert.equal(integrity.normalizeSha256(manifest.sha256), null, "a manifest without a hash yields no usable hash");
  } finally {
    server.close();
  }
});
