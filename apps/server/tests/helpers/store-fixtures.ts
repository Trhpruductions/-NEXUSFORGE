import { execFileSync } from "node:child_process";
import { createSign, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Test-only certificate chains for the store adapters. Generated at run time with openssl, so no private key is
// committed to the repository. Nothing here is a real store key.

export type TestAppleChain = {
  /** The root the server pins, as PEM. */
  rootPem: string;
  /** The leaf certificate's private key, as PKCS#8 PEM. Signs test transactions. */
  leafKeyPem: string;
  /** Leaf, intermediate and root, base64 DER, as Apple puts them in a signed transaction's x5c header. */
  x5c: string[];
};

function run(args: string[], cwd: string): void {
  execFileSync("openssl", args, { cwd, stdio: "pipe" });
}

function pemBodyToBase64Der(pem: string): string {
  return pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
}

export function makeAppleTestChain(label: string): TestAppleChain {
  const dir = mkdtempSync(join(tmpdir(), "nf-store-chain-"));
  try {
    writeFileSync(join(dir, "ca.ext"), "basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid\n");
    writeFileSync(join(dir, "leaf.ext"), "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid\n");

    run(["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", "root.key"], dir);
    run(["req", "-x509", "-new", "-key", "root.key", "-subj", `/CN=${label} Root`, "-days", "2", "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign", "-out", "root.pem"], dir);

    run(["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", "ca.key"], dir);
    run(["req", "-new", "-key", "ca.key", "-subj", `/CN=${label} Intermediate`, "-out", "ca.csr"], dir);
    run(["x509", "-req", "-in", "ca.csr", "-CA", "root.pem", "-CAkey", "root.key", "-CAcreateserial", "-days", "2", "-extfile", "ca.ext", "-out", "ca.pem"], dir);

    run(["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", "leaf.key"], dir);
    run(["pkcs8", "-topk8", "-nocrypt", "-in", "leaf.key", "-out", "leaf.pk8.pem"], dir);
    run(["req", "-new", "-key", "leaf.key", "-subj", `/CN=${label} Leaf`, "-out", "leaf.csr"], dir);
    run(["x509", "-req", "-in", "leaf.csr", "-CA", "ca.pem", "-CAkey", "ca.key", "-CAcreateserial", "-days", "2", "-extfile", "leaf.ext", "-out", "leaf.pem"], dir);

    const leaf = readFileSync(join(dir, "leaf.pem"), "utf8");
    const intermediate = readFileSync(join(dir, "ca.pem"), "utf8");
    const root = readFileSync(join(dir, "root.pem"), "utf8");
    return {
      rootPem: root,
      leafKeyPem: readFileSync(join(dir, "leaf.pk8.pem"), "utf8"),
      x5c: [leaf, intermediate, root].map(pemBodyToBase64Der),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A signed transaction in StoreKit's format: header with x5c, payload, and an ES256 signature from the leaf key. */
export function signAppleTransaction(chain: TestAppleChain, payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", x5c: chain.x5c })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const input = `${header}.${body}`;
  const signature = createSign("SHA256").update(input).sign({ key: chain.leafKeyPem, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${input}.${signature}`;
}

/** An EC key for the App Store Server API bearer token (the server's own key, not a store secret). */
export function makeEcApiKey(): { privateKeyPem: string; publicKeyPem: string } {
  const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return {
    privateKeyPem: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKeyPem: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

export function makeRsaServiceKey(): { privateKeyPem: string; publicKeyPem: string } {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    privateKeyPem: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKeyPem: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
